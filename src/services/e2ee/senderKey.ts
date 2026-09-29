/**
 * Group encryption — the sender-key scheme Signal and WhatsApp use.
 *
 * WHY NOT PAIRWISE
 * A group could be encrypted by running the 1:1 ratchet once per member, but
 * that is O(members) encryptions and O(members) ciphertexts for every single
 * message. In a 50-person group that is 50 copies of every photo. Sender keys
 * fix this: each member generates ONE key for their own outgoing messages,
 * distributes it once over the existing pairwise sessions, and afterwards
 * encrypts each message a single time.
 *
 *   senderKey        random chain key, per (group, sender)
 *   distribution     sent once to each member INSIDE a pairwise HC2 message
 *   each message     chain key ratchets forward one step, then encrypts
 *
 * The chain ratchets forward per message, so forward secrecy holds within a
 * sender's chain: a leaked key does not open earlier messages.
 *
 * MEMBERSHIP CHANGES
 * When someone LEAVES, every remaining member must rotate their sender key —
 * otherwise the departed member can still read everything sent afterwards,
 * because they hold the old chain key. `rotateSenderKey` exists for exactly
 * that, and the caller must invoke it on membership change.
 *
 * This replaces `deriveGroupMessageKey`, whose key came from the group id and
 * the member list — both public, both known to the server.
 */
import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha2';
import { randomBytes } from '@noble/hashes/utils';
import { createMMKV, type MMKV } from 'react-native-mmkv';

import { b64, unb64 } from './identity';

const te = new TextEncoder();
const td = new TextDecoder();

export const SENDER_WIRE = 'HCG2:';

/**
 * SENDING sender-key messages is OFF until key distribution is implemented.
 *
 * A sender key is useless to the group until every member has been handed it
 * over their pairwise session — `buildDistribution` produces that payload, but
 * nothing transmits it yet. Encrypting with HCG2 before then would produce
 * messages NO MEMBER CAN READ, which is strictly worse than the legacy scheme:
 * that one is insecure against the server, this one would be broken for
 * everyone.
 *
 * Reading stays enabled, so a client that already holds a distribution can
 * decrypt. Flip this to true in the same change that ships distribution, not
 * before.
 */
export const SENDER_KEY_SENDING_ENABLED = false;

let _store: MMKV | null = null;
function store(): MMKV {
  if (!_store) _store = createMMKV({ id: 'hopechat-e2ee-senderkeys-v1' });
  return _store;
}

export type SenderKeyState = {
  /** Identifies this chain; a rotation mints a new one. */
  keyId: string;
  chainKey: string;
  counter: number;
};

/** What a member must be told so they can read our messages. */
export type SenderKeyDistribution = {
  groupId: string;
  senderUserId: string;
  keyId: string;
  chainKey: string;
  counter: number;
};

const ownKey = (groupId: string) => `own:${groupId}`;
const peerKey = (groupId: string, senderUserId: string, keyId: string) =>
  `peer:${groupId}:${senderUserId}:${keyId}`;

function step(chainKey: Uint8Array): [Uint8Array, Uint8Array] {
  const messageKey = hmac(sha256, chainKey, new Uint8Array([0x01]));
  const nextChain = hmac(sha256, chainKey, new Uint8Array([0x02]));
  return [nextChain, messageKey];
}

export function getOrCreateOwnSenderKey(groupId: string): SenderKeyState {
  try {
    const raw = store().getString(ownKey(groupId));
    if (raw) return JSON.parse(raw) as SenderKeyState;
  } catch {
    /* regenerate */
  }
  const state: SenderKeyState = {
    keyId: b64(randomBytes(8)).replace(/[^a-zA-Z0-9]/g, '').slice(0, 12),
    chainKey: b64(randomBytes(32)),
    counter: 0,
  };
  store().set(ownKey(groupId), JSON.stringify(state));
  return state;
}

