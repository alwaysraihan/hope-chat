/**
 * The one entry point the app uses for encrypted messaging.
 *
 * Everything below the surface — X3DH, the Double Ratchet, session persistence,
 * the plaintext cache — is hidden behind two calls: `encryptOutgoing` and
 * `decryptIncoming`.
 *
 * WIRE FORMAT
 *   HC2:<base64(json)>   where json = { h: ratchetHeader, x?: x3dhHeader, b: body }
 *
 * `x` is present only on the first message of a session, carrying what the peer
 * needs to derive the same secret.
 *
 * MIGRATION — READ THIS
 * ---------------------
 * Three formats now coexist and all must keep working:
 *
 *   HC2:   this scheme — real E2EE, the server cannot read it
 *   HC1:   the OLD scheme, whose key derived from user ids the server knows.
 *          It is NOT secure, but millions of existing messages use it, so it
 *          stays READ-ONLY: we decrypt it, we never produce it again.
 *   plain  older still, no encryption
 *
 * Refusing to read HC1 would blank out every historical conversation, so
 * `decryptIncoming` falls back to it. New messages are always HC2 when a
 * session can be built.
 *
 * PERFORMANCE
 * `decryptIncoming` consults the plaintext cache FIRST and returns immediately
 * on a hit. Ratchet keys are ordered and single-use, so a message is decrypted
 * exactly once in its lifetime; every later render is a cache read. This is
 * what keeps a long conversation instant instead of O(n).
 */
import {
  initSender,
  initReceiver,
  ratchetDecrypt,
  ratchetEncrypt,
  type RatchetHeader,
  type RatchetState,
} from './doubleRatchet';
import { deviceId, getOrCreateSignedPreKey, unb64 } from './identity';
import { acceptSession, initiateSession, type InitialMessageHeader, type PeerBundle } from './x3dh';
import { cachePlaintext, loadSession, readPlaintext, saveSession } from './sessionStore';
import { markArchiveDirty } from './archive';
import { maybeDecryptContent } from './conversationCrypto';
import { maybeDecryptGroupContent } from './groupConversationCrypto';
import {
  decryptGroupMessage,
  encryptGroupWithSenderKey,
  isSenderKeyEnvelope,
  SENDER_KEY_SENDING_ENABLED,
} from './senderKey';

export const WIRE_V2 = 'HC2:';

/**
 * MASTER SWITCH for producing HC2 messages. READING is always on.
 *
 * Default OFF, deliberately, and it should stay off for the first build.
 *
 * The ratchet is stateful and one-way: if a bug corrupts a session, the
 * messages already sent through it are unreadable FOREVER — there is no
 * server-side copy to fall back on, because that is the entire point. None of
 * this has run between two real devices yet, and the `/e2ee` endpoints are not
 * deployed, so on the first APK key publication will fail, no peer will have
 * keys, and everything correctly stays on the legacy path anyway.
 *
 * Turn it on only after, in order:
 *   1. the backend is deployed and POST /api/v1/e2ee/keys returns 200
 *   2. two test devices publish bundles and exchange a message end to end
 *   3. the same pair verifies matching safety numbers
 *
 * Until then this build carries every other fix — calls, media, ordering,
 * notifications — without risking anyone's conversation history.
 */
export const E2EE_V2_SENDING_ENABLED = false;

type Envelope = {
  h: RatchetHeader;
  x?: InitialMessageHeader;
  b: string;
};

function encode(env: Envelope): string {
  const json = JSON.stringify(env);
  let s = '';
  const bytes = new TextEncoder().encode(json);
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return WIRE_V2 + btoa(s);
}

function decode(wire: string): Envelope | null {
  try {
    const bin = atob(wire.slice(WIRE_V2.length));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(bytes)) as Envelope;
  } catch {
    return null;
  }
}

export function isV2Envelope(content: string): boolean {
  return typeof content === 'string' && content.startsWith(WIRE_V2);
}

/**
 * Encrypt for a peer. Returns null when no session can be established — the
 * caller must then decide to send plaintext or refuse, rather than have this
 * silently downgrade.
 */
export function encryptOutgoing(
  conversationId: string,
  peer: PeerBundle,
  plaintext: string,
): string | null {
  // Gated — see E2EE_V2_SENDING_ENABLED. Returning null makes the caller use
  // the legacy path, which is what every existing client understands.
  if (!E2EE_V2_SENDING_ENABLED) return null;
  let state: RatchetState | null = loadSession(conversationId, peer.deviceId);
  let x3dhHeader: InitialMessageHeader | undefined;

  if (!state) {
    const session = initiateSession(peer, deviceId());
    // A failed signature check means the bundle may be substituted. Abort.
    if (!session) return null;
    state = initSender(session.secret, unb64(peer.signedPreKey));
    x3dhHeader = session.header;
  }

  const out = ratchetEncrypt(state, plaintext);
  if (!out) return null;
  saveSession(conversationId, peer.deviceId, out.state);
  return encode({ h: out.header, x: x3dhHeader, b: out.body });
}