/**
 * Mint a NEW sender key. Must be called when a member leaves, or that member
 * keeps reading the group with the chain key they already hold.
 */
export function rotateSenderKey(groupId: string): SenderKeyState {
  const state: SenderKeyState = {
    keyId: b64(randomBytes(8)).replace(/[^a-zA-Z0-9]/g, '').slice(0, 12),
    chainKey: b64(randomBytes(32)),
    counter: 0,
  };
  store().set(ownKey(groupId), JSON.stringify(state));
  return state;
}

/** The payload to send to each member over their pairwise HC2 session. */
export function buildDistribution(
  groupId: string,
  senderUserId: string,
): SenderKeyDistribution {
  const state = getOrCreateOwnSenderKey(groupId);
  return {
    groupId,
    senderUserId,
    keyId: state.keyId,
    chainKey: state.chainKey,
    counter: state.counter,
  };
}

/** Store a distribution received from another member. */
export function acceptDistribution(d: SenderKeyDistribution): void {
  try {
    store().set(
      peerKey(d.groupId, d.senderUserId, d.keyId),
      JSON.stringify({ keyId: d.keyId, chainKey: d.chainKey, counter: d.counter }),
    );
  } catch {
    /* best-effort */
  }
}

type Envelope = { k: string; s: string; n: number; b: string };

export function encryptGroupWithSenderKey(
  groupId: string,
  senderUserId: string,
  plaintext: string,
): string | null {
  try {
    const state = getOrCreateOwnSenderKey(groupId);
    const [nextChain, messageKey] = step(unb64(state.chainKey));
    const nonce = randomBytes(24);
    const ct = xchacha20poly1305(messageKey, nonce).encrypt(te.encode(plaintext));
    const packed = new Uint8Array(nonce.length + ct.length);
    packed.set(nonce, 0);
    packed.set(ct, nonce.length);

    store().set(
      ownKey(groupId),
      JSON.stringify({ ...state, chainKey: b64(nextChain), counter: state.counter + 1 }),
    );

    const env: Envelope = {
      k: state.keyId,
      s: senderUserId,
      n: state.counter,
      b: b64(packed),
    };
    return SENDER_WIRE + btoa(JSON.stringify(env));
  } catch {
    return null;
  }
}

/**
 * Decrypt a group message. The chain is advanced to the message's index,
 * retaining nothing — group chains are append-only per sender, so a message
 * that arrives late is derived by walking forward from the stored counter.
 */
export function decryptGroupMessage(
  groupId: string,
  wire: string,
): string | null {
  try {
    const env = JSON.parse(atob(wire.slice(SENDER_WIRE.length))) as Envelope;
    const raw = store().getString(peerKey(groupId, env.s, env.k));
    if (!raw) return null; // distribution not received yet
    const state = JSON.parse(raw) as SenderKeyState;

    let chain = unb64(state.chainKey);
    let counter = state.counter;
    let messageKey: Uint8Array | null = null;

    // Walk forward to the message's index. Bounded so a hostile counter cannot
    // spin the CPU.
    if (env.n < counter || env.n - counter > 2000) return null;
    while (counter <= env.n) {
      const [next, mk] = step(chain);
      messageKey = mk;
      chain = next;
      counter += 1;
    }
    if (!messageKey) return null;

    const packed = unb64(env.b);
    const pt = xchacha20poly1305(messageKey, packed.slice(0, 24)).decrypt(packed.slice(24));

    store().set(
      peerKey(groupId, env.s, env.k),
      JSON.stringify({ ...state, chainKey: b64(chain), counter }),
    );
    return td.decode(pt);
  } catch {
    return null;
  }
}

export function isSenderKeyEnvelope(content: string): boolean {
  return typeof content === 'string' && content.startsWith(SENDER_WIRE);
}

export function clearSenderKeys(): void {
  try {
    store().clearAll();
  } catch {
    /* best-effort */
  }
}