/**
 * Decrypt an incoming body. Handles all three formats, and caches the result so
 * this cost is paid once per message ever.
 *
 * `legacyKeys` carries the old id-derived keys purely so historical messages
 * stay readable; they are never used to produce anything new.
 */
export function decryptIncoming(
  messageId: string,
  conversationId: string,
  peerDeviceId: string,
  content: string,
  legacyKeys?: { dm?: Uint8Array | null; group?: Uint8Array | null },
): string {
  if (!content) return content;

  // Fast path — already decrypted once.
  const cached = messageId ? readPlaintext(messageId) : null;
  if (cached != null) return cached;

  // Groups use sender keys (HCG2): one ciphertext for the whole group.
  if (isSenderKeyEnvelope(content)) {
    const out = decryptGroupMessage(conversationId, content);
    if (out == null) {
      // The sender's key distribution has not arrived yet. This resolves on its
      // own once it does, so say "not yet" rather than "broken".
      return '🔒 Decrypting…';
    }
    if (messageId) cachePlaintext(messageId, out);
    return out;
  }

  if (isV2Envelope(content)) {
    const env = decode(content);
    if (!env) return '🔒 Message could not be read';

    let state = loadSession(conversationId, peerDeviceId);
    if (!state && env.x) {
      const secret = acceptSession(env.x);
      if (!secret) return '🔒 Message could not be read';
      state = initReceiver(secret, unb64(getOrCreateSignedPreKey().priv));
    }
    if (!state) return '🔒 Message could not be read';

    const out = ratchetDecrypt(state, env.h, env.b);
    if (!out) return '🔒 Message could not be read';
    saveSession(conversationId, peerDeviceId, out.state);
    if (messageId) {
      cachePlaintext(messageId, out.plaintext);
      // The archive is now behind. Flagging is cheap; the upload itself is
      // debounced, so a burst of messages costs one sync rather than dozens.
      markArchiveDirty();
    }
    return out.plaintext;
  }

  // Legacy formats — read-only, kept so existing history is not lost.
  if (content.startsWith('HC1:') && legacyKeys?.dm) {
    const out = maybeDecryptContent(content, legacyKeys.dm);
    if (messageId && out !== content) cachePlaintext(messageId, out);
    return out;
  }
  if (content.startsWith('HCG1:') && legacyKeys?.group) {
    const out = maybeDecryptGroupContent(content, legacyKeys.group);
    if (messageId && out !== content) cachePlaintext(messageId, out);
    return out;
  }

  // An envelope we have no key for. Never show raw ciphertext.
  if (content.startsWith('HC1:') || content.startsWith('HCG1:')) {
    return '🔒 Decrypting…';
  }

  return content;
}

/**
 * Encrypt for EVERY device a peer has published.
 *
 * A ratchet session is between two devices, so ciphertext sealed for a phone
 * cannot be opened by the same person's tablet. Each device therefore gets its
 * own envelope, and the caller sends the fan-out together.
 *
 * Returns the envelopes that succeeded; a device whose bundle fails signature
 * verification is skipped rather than blocking the whole send — but if NONE
 * succeed the caller must not fall back silently.
 */
export function encryptOutgoingMultiDevice(
  conversationId: string,
  bundles: PeerBundle[],
  plaintext: string,
): Array<{ deviceId: string; envelope: string }> {
  const out: Array<{ deviceId: string; envelope: string }> = [];
  for (const bundle of bundles) {
    const envelope = encryptOutgoing(conversationId, bundle, plaintext);
    if (envelope) out.push({ deviceId: bundle.deviceId, envelope });
  }
  return out;
}

/**
 * Encrypt a GROUP message. One ciphertext serves every member, via the sender
 * key this device already distributed.
 */
export function encryptGroupOutgoing(
  groupId: string,
  senderUserId: string,
  plaintext: string,
): string | null {
  // Gated: without key distribution the group could not read what we produce.
  // Returning null makes the caller fall back to the legacy group key, which is
  // weaker but works — see SENDER_KEY_SENDING_ENABLED.
  if (!SENDER_KEY_SENDING_ENABLED) return null;
  return encryptGroupWithSenderKey(groupId, senderUserId, plaintext);
}

/** Remember our own outgoing plaintext so we can render what we just sent. */
export function rememberOwnMessage(messageId: string, plaintext: string): void {
  cachePlaintext(messageId, plaintext);
  markArchiveDirty();
}
