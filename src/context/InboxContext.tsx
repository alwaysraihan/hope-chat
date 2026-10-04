import React, {
  createContext,
  Dispatch,
  RefObject,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Animated,
  AppState,
  DeviceEventEmitter,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IMessage } from 'react-native-gifted-chat';
import { Toast } from '../components/Toast';
import {
  decryptIncoming,
  encryptOutgoing,
  encryptGroupOutgoing,
  encryptOutgoingMultiDevice,
  isV2Envelope,
  rememberOwnMessage,
} from '../services/e2ee/secureMessaging';
import { isSenderKeyEnvelope } from '../services/e2ee/senderKey';
import {
  cachedPeerBundles,
  cachedPeerDeviceId,
  resolvePeerKeys,
} from '../services/e2ee/peerSession';
import {
  launchCamera,
  launchImageLibrary,
  MediaType,
} from 'react-native-image-picker';

import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { resetReplayTo, setReplayTo } from '../redux/features/inbox/inboxSlice';
import { ExtendedMessage } from '../components/types/chat';
import { RELOAD_CHAT_LIST_EVENT, useChats } from './ChatsContext';
import {
  deleteHopenityChatMessage,
  editHopenityChatMessage,
  fetchHopenityChatMessages,
  formatChatTime,
  markHopenityChatRead,
  reactToMessage,
  fetchMessageReactions,
  sendHopenityChatMessage,
  type DeleteScope,
  uploadChatMedia,
} from '../services/chatService';
import {
  selectAuthToken,
  selectHopenityProfile,
  selectActivePage,
} from '../redux/features/auth/authSlice';
import { normalizeChatUserId } from '../utils/chatUserId';
import {
  DELETED_TEXT,
  INTRO_MESSAGE_ID,
  createdAtMs,
  isServerEchoOfPending,
  mergeFetchedAsc,
  mergeIntroDesc,
  stripIntro,
} from '../utils/messageMerge';
import { buildGroupKeyring } from '../services/e2ee/groupKeyring';
import {
  readCachedGroupMembers,
  readKnownRosters,
  sameMembers,
  writeCachedGroupMembers,
} from '../services/e2ee/groupMemberCache';
import {
  mergeLocalCallLogsFromCache,
  readThreadMessagesCache,
  writeChatDirectoryCache,
  writeThreadMessagesCache,
} from '../services/offlineCache';
import {
  checkCameraPermission,
  checkMicrophonePermission,
} from '../utils/permissions';
import {
  formatChatListPreview,
  mapApiMessageToTimeline,
} from '../services/chatMessagePreview';
import {
  CALL_OUTCOME_APPLIED_EVENT,
  type CallOutcomeAppliedPayload,
} from '../services/callOutcomeBus';
import { callSocket } from '../services/callSocket';
import {
  extractMessageSenderId,
  extractOutgoingHint,
} from '../utils/extractMessageSender';
import {
  deriveConversationMessageKey,
  encryptMessagePayload,
  maybeDecryptContent,
} from '../services/e2ee/conversationCrypto';
import {
  encryptGroupMessage,
  maybeDecryptGroupContent,
} from '../services/e2ee/groupConversationCrypto';
import { fetchGroupInfo } from '../services/groupService';
import {
  getEffectiveDisappearingTtlSec,
  getEffectiveReactionPalette,
  isE2eeEnabled,
  matchWordEffect,
} from '../services/chatPrefs';

import { CHAT_SCREEN_WIDTH } from '../data/chatTemplates';

// Re-export for tests / tooling that imported from this module
export { DEFAULT_MESSAGES } from '../data/chatTemplates';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

// ─── Context shape ────────────────────────────────────────────────────────────

export type HandleLongPress = (
  setReactionTrayStyle: Dispatch<SetStateAction<ViewStyle>>,
  openTray: () => void,
  isRight: boolean,
) => void;

interface InboxContextValue {
  // ── State
  messages: ExtendedMessage[];
  setText: (t: string) => void;
  initialText: string;
  setInitialText: (t: string) => void;
  user: { _id: string | number; [key: string]: any };
  insets: ReturnType<typeof useSafeAreaInsets>;
  width: number;
  refreshTrigger: number;
  isRecording: boolean;
  inputAnimation: Animated.Value;
  loadingMore: boolean;
  hasMore: boolean;
  replyTo: ExtendedMessage | null;
  /** True while the other participant is actively typing in this conversation. */
  peerIsTyping: boolean;
  /** Emoji to animate for a word effect, and a counter so repeats replay. */
  wordEffect: { emoji: string | null; burstId: number };

  // ── Message CRUD
  onSend: (msgs: ExtendedMessage[]) => void;
  loadEarlier: () => void;
  retryMessage: (message: IMessage) => void;
  updateMessage: (id: string | number, patch: Partial<ExtendedMessage>) => void;
  deleteMessage: (id: string | number) => void;

  // ── Actions
  handleReact: (emoji: string, message: IMessage) => void;
  handleReply: (message: IMessage) => void;
  clearReply: () => void;
  handleDelete: (message: IMessage) => void;
  /** Own, text-only, confirmed messages can be edited. */
  canEditMessage: (message: IMessage) => boolean;
  handleEdit: (message: IMessage) => void;
  cancelEdit: () => void;
  editingMessage: ExtendedMessage | null;
  handleForward: (message: IMessage) => void;
  forwardingMessage: ExtendedMessage | null;
  clearForwarding: () => void;
  handlePressReplyPreview: (messageId: string | number) => void;
  handleLongPress: HandleLongPress;

  // ── Media / camera
  handleCameraPress: () => void;
  handleGalleryPress: () => void;

  // ── Seller product share
  sellerSheetVisible: boolean;
  openSellerSheet: () => void;
  closeSellerSheet: () => void;

  // ── Voice
  handleVoiceRecordingStart: () => void;
  handleVoiceRecordingComplete: (path: string, duration: number) => void;
  handleVoiceRecordingCancel: () => void;

  reactionEmojiRow: string[];
  conversationId?: string;

  /** True when E2EE is active for the current conversation (DM or group). */
  isEncrypted: boolean;

  /**
   * Register a scroll-to-message function from InboxScreen once the
   * GiftedChat FlatList mounts. Calling this is a no-op after unmount.
   */
  registerScrollToMessage: (fn: (id: string | number) => void) => void;

  // ── Context
  wrapRef: RefObject<View | null>;
  swipeRef: RefObject<any | null>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const InboxContext = createContext<InboxContextValue | null>(null);

// ─── Consumer hook ────────────────────────────────────────────────────────────

export function useInbox(): InboxContextValue {
  const ctx = useContext(InboxContext);
  if (!ctx) {
    throw new Error('useInbox must be used inside <InboxProvider>');
  }
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export interface ThreadIntroPeer {
  name: string;
  avatarUrl?: string | null;
  /** Override the default subtitle ("You're friends on Hopenity"). */
  subtitle?: string;
  /** Prompt text below the subtitle (defaults to "Say hi…"). */
  prompt?: string;
}

interface InboxProviderProps {
  children: React.ReactNode;
  /** When set, replaces the default seeded thread (e.g. chosen from home list). */
  seedMessages?: ExtendedMessage[];
  /** Stable id for pagination / future API (must match conversation list id). */
  conversationId?: string;
  /** Renders Hopenity-style “friends / say hi” ribbon at top of timeline. */
  threadIntroPeer?: ThreadIntroPeer;
  /** 1:1 other participant user id — required for E2EE key agreement. */
  peerUserId?: string | null;
  /** Group / multi-participant chats skip symmetric DM crypto. */
  isGroup?: boolean;
  /** True for chats that originated from the v1 API (have conversationKey). v2-native chats need v2 endpoints. */
  isV1Chat?: boolean;
  /** Optional server-provided reaction set for this thread. */
  remoteReactionPalette?: string[] | null;
}

export function InboxProvider({
  children,
  seedMessages,
  conversationId: _conversationId,
  threadIntroPeer,
  peerUserId = null,
  isGroup = false,
  isV1Chat = false,
  remoteReactionPalette = null,
}: InboxProviderProps) {
  // v2 endpoint is needed for groups AND for v2-native DMs (no conversationKey).
  // v1-native DMs (have conversationKey) use v1 endpoints.
  const useV2Messages = isGroup || !isV1Chat;
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wrapRef = useRef<View>(null);
  const swipeRef = useRef<any>(null);
  const token = useAppSelector(selectAuthToken);

  // ── Auth / user
  const gifted = useAppSelector(state => state.auth.giftedChatUser);
  const hopenityProfile = useAppSelector(selectHopenityProfile);
  const activePage = useAppSelector(selectActivePage);
  const user = useMemo(() => {
    const id =
      normalizeChatUserId(gifted?._id) ||
      normalizeChatUserId(hopenityProfile?.userId) ||
      'me';
    return {
      _id: id,
      name: gifted?.name ?? hopenityProfile?.displayName ?? 'You',
    };
  }, [gifted, hopenityProfile]);

  const localUserIdStr = useMemo(
    () => normalizeChatUserId(user._id) || String(user._id ?? ''),
    [user._id],
  );

  /** Symmetric DM key — used to decrypt HC1 payloads even if “send encrypted” is toggled off. */
  const dmCryptoKey = useMemo(() => {
    if (isGroup || !_conversationId || !peerUserId) return null;
    if (!localUserIdStr || localUserIdStr === 'me') return null;
    try {
      return deriveConversationMessageKey(
        localUserIdStr,
        peerUserId,
        _conversationId,
      );
    } catch {
      return null;
    }
  }, [isGroup, _conversationId, peerUserId, localUserIdStr]);

  /** Symmetric group key — derived once after fetching group members. */
  /**
   * Derive the group key from cached membership on the very first render, so
   * the thread never paints raw ciphertext while a round-trip is in flight.
   */
  const [groupCryptoKey, setGroupCryptoKey] = useState<Uint8Array | null>(() => {
    if (!isGroup || !_conversationId || !isE2eeEnabled()) return null;
    try {
      // Stable key: available synchronously, no roster or network needed.
      return buildGroupKeyring(_conversationId, readCachedGroupMembers(_conversationId));
    } catch {
      return null;
    }
  });

  // Resolves once the key is known (or known to be unavailable). The send path
  // awaits this so a message composed before the key lands is still encrypted
  // rather than silently downgraded to plaintext.
  const groupKeyReadyRef = useRef<Promise<Uint8Array | null> | null>(null);

  useEffect(() => {
    if (!isGroup || !_conversationId || !token || !isE2eeEnabled()) {
      setGroupCryptoKey(null);
      groupKeyReadyRef.current = null;
      return;
    }

    let cancelled = false;
    const cachedMembers = readCachedGroupMembers(_conversationId);
    // The keyring from first render is already usable; only swap it when the
    // live roster teaches us a new fallback (avoids a pointless re-map).
    let current: Uint8Array | null = null;
    try {
      current = buildGroupKeyring(_conversationId, cachedMembers);
      groupKeyReadyRef.current = Promise.resolve(current);
    } catch {
      /* fall through to the fetch below */
    }

    // Learn the live roster so history sealed with it (legacy member-derived
    // key) opens too. It only ADDS a fallback — the sending key never moves.
    const pending = fetchGroupInfo(_conversationId, token)
      .then(info => {
        const memberIds = (info?.members ?? []).map(m => m.userId);
        try {
          const isNewRoster =
            memberIds.length > 0 &&
            !readKnownRosters(_conversationId).some(r => sameMembers(r, memberIds));
          if (memberIds.length > 0 && !sameMembers(cachedMembers, memberIds)) {
            writeCachedGroupMembers(_conversationId, memberIds);
          }
          if (!isNewRoster && current) return current;
          const key = buildGroupKeyring(_conversationId, memberIds);
          current = key;
          if (!cancelled) setGroupCryptoKey(key);
          return key;
        } catch {
          return null;
        }
      })
      .catch(() => null);

    groupKeyReadyRef.current = pending;
    return () => {
      cancelled = true;
    };
  }, [isGroup, _conversationId, token]);

  /**
   * Await the group key before deciding whether to encrypt. Without this, a
   * message sent in the first moments after opening a group went out in
   * plaintext into an otherwise-encrypted thread.
   */
  const resolveGroupKey = useCallback(async (): Promise<Uint8Array | null> => {
    if (groupCryptoKey) return groupCryptoKey;
    if (!groupKeyReadyRef.current) return null;
    try {
      return await groupKeyReadyRef.current;
    } catch {
      return null;
    }
  }, [groupCryptoKey]);

  const shouldEncryptOutgoing = isE2eeEnabled() && (isGroup ? !!groupCryptoKey : !!dmCryptoKey);

  const disappearingTtlSec = getEffectiveDisappearingTtlSec(_conversationId);
  const [disappearPulse, setDisappearPulse] = useState(0);
  useEffect(() => {
    if (disappearingTtlSec <= 0) return;
    const id = setInterval(
      () => setDisappearPulse(p => p + 1),
      15000,
    );
    return () => clearInterval(id);
  }, [disappearingTtlSec]);

  // ── Redux reply state
  const replyTo = useAppSelector(
    state => state.inbox.replayTo,
  ) as ExtendedMessage | null;

  // ── Forward state
  const [forwardingMessage, setForwardingMessage] = useState<ExtendedMessage | null>(null);
  const clearForwarding = useCallback(() => setForwardingMessage(null), []);

  // ── Edit state — while set, the composer's send submits an edit instead
  const [editingMessage, setEditingMessage] = useState<ExtendedMessage | null>(null);

  // ── Message state
  // Single source of truth. `messages` (newest-first, with the intro card) is
  // derived — it used to be a second copy updated in lockstep, doubling every
  // state update and re-render.
  const [allMessages, setAllMessages] = useState<ExtendedMessage[]>([]);
  const messages = useMemo(
    () => mergeIntroDesc([...allMessages].reverse(), threadIntroPeer),
    [allMessages, threadIntroPeer],
  );
  const allMessagesRef = useRef<ExtendedMessage[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(1);
  allMessagesRef.current = allMessages;

  // ── Input state
  const [initialText, setInitialText] = useState('');

  // ── Typing indicator
  const [peerIsTyping, setPeerIsTyping] = useState(false);
  const [wordEffect, setWordEffect] = useState<{
    emoji: string | null;
    burstId: number;
  }>({ emoji: null, burstId: 0 });

  /** Play the burst locally; `burstId` bumps so the same word replays. */
  const playWordEffect = useCallback((emoji: string) => {
    if (!emoji) return;
    setWordEffect(prev => ({ emoji, burstId: prev.burstId + 1 }));
  }, []);
  /** Last "typing" ping sent, for throttling. 0 = free to ping immediately. */
  const lastTypingPingRef = useRef(0);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peerTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Recording state
  const [isRecording, setIsRecording] = useState(false);

  // ── Refresh trigger — forces ChatMessageBox re-render after reactions / replies
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const bumpRefresh = useCallback(() => setRefreshTrigger(n => n + 1), []);

  const { setConversations } = useChats();

  // Memoised: a fresh array every render would invalidate the context value.
  const reactionEmojiRow = useMemo(
    () =>
      remoteReactionPalette && remoteReactionPalette.length > 0
        ? remoteReactionPalette.slice(0, 8)
        : getEffectiveReactionPalette(_conversationId),
    [remoteReactionPalette, _conversationId],
  );

  const mapHopenityMessage = useCallback(
    (raw: any): ExtendedMessage => {
      const sender = raw.sender ?? {};
      // senderPage is present when the message was sent by a page account
      const senderPage: Record<string, unknown> | null =
        raw.senderPage ?? raw.sender_page ?? null;
      const rawDict = raw as Record<string, unknown>;
      const extracted = extractMessageSenderId(rawDict);
      const rawSid =
        extracted ||
        (raw.senderId ??
          raw.sender_id ??
          raw.userId ??
          raw.user_id ??
          raw.fromUserId ??
          raw.from_user_id ??
          sender.user_id ??
          sender.id ??
          sender.userId ??
          sender.user?.id ??
          sender.user?._id ??
          raw.memberId ??
          raw.senderUserId ??
          raw.createdByUserId);
      const senderId =
        rawSid != null && String(rawSid).trim() !== ''
          ? String(rawSid).trim()
          : '';
      // Page name takes priority over user name for page-sent messages
      const senderName =
        (senderPage?.name ? String(senderPage.name) : null) ??
        (sender.name ? String(sender.name) : null) ??
        String(raw.senderName ?? raw.sender_name ?? 'Unknown');
      const senderAvatar: string | undefined =
        (senderPage?.image ? String(senderPage.image) : null) ??
        (sender.image ? String(sender.image) : null) ??
        (sender.avatar ? String(sender.avatar) : undefined) ??
        undefined;
      const createdAtRaw = raw.createdAt ?? raw.created_at;
      const id = String(raw.id ?? `${_conversationId ?? 'chat'}_${Date.now()}`);

      const rawObj = { ...(raw as Record<string, unknown>) };
      const rawContent = String(rawObj.content ?? rawObj.text ?? '').trimStart();
      // Set only when a group envelope fails to decrypt with the key we
      // currently hold — carried onto the parsed message so the retro-decrypt
      // sweep below can retry it once our member-list cache (and therefore
      // our derived key) catches up, without ever rendering the raw envelope.
      let pendingCipherText: string | undefined;
      if (isV2Envelope(rawContent) || isSenderKeyEnvelope(rawContent)) {
        // New scheme. decryptIncoming reads the plaintext cache first, so this
        // is a cache hit for every message after the first — which is what
        // keeps a long thread instant instead of re-walking the ratchet.
        rawObj.content = decryptIncoming(
          id,
          _conversationId ?? '',
          cachedPeerDeviceId(peerUserId ?? '') ?? '',
          rawContent,
          { dm: dmCryptoKey, group: groupCryptoKey },
        );
      } else if (dmCryptoKey && rawContent.startsWith('HC1:')) {
        rawObj.content = maybeDecryptContent(rawContent, dmCryptoKey);
      } else if (groupCryptoKey && rawContent.startsWith('HCG1:')) {
        const attempt = maybeDecryptGroupContent(rawContent, groupCryptoKey);
        if (attempt === rawContent) {
          // Our key didn't open this — almost always because this device's
          // cached member list is stale relative to whatever the sender used
          // (the legacy group key is derived from the member list, so ANY
          // membership change instantly changes it for everyone, and each
          // device only catches up whenever its own fetchGroupInfo refresh
          // lands). That is the "some people see plaintext, some see raw
          // ciphertext" report — never show the envelope itself; wait for the
          // sweep below to retry with a fresher key.
          rawObj.content = '🔒 Decrypting…';
          pendingCipherText = rawContent;
        } else {
          rawObj.content = attempt;
        }
      } else if (rawContent.startsWith('HC1:') || rawContent.startsWith('HCG1:')) {
        // Envelope with no key available YET.
        //
        // Group keys are derived from the member list, which needs a network
        // round trip (fetchGroupInfo), so on first open groupCryptoKey is null
        // for a moment. The raw envelope used to go straight into message state
        // and render — that is the "HCG1:…" flash before the text appears.
        // WhatsApp/Telegram never show this because their keys are local and
        // decryption happens before the message reaches the UI.
        //
        // We cannot make the key local, but we can refuse to render internals:
        // show a neutral placeholder and let the re-map swap in the real text
        // when the key lands.
        rawObj.content = '🔒 Decrypting…';
        if (rawContent.startsWith('HCG1:')) pendingCipherText = rawContent;
      }

      const parsed = mapApiMessageToTimeline(rawObj);

      let media = parsed.media;
      // HC2 media, decrypted through the same path (and the same cache) as text.
      if (media?.remoteUri && (isV2Envelope(media.remoteUri) || isSenderKeyEnvelope(media.remoteUri))) {
        media = {
          ...media,
          remoteUri: decryptIncoming(
            `${id}:remote`,
            _conversationId ?? '',
            cachedPeerDeviceId(peerUserId ?? '') ?? '',
            media.remoteUri,
            { dm: dmCryptoKey, group: groupCryptoKey },
          ),
        };
      }
      if (media?.url && (isV2Envelope(media.url) || isSenderKeyEnvelope(media.url))) {
        media = {
          ...media,
          url: decryptIncoming(
            `${id}:url`,
            _conversationId ?? '',
            cachedPeerDeviceId(peerUserId ?? '') ?? '',
            media.url,
            { dm: dmCryptoKey, group: groupCryptoKey },
          ),
        };
      }
      if (dmCryptoKey && media?.remoteUri?.startsWith('HC1:')) {
        media = {
          ...media,
          remoteUri: maybeDecryptContent(media.remoteUri, dmCryptoKey),
        };
      }
      if (dmCryptoKey && media?.url?.startsWith('HC1:')) {
        media = {
          ...media,
          url: maybeDecryptContent(media.url!, dmCryptoKey),
        };
      }
      if (groupCryptoKey && media?.remoteUri?.startsWith('HCG1:')) {
        const attempt = maybeDecryptGroupContent(media.remoteUri, groupCryptoKey);
        // A stale key leaves this unchanged — never hand a raw envelope to an
        // <Image>/<Video> source as if it were a real URL; drop it instead so
        // this render falls back to no-media rather than a broken fetch.
        media = { ...media, remoteUri: attempt === media.remoteUri ? undefined : attempt };
      }
      if (groupCryptoKey && media?.url?.startsWith('HCG1:')) {
        const attempt = maybeDecryptGroupContent(media.url!, groupCryptoKey);
        media = { ...media, url: attempt === media.url ? undefined : attempt };
      }

      const hint = extractOutgoingHint(rawDict);
      const peer = peerUserId ? normalizeChatUserId(peerUserId) || peerUserId : '';
      const rawSender =
        (senderId && (normalizeChatUserId(senderId) || senderId)) || '';

      const idSame = (a: string, b: string): boolean => {
        if (!a || !b) return false;
        if (a === b) return true;
        if (
          /^\d+$/.test(a) &&
          /^\d+$/.test(b) &&
          Number(a) === Number(b)
        ) {
          return true;
        }
        return false;
      };

      let resolvedUid = rawSender;
      if (hint === true && localUserIdStr) {
        resolvedUid = normalizeChatUserId(localUserIdStr) || localUserIdStr;
      } else if (hint === false && peer) {
        resolvedUid = peer;
      } else if (
        hint !== true &&
        hint !== false &&
        rawSender &&
        localUserIdStr &&
        peer
      ) {
        const loc =
          normalizeChatUserId(localUserIdStr) || String(localUserIdStr);
        if (idSame(rawSender, loc)) {
          resolvedUid = loc;
        } else if (idSame(rawSender, peer)) {
          resolvedUid = peer;
        } else {
          resolvedUid = rawSender;
        }
      } else if (!resolvedUid || resolvedUid === 'unknown') {
        if (!isGroup && peer && localUserIdStr && localUserIdStr !== 'me') {
          const loc = normalizeChatUserId(localUserIdStr) || localUserIdStr;
          const meta = (rawObj.metadata ?? {}) as Record<string, unknown>;
          const metaSender =
            meta.senderId ??
            meta.sender_id ??
            meta.fromUserId ??
            meta.userId;
          const metaStr =
            metaSender != null && String(metaSender).trim() !== ''
              ? String(metaSender).trim()
              : '';
          const metaNorm = metaStr
            ? normalizeChatUserId(metaStr) || metaStr
            : '';
          if (metaNorm && idSame(metaNorm, loc)) {
            resolvedUid = loc;
          } else if (metaNorm && idSame(metaNorm, peer)) {
            resolvedUid = peer;
          } else {
            resolvedUid = 'unknown';
          }
        } else {
          resolvedUid = 'unknown';
        }
      }

      const rawReplyTo = raw.replyTo ?? raw.reply_to;
      const replyToSenderPage: Record<string, unknown> | null =
        rawReplyTo?.senderPage ?? rawReplyTo?.sender_page ?? null;
      // The quoted message needs the SAME treatment as the message itself:
      // decrypted, and with its media mapped.
      //
      //  - text was used raw, so replying to an encrypted message quoted the
      //    literal "HC1:…" ciphertext.
      //  - media was hardcoded `undefined`, so a reply to a photo/video/voice
      //    had nothing to render a thumbnail or a "🎤 Voice message" label from
      //    and fell through to the text field — which for a media message is
      //    the raw file URL. That is the "voice shows a link" report.
      const rawReplyContent = String(
        rawReplyTo?.content ?? rawReplyTo?.text ?? '',
      ).trimStart();
      let replyText = rawReplyContent;
      if (dmCryptoKey && rawReplyContent.startsWith('HC1:')) {
        replyText = maybeDecryptContent(rawReplyContent, dmCryptoKey);
      } else if (groupCryptoKey && rawReplyContent.startsWith('HCG1:')) {
        const attempt = maybeDecryptGroupContent(rawReplyContent, groupCryptoKey);
        // Same stale-key case as the main message above — never show the
        // quoted message's raw envelope.
        replyText = attempt === rawReplyContent ? '🔒 Decrypting…' : attempt;
      } else if (rawReplyContent.startsWith('HCG1:')) {
        replyText = '🔒 Decrypting…';
      }

      let replyMedia = rawReplyTo
        ? mapApiMessageToTimeline({ ...rawReplyTo, content: replyText }).media
        : undefined;
      if (dmCryptoKey && replyMedia?.url?.startsWith('HC1:')) {
        replyMedia = { ...replyMedia, url: maybeDecryptContent(replyMedia.url, dmCryptoKey) };
      }
      if (dmCryptoKey && replyMedia?.remoteUri?.startsWith('HC1:')) {
        replyMedia = {
          ...replyMedia,
          remoteUri: maybeDecryptContent(replyMedia.remoteUri, dmCryptoKey),
        };
      }

      const replyToMapped = rawReplyTo
        ? {
            _id: String(rawReplyTo.id ?? rawReplyTo._id ?? ''),
            // Media messages carry a URL as their content — showing that as the
            // quote is meaningless, so let ReplyPreview use its media label.
            text: replyMedia ? '' : replyText,
            media: replyMedia,
            user: (() => {
              const uid = String(
                rawReplyTo.sender?.user_id ?? rawReplyTo.senderUserId ?? rawReplyTo.senderId ?? '',
              );
              const name = replyToSenderPage?.name
                ? String(replyToSenderPage.name)
                : rawReplyTo.sender?.name
                  ? String(rawReplyTo.sender.name)
                  : '';
              const avatar = replyToSenderPage?.image
                ? String(replyToSenderPage.image)
                : rawReplyTo.sender?.image
                  ? String(rawReplyTo.sender.image)
                  : undefined;
              return { _id: uid, name, avatar };
            })(),
          }
        : undefined;

      return {
        _id: id,
        text: parsed.text,
        createdAt: createdAtRaw ? new Date(createdAtRaw) : new Date(),
        user: {
          _id: resolvedUid,
          name: senderName,
          avatar: senderAvatar,
        },
        media,
        messageKind: parsed.messageKind,
        donationRequest: parsed.donationRequest,
        bookingCard: parsed.bookingCard,
        storyReply: parsed.storyReply,
        delivery: parsed.delivery,
        outgoingHint: hint,
        replyTo: replyToMapped,
        pendingCipherText,
        ...(Array.isArray(raw.reactions)
          ? {
              reactions: (raw.reactions as Array<Record<string, unknown>>).map(r => ({
                emoji: String(r.emoji ?? ''),
                userId: String(r.userId ?? r.user_id ?? ''),
                userName: String(
                  (r.user as { name?: string } | undefined)?.name ?? r.userName ?? '',
                ),
                avatar:
                  (r.user as { image?: string | null } | undefined)?.image ?? null,
              })),
            }
          : {}),
        ...(raw.deletedAt ?? raw.deleted_at
          ? { deleted: true, text: DELETED_TEXT, media: undefined, reactions: [] }
          : {}),
        ...(raw.editedAt ?? raw.edited_at
          ? { editedAt: String(raw.editedAt ?? raw.edited_at) }
          : {}),
      };
    },
    // groupCryptoKey is intentionally a dependency: it resolves asynchronously
    // (after an extra fetchGroupInfo round-trip), and this memo must be
    // recreated once it's available — otherwise every call after that point
    // keeps closing over the earlier `null`, decryption is silently skipped,
    // and messages that had already been decrypted (via the retro-decrypt
    // pass below) flip back to raw ciphertext on the next 15s poll.
    [_conversationId, dmCryptoKey, groupCryptoKey, localUserIdStr, peerUserId, isGroup],
  );

  // Always-fresh handle to mapHopenityMessage that doesn't itself trigger
  // effects. Needed so the initial-load effect below can call the up-to-date
  // (correctly decrypting) mapper without depending on it directly — if it
  // did, the effect would re-run the instant groupCryptoKey resolves, which
  // synchronously resets messages to the (still-ciphertext) session cache
  // before the subsequent fetch re-decrypts them: a visible
  // decrypted → ciphertext → decrypted flicker.
  const mapHopenityMessageRef = useRef(mapHopenityMessage);
  mapHopenityMessageRef.current = mapHopenityMessage;

  // seedMessages gets a new array reference on almost every inbox poll (the
  // whole `conversations` list re-renders for unrelated previews/unread
  // counts), not just when this thread's own messages change. Reading it via
  // ref keeps the initial-load effect below off that churn — without this it
  // was in the effect's deps and re-ran on every poll, resetting pageRef to 1
  // and discarding any older messages "load earlier" had just prepended.
  const seedMessagesRef = useRef(seedMessages);
  seedMessagesRef.current = seedMessages;

  const messagesForUi = useMemo(() => {
    if (disappearingTtlSec <= 0) return messages;
    const now = Date.now();
    const ttlMs = disappearingTtlSec * 1000;
    return messages.filter(m => {
      if (m.threadIntro || m._id === INTRO_MESSAGE_ID) return true;
      const t =
        m.createdAt instanceof Date
          ? m.createdAt.getTime()
          : new Date(m.createdAt as string | number | Date).getTime();
      return now - t <= ttlMs;
    });
  }, [messages, disappearingTtlSec, disappearPulse]);
  const updateConversationPreview = useCallback(
    (content: string, timestamp: string | Date | number) => {
      if (!_conversationId) return;
      const iso =
        typeof timestamp === 'number'
          ? new Date(timestamp).toISOString()
          : typeof timestamp === 'string'
            ? timestamp
            : timestamp.toISOString();
      const timeStr = formatChatTime(iso);
      setConversations(prev => {
        const idx = prev.findIndex(c => c.id === _conversationId);
        if (idx < 0) return prev;
        const row = {
          ...prev[idx],
          preview: content,
          time: timeStr,
          unreadCount: 0,
          // Keep the sort key in step with the visual bump, or the row returns
          // to its old position the next time the list is sorted or restored
          // from cache.
          sortAt: new Date(iso).getTime() || Date.now(),
        };
        const next = [row, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
        // Persist new order so cold-start cache reflects the latest message.
        if (localUserIdStr && localUserIdStr !== 'me') {
          writeChatDirectoryCache(localUserIdStr, next);
        }
        return next;
      });
    },
    [_conversationId, localUserIdStr, setConversations],
  );

  // ── Persist thread cache after every send (Fix: messages survive back-navigation) ──
  // Only write when allMessages actually has content and we're in an active conversation.
  // This ensures optimistically-added messages are in cache before the server fetch
  // returns, preventing them from "disappearing" when the user goes back and re-enters.
  // Debounced: serialising the whole thread to disk on EVERY state change (each
  // keystroke-adjacent update, ack, reaction, poll) blocked the JS thread. The
  // latest snapshot is flushed when the thread closes so nothing is lost.
  const cacheSnapshotRef = useRef<{ id: string; msgs: ExtendedMessage[] } | null>(null);
  useEffect(() => {
    if (!_conversationId || allMessages.length === 0) return;
    cacheSnapshotRef.current = { id: _conversationId, msgs: allMessages };
    const t = setTimeout(() => {
      const snap = cacheSnapshotRef.current;
      if (snap) writeThreadMessagesCache(snap.id, snap.msgs);
      cacheSnapshotRef.current = null;
    }, 1200);
    return () => clearTimeout(t);
  }, [_conversationId, allMessages]);
  useEffect(
    () => () => {
      const snap = cacheSnapshotRef.current;
      if (snap) writeThreadMessagesCache(snap.id, snap.msgs);
    },
    [],
  );

  // ── Animations
  const inputAnimation = useRef(new Animated.Value(0)).current;

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const animateInput = useCallback(
    (toValue: number) => {
      Animated.timing(inputAnimation, {
        toValue,
        duration: 200,
        useNativeDriver: true,
      }).start();
    },
    [inputAnimation],
  );

  // ─── Initial load ──────────────────────────────────────────────────────────

  useEffect(() => {
    pageRef.current = 1;
    const cached =
      _conversationId && token
        ? readThreadMessagesCache(_conversationId)
        : null;
    const fromSeed = seedMessagesRef.current?.length ? seedMessagesRef.current : [];
    const base = fromSeed.length
      ? fromSeed
      : cached?.length
        ? cached
        : [];

    setLoadingMore(false);
    // Provider is keyed per conversation, so anything already in state is this
    // thread's. Don't wipe it with the (reaction-less) list snapshot when this
    // effect re-runs — that made reactions flash to 0 until the refetch landed.
    setAllMessages(prev => (prev.length ? prev : base));
    
    setHasMore(!!(_conversationId && token));

    if (!_conversationId || !token) {
      setHasMore(false);
      return;
    }

    const load = async () => {
      try {
        const page = await fetchHopenityChatMessages(_conversationId, token, {
          limit: PAGE_SIZE,
          isGroup: useV2Messages,
        });
        const fetched = page.messages ?? [];
        const mapped = fetched.map((raw: any) => mapHopenityMessageRef.current(raw));
        // Normalise to ascending order (oldest first) before storing.
        // v2 groups return messages newest-first; v1 DMs return oldest-first.
        // Without this sort, group messages render in reverse (newest at top).
        mapped.sort((a, b) => {
          const getMs = (m: ExtendedMessage) => {
            const r = m.createdAt as unknown;
            return r instanceof Date ? r.getTime() : new Date(r as string | number).getTime();
          };
          return getMs(a) - getMs(b);
        });
        const mergedAsc = mergeLocalCallLogsFromCache(_conversationId, mapped);
        // Preserve any pending/failed messages from the current state that the
        // API hasn't confirmed yet.  Race: user sends message → navigates back
        // before the API responds → re-enters → load() runs → API response
        // doesn't include the not-yet-processed message → it disappears.
        // By keeping pending entries that aren't already in the server response
        // (matched by _id) we prevent the optimistic message from vanishing.
        // A pending bubble whose echo is already in the server response (matched
        // by content — the ack may not have swapped its client id yet) must be
        // dropped, not kept, or the message shows twice.
        const keepPending = (m: ExtendedMessage, serverIds: Set<string>) =>
          (m.pending || m.failed) &&
          !serverIds.has(String(m._id)) &&
          !mergedAsc.some(s => isServerEchoOfPending(m, s));
        setAllMessages(prev => {
          const serverIds = new Set(mergedAsc.map(m => String(m._id)));
          const pendingToKeep = prev.filter(m => keepPending(m, serverIds));
          if (pendingToKeep.length === 0) return mergedAsc;
          const combined = [...mergedAsc, ...pendingToKeep];
          combined.sort((a, b) => createdAtMs(a.createdAt) - createdAtMs(b.createdAt));
          return combined;
        });
        
        setHasMore(
          page.pagination?.hasMore ??
            fetched.length >= PAGE_SIZE,
        );
        writeThreadMessagesCache(_conversationId, mergedAsc);
        // Route by generation: v2-native DMs must hit the v2 read endpoint or a
        // colliding v1 chat id gets marked read instead (shared numeric id space).
        markHopenityChatRead(_conversationId, token, isGroup, useV2Messages).catch(() => undefined);
      } catch (err) {
        console.error('[InboxProvider] load chat messages error:', err);
      }
    };

    load();
    // mapHopenityMessage and seedMessages are intentionally NOT dependencies —
    // see mapHopenityMessageRef / seedMessagesRef above. This effect should
    // only run on a genuine conversation switch / reconnect, not every time
    // the group crypto key resolves or the inbox list re-renders (those are
    // handled by the retro-decrypt pass + fresh polls / loadEarlier).
  }, [_conversationId, token, threadIntroPeer, useV2Messages, isGroup]);

  // ─── Live poll: fetch new messages, on-demand (socket push) and every 15 s
  // as a fallback while this chat is open ────────────────────────────────────
  const pollMessagesNow = useCallback(async () => {
    if (!_conversationId || !token) return;
    try {
      const page = await fetchHopenityChatMessages(_conversationId, token, {
        limit: PAGE_SIZE,
        isGroup: useV2Messages,
      });
      const fetched = page.messages ?? [];
      const mapped = fetched.map(mapHopenityMessage);
      mapped.sort((a, b) => {
        const toMs = (t: unknown) =>
          t instanceof Date ? t.getTime() : new Date(t as string | number).getTime();
        return toMs(a.createdAt) - toMs(b.createdAt);
      });
      setAllMessages(prev => {
        const merged = mergeFetchedAsc(prev, mapped);
        if (!merged) return prev;
        writeThreadMessagesCache(_conversationId, merged);
        return merged;
      });
      
    } catch { /* silent — stale UI is fine, next poll will retry */ }
  }, [_conversationId, token, useV2Messages, mapHopenityMessage, threadIntroPeer]);

  useEffect(() => {
    if (!_conversationId || !token) return;
    const id = setInterval(pollMessagesNow, 15_000);
    return () => clearInterval(id);
  }, [_conversationId, token, pollMessagesNow]);

  // ─── Fetch messages ────────────────────────────────────────────────────────

  const fetchMessages = useCallback(
    async (page: number) => {
      if (!_conversationId || !token) {
        setLoadingMore(false);
        return;
      }

      setLoadingMore(page > 1);

      try {
        const oldestIdRaw = page > 1 ? allMessages[0]?._id : undefined;
        const before =
          oldestIdRaw !== undefined ? String(oldestIdRaw) : undefined;
        if (__DEV__) {
          console.log('[HopeChat DEBUG][inbox] fetchMessages request', {
            page, before, allMessagesLen: allMessages.length, isGroup: useV2Messages,
          });
        }
        const res = await fetchHopenityChatMessages(_conversationId, token, {
          limit: PAGE_SIZE,
          before,
          isGroup: useV2Messages,
        });
        const chunk = res.messages ?? [];
        if (__DEV__) {
          console.log('[HopeChat DEBUG][inbox] fetchMessages response', {
            page,
            chunkLen: chunk.length,
            pagination: res.pagination,
            firstId: chunk[0] ? (chunk[0] as Record<string, unknown>).id : undefined,
            lastId: chunk[chunk.length - 1] ? (chunk[chunk.length - 1] as Record<string, unknown>).id : undefined,
          });
        }
        const mapped = chunk.map(mapHopenityMessage);
        // Normalise to ascending (oldest first) regardless of API version order.
        mapped.sort((a, b) => {
          const getMs = (m: ExtendedMessage) => {
            const r = m.createdAt as unknown;
            return r instanceof Date ? r.getTime() : new Date(r as string | number).getTime();
          };
          return getMs(a) - getMs(b);
        });

        let nextAsc: ExtendedMessage[];

        if (page === 1) {
          nextAsc = _conversationId
            ? mergeLocalCallLogsFromCache(_conversationId, mapped)
            : mapped;
        } else {
          nextAsc = [...mapped, ...allMessages];
        }

        setAllMessages(nextAsc);
        const desc = [...nextAsc].reverse();
        
        setHasMore(
          res.pagination?.hasMore ?? chunk.length >= PAGE_SIZE,
        );
        if (page === 1 && _conversationId) {
          writeThreadMessagesCache(_conversationId, nextAsc);
        }
      } catch (err) {
        console.error('[InboxProvider] fetchMessages error:', err);
      } finally {
        setLoadingMore(false);
      }
    },
    [_conversationId, token, allMessages, useV2Messages, mapHopenityMessage, threadIntroPeer],
  );

  // ─── Pagination ────────────────────────────────────────────────────────────

  const loadEarlier = useCallback(() => {
    if (__DEV__) {
      console.log('[HopeChat DEBUG][inbox] loadEarlier called', { loadingMore, hasMore, nextPage: pageRef.current + 1 });
    }
    if (loadingMore || !hasMore) {
      if (__DEV__) console.log('[HopeChat DEBUG][inbox] loadEarlier BLOCKED', { loadingMore, hasMore });
      return;
    }
    const next = pageRef.current + 1;
    pageRef.current = next;
    fetchMessages(next);
  }, [loadingMore, hasMore, fetchMessages]);

  // ─── Message CRUD ──────────────────────────────────────────────────────────

  const appendMessage = useCallback(
    (msg: ExtendedMessage) => {
      
      setAllMessages(prev => [...prev, msg]);
    },
    [threadIntroPeer],
  );

  /**
   * Append unless the id is already present. The socket push and the 15s poll
   * can both deliver the same row, and GiftedChat renders duplicate keys as
   * duplicate bubbles.
   */
  const appendMessageIfNew = useCallback(
    (msg: ExtendedMessage) => {
      
      setAllMessages(prev =>
        prev.some(m => String(m._id) === String(msg._id)) ? prev : [...prev, msg],
      );
    },
    [threadIntroPeer],
  );

  const updateMessage = useCallback(
    (id: string | number, patch: Partial<ExtendedMessage>) => {
      const apply = (m: ExtendedMessage) =>
        String(m._id) === String(id) ? { ...m, ...patch } : m;
      
      setAllMessages(prev => prev.map(apply));
      bumpRefresh();
    },
    [bumpRefresh, threadIntroPeer],
  );

  /**
   * Send-ack: swap the optimistic client id for the server id. If the poll
   * already inserted the server copy, drop the optimistic bubble instead of
   * ending up with two rows sharing one _id.
   */
  const confirmMessage = useCallback(
    (localId: string | number, patch: Partial<ExtendedMessage>) => {
      const serverId = patch._id != null ? String(patch._id) : null;
      const apply = (list: ExtendedMessage[]) => {
        const serverCopyExists =
          serverId != null &&
          serverId !== String(localId) &&
          list.some(m => String(m._id) === serverId);
        if (serverCopyExists) return list.filter(m => m._id !== localId);
        return list.map(m => (m._id === localId ? { ...m, ...patch } : m));
      };
      
      setAllMessages(prev => apply(prev));
      bumpRefresh();
    },
    [bumpRefresh, threadIntroPeer],
  );

  const deleteMessage = useCallback(
    (id: string | number) => {
      
      setAllMessages(prev => prev.filter(m => String(m._id) !== String(id)));
      bumpRefresh();
    },
    [bumpRefresh, threadIntroPeer],
  );

  useEffect(() => {
    if (!_conversationId) return;
    const sub = DeviceEventEmitter.addListener(
      CALL_OUTCOME_APPLIED_EVENT,
      (payload: CallOutcomeAppliedPayload) => {
        if (payload.conversationId !== _conversationId) return;
        const msg = payload.message;
        appendMessage(msg);
        const preview = String(msg.text ?? '');
        updateConversationPreview(preview, msg.createdAt ?? new Date());
      },
    );
    return () => sub.remove();
  }, [
    _conversationId,
    appendMessage,
    updateConversationPreview,
  ]);

  // ─── Socket: join chat room for real-time message_deleted events ──────────────
  useEffect(() => {
    if (!_conversationId) return;
    callSocket.joinChatRoom(_conversationId);

    // Deleted for everyone: keep a tombstone ("This message was deleted"), like
    // WhatsApp, instead of making the bubble silently vanish.
    const unsubDeleted = callSocket.onMessageDeleted(({ chatId, messageId }) => {
      if (String(chatId) !== String(_conversationId)) return;
      updateMessage(String(messageId), {
        deleted: true,
        text: DELETED_TEXT,
        media: undefined,
        reactions: [],
      });
    });

    // A peer edited a message: apply it instantly instead of waiting for a poll.
    const unsubEdited = callSocket.onMessageEdited(({ chatId, message }) => {
      if (String(chatId) !== String(_conversationId)) return;
      try {
        const mapped = mapHopenityMessageRef.current(message);
        if (!mapped.text || mapped.text.startsWith('🔒')) {
          pollMessagesNow();
          return;
        }
        updateMessage(mapped._id, { text: mapped.text, editedAt: mapped.editedAt });
        DeviceEventEmitter.emit(RELOAD_CHAT_LIST_EVENT);
      } catch {
        pollMessagesNow();
      }
    });

    // Reactions (anyone's, including my other devices) arrive as the full list.
    // Live events and v2 (group) message lists carry only userId + emoji. Ask the
    // reactions endpoint for the people behind them and patch the message.
    const hydrateReactionProfiles = (messageId: string) => {
      if (!token) return;
      void fetchMessageReactions(_conversationId, messageId, token).then(rows => {
        if (!rows.length) {
          pollMessagesNow();
          return;
        }
        const byUser = new Map(rows.map(r => [r.userId, r]));
        setAllMessages(prev =>
          prev.map(m => {
            if (String(m._id) !== String(messageId) || !m.reactions?.length) return m;
            return {
              ...m,
              reactions: m.reactions.map(r => {
                const p = byUser.get(r.userId);
                if (!p) return r;
                return {
                  ...r,
                  userName: r.userName && r.userName !== 'You' ? r.userName : p.userName,
                  avatar: r.avatar || p.avatar || null,
                };
              }),
            };
          }),
        );
        bumpRefresh();
      });
    };

    const unsubReaction = callSocket.onMessageReaction(({ chatId, messageId, reactions, delta }) => {
      // v1 events carry no chatId; the message id is unique enough to match locally.
      if (chatId && String(chatId) !== String(_conversationId)) return;
      if (delta) {
        setAllMessages(prev =>
          prev.map(m => {
            if (String(m._id) !== String(messageId)) return m;
            const others = (m.reactions ?? []).filter(r => r.userId !== delta.userId);
            const prior = (m.reactions ?? []).find(r => r.userId === delta.userId);
            const next = delta.removed
              ? others
              : [...others, { emoji: delta.emoji, userId: delta.userId, userName: prior?.userName ?? '' }];
            return { ...m, reactions: next };
          }),
        );
        bumpRefresh();
        // Live events carry no profile; pull name/photo from the thread fetch.
        if (!delta.removed) hydrateReactionProfiles(messageId);
        return;
      }
      setAllMessages(prev =>
        prev.map(m =>
          String(m._id) !== String(messageId)
            ? m
            : {
                ...m,
                reactions: reactions.map(r => ({
                  emoji: r.emoji,
                  userId: r.userId,
                  // Keep the profile we already know for this person.
                  userName:
                    String(r.userId) === String(localUserIdStr)
                      ? 'You'
                      : (m.reactions ?? []).find(x => x.userId === r.userId)?.userName ?? '',
                })),
              },
        ),
      );
      bumpRefresh();
      if (reactions.length) hydrateReactionProfiles(messageId);
    });

    // Fetch the new message immediately when the socket event arrives, instead
    // of waiting for the 15s poll — this is what made incoming messages feel
    // slower than the sender's own optimistic echo.
    const unsubNew = callSocket.onNewMessage(({ chatId, message }) => {
      if (String(chatId) !== String(_conversationId)) return;

      // The server pushes the whole message row. Render it immediately — the
      // old path threw the payload away and refetched the thread over REST,
      // which added a full round-trip to every incoming message and is what
      // made chatting feel laggy even with both people online.
      if (message) {
        try {
          const mapped = mapHopenityMessage(message);
          // Skip our own echo: the optimistic bubble is already on screen.
          if (String(mapped.user._id) !== String(localUserIdStr)) {
            appendMessageIfNew(mapped);
            // A word I configured, arriving from them, animates on my side too.
            const incomingEffect = matchWordEffect(mapped.text ?? '');
            if (incomingEffect) playWordEffect(incomingEffect.emoji);
            DeviceEventEmitter.emit(RELOAD_CHAT_LIST_EVENT);
            return;
          }
          DeviceEventEmitter.emit(RELOAD_CHAT_LIST_EVENT);
          return;
        } catch {
          // Malformed or an encrypted shape we can't map yet — fall back.
        }
      }

      pollMessagesNow();
      DeviceEventEmitter.emit(RELOAD_CHAT_LIST_EVENT);
    });

    // The peer matched a word effect on their side. The emoji rides along with
    // the event, so it plays here even if this device has no such word saved.
    const unsubWordEffect = callSocket.onWordEffect(({ chatId, emoji, fromUserId }) => {
      if (String(chatId) !== String(_conversationId)) return;
      if (fromUserId && String(fromUserId) === String(localUserIdStr)) return;
      playWordEffect(emoji);
    });

    // The backend suppresses the push banner for a message whenever the recipient's
    // socket is joined to this chat's room (it assumes that means they're already
    // looking at it live). That's correct while the app is foregrounded, but this
    // effect only re-runs on navigation/unmount — backgrounding the app (or just
    // switching to another app) does NOT unmount this screen, so the join lingered
    // forever and every message to this chat silently stopped pushing a notification
    // until the socket eventually dropped. Leave the room the moment the app leaves
    // the foreground, and rejoin if the user comes back to this same screen.
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        callSocket.joinChatRoom(_conversationId);
      } else {
        callSocket.leaveChatRoom(_conversationId);
      }
    });

    return () => {
      callSocket.leaveChatRoom(_conversationId);
      appStateSub.remove();
      unsubDeleted();
      unsubEdited();
      unsubReaction();
      unsubNew();
      unsubWordEffect();
    };
  }, [
    _conversationId,
    appendMessageIfNew,
    deleteMessage,
    updateMessage,
    useV2Messages,
    localUserIdStr,
    mapHopenityMessage,
    playWordEffect,
    pollMessagesNow,
    token,
    bumpRefresh,
  ]);

  // ─── Retro-decrypt: groupCryptoKey is derived asynchronously (after an
  // extra fetchGroupInfo round-trip, or a member-list cache that just caught
  // up with a recent membership change), so a group message can be mapped
  // before the RIGHT key is available. `pendingCipherText` is where the real
  // ciphertext for a still-placeholder message lives (see the mapping above —
  // `.text` itself is only ever the "🔒 Decrypting…" placeholder, never the raw
  // envelope). Retry every such message whenever the key changes.
  useEffect(() => {
    if (!isGroup || !groupCryptoKey) return;
    const decryptPass = (list: ExtendedMessage[]) =>
      list.map(m => {
        // Backward-compat: a message stored before this field existed could
        // still have raw ciphertext sitting directly in `.text`.
        const cipher = m.pendingCipherText ?? (String(m.text ?? '').startsWith('HCG1:') ? m.text : undefined);
        if (!cipher) return m;
        const plain = maybeDecryptGroupContent(cipher, groupCryptoKey);
        if (plain === cipher) return m; // still doesn't open — keep waiting
        return { ...m, text: plain, pendingCipherText: undefined };
      });
    setAllMessages(prev => decryptPass(prev));
    
  }, [groupCryptoKey, isGroup, threadIntroPeer]);

  // ─── Socket: typing indicator ──────────────────────────────────────────────
  useEffect(() => {
    if (!_conversationId) return;

    const unsubTyping = callSocket.onUserTyping(({ chatId, userId }) => {
      if (String(chatId) !== String(_conversationId)) return;
      if (localUserIdStr && String(userId) === String(localUserIdStr)) return;
      setPeerIsTyping(true);
      if (peerTypingTimeoutRef.current) clearTimeout(peerTypingTimeoutRef.current);
      // Safety net in case a stop_typing event is dropped.
      peerTypingTimeoutRef.current = setTimeout(() => setPeerIsTyping(false), 5000);
    });

    const unsubStoppedTyping = callSocket.onUserStoppedTyping(({ chatId, userId }) => {
      if (String(chatId) !== String(_conversationId)) return;
      if (localUserIdStr && String(userId) === String(localUserIdStr)) return;
      if (peerTypingTimeoutRef.current) clearTimeout(peerTypingTimeoutRef.current);
      setPeerIsTyping(false);
    });

    return () => {
      unsubTyping();
      unsubStoppedTyping();
      if (peerTypingTimeoutRef.current) clearTimeout(peerTypingTimeoutRef.current);
      setPeerIsTyping(false);
    };
  }, [_conversationId, localUserIdStr]);

  /** Throttle window for "still typing" pings — see setText. */
  const TYPING_PING_MS = 2500;
  /** Silence after which the peer's indicator should clear. */
  const TYPING_STOP_MS = 2000;

  const setText = useCallback(
    (t: string) => {
      if (!_conversationId || !localUserIdStr) return;

      // Throttled: this fired a socket emit on EVERY keystroke, so a normal
      // sentence sent 40+ messages, each of which the server answered with two
      // database queries to resolve participants. One ping every 2.5s conveys
      // exactly the same thing — the peer's indicator is refreshed well inside
      // its own 5s safety timeout.
      const now = Date.now();
      if (now - lastTypingPingRef.current > TYPING_PING_MS) {
        lastTypingPingRef.current = now;
        callSocket.emitTyping(_conversationId, localUserIdStr);
      }

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        // Allow the next keystroke after the pause to ping immediately.
        lastTypingPingRef.current = 0;
        callSocket.emitStopTyping(_conversationId, localUserIdStr);
      }, TYPING_STOP_MS);
    },
    [_conversationId, localUserIdStr],
  );

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      // Leaving the thread mid-word used to leave the peer's indicator running
      // until their 5s fallback — tell them explicitly.
      if (_conversationId && localUserIdStr && lastTypingPingRef.current > 0) {
        lastTypingPingRef.current = 0;
        callSocket.emitStopTyping(_conversationId, localUserIdStr);
      }
    };
  }, [_conversationId, localUserIdStr]);

  // ─── Edit text ─────────────────────────────────────────────────────────────

  const submitEdit = useCallback(
    async (target: ExtendedMessage, nextText: string) => {
      const plain = nextText.trim();
      const prevText = target.text ?? '';
      const prevEditedAt = target.editedAt;
      if (!plain || plain === prevText) return;

      // Optimistic update; rolled back if the server rejects it.
      updateMessage(target._id, { text: plain, editedAt: new Date().toISOString() });

      if (!_conversationId || !token) return;
      let wire = plain;
      if (shouldEncryptOutgoing) {
        wire = isGroup
          ? encryptGroupMessage(plain, groupCryptoKey!)
          : encryptMessagePayload(plain, dmCryptoKey!);
      }
      const { ok, editedAt, error } = await editHopenityChatMessage(
        target._id,
        wire,
        token,
        useV2Messages,
      );
      if (!ok) {
        updateMessage(target._id, { text: prevText, editedAt: prevEditedAt });
        Alert.alert('Could not edit', error ?? 'Please try again.');
        return;
      }
      if (editedAt) updateMessage(target._id, { editedAt });
      DeviceEventEmitter.emit(RELOAD_CHAT_LIST_EVENT);
    },
    [
      updateMessage,
      _conversationId,
      token,
      shouldEncryptOutgoing,
      isGroup,
      groupCryptoKey,
      dmCryptoKey,
      useV2Messages,
    ],
  );

  // ─── Send text / media ─────────────────────────────────────────────────────

  /** Encrypt + POST one already-appended (optimistic) message. Also used by retry. */
  const deliverMessage = useCallback(
    (stamped: ExtendedMessage, replyToId: string | number | null) => {
      if (!_conversationId || !token) return;
          const plain = String(stamped.text ?? '');
          void (async () => {
          let wire = plain;
          if (isE2eeEnabled() && plain.length > 0) {
            if (isGroup) {
              // Sender keys (HCG2) — one ciphertext for the whole group, and a
              // key the server never sees. The legacy group key derived from the
              // group id + member list, both of which the server knows, so it
              // could read every group message; it stays only as a fallback for
              // members who have not updated yet.
              const sealed = _conversationId && localUserIdStr
                ? encryptGroupOutgoing(_conversationId, localUserIdStr, plain)
                : null;
              if (sealed) {
                wire = sealed;
                rememberOwnMessage(String(stamped._id), plain);
              } else {
                const gk = await resolveGroupKey();
                if (gk) wire = encryptGroupMessage(plain, gk);
              }
            } else if (peerUserId && token) {
              // Real end-to-end (HC2) when the peer has published keys.
              const keys = await resolvePeerKeys(token, _conversationId, peerUserId);
              if (keys.mode === 'blocked') {
                // This conversation has been encrypted before and the peer's
                // keys have vanished. That is what a downgrade attack looks
                // like, so refuse to send rather than fall back to the weaker
                // scheme behind the user's back.
                updateMessage(stamped._id, { pending: false, failed: true });
                Toast.error('Could not send securely. Try again in a moment.');
                return;
              }
              if (keys.mode === 'e2ee') {
                // Seal for EVERY device the peer has published, not just the
                // newest: a session is between two devices, so a copy sealed for
                // their phone is unreadable on their tablet.
                const all = cachedPeerBundles(peerUserId);
                const sealed =
                  all.length > 1
                    ? encryptOutgoingMultiDevice(_conversationId, all, plain)
                    : encryptOutgoing(_conversationId, keys.bundle, plain);
                // Remember our own plaintext: the ratchet key for a message we
                // sent is consumed, so this is the only way to render it back.
                if (sealed) {
                  wire = sealed;
                  rememberOwnMessage(String(stamped._id), plain);
                } else if (dmCryptoKey) {
                  wire = encryptMessagePayload(plain, dmCryptoKey);
                }
              } else if (dmCryptoKey) {
                // Peer has not updated yet — legacy scheme keeps the
                // conversation working instead of breaking it on day one.
                wire = encryptMessagePayload(plain, dmCryptoKey);
              }
            } else if (dmCryptoKey) {
              wire = encryptMessagePayload(plain, dmCryptoKey);
            }
          }
          sendHopenityChatMessage(_conversationId, wire, token, activePage?.id ?? null, useV2Messages, replyToId, null, stamped._id)
            .then(res => {
              if (!res) {
                updateMessage(stamped._id, { pending: false, failed: true });
                return;
              }

              const parsed = mapApiMessageToTimeline(
                res as Record<string, unknown>,
              );
              const resDict = res as Record<string, unknown>;
              const ackSender =
                extractMessageSenderId(resDict) ||
                String(res.senderId ?? resDict.sender_id ?? '').trim();
              const ackUid =
                ackSender !== ''
                  ? normalizeChatUserId(ackSender) || ackSender
                  : normalizeChatUserId(localUserIdStr) || localUserIdStr;
              const ackName =
                (res.sender as { name?: string } | undefined)?.name ??
                (typeof stamped.user?.name === 'string' ? stamped.user.name : user.name);
              confirmMessage(stamped._id, {
                pending: false,
                _id: String(res.id ?? stamped._id),
                createdAt: res.createdAt ? new Date(res.createdAt) : stamped.createdAt,
                user: {
                  _id: ackUid,
                  name: typeof ackName === 'string' ? ackName : 'You',
                },
                ...(parsed.delivery ? { delivery: parsed.delivery } : {}),
              });
            })
            .catch(err => {
              console.error('[InboxProvider] send message error:', err);
              updateMessage(stamped._id, { pending: false, failed: true });
            });
          })();
    },
    [
      _conversationId,
      token,
      isGroup,
      localUserIdStr,
      peerUserId,
      resolveGroupKey,
      dmCryptoKey,
      activePage?.id,
      useV2Messages,
      updateMessage,
      confirmMessage,
      user.name,
    ],
  );

  /** Tap-to-retry for a bubble that failed to send. */
  const retryMessage = useCallback(
    (message: IMessage) => {
      const msg = message as ExtendedMessage;
      if (!msg.failed) return;
      updateMessage(msg._id, { pending: true, failed: false });
      deliverMessage(msg, msg.replyTo?._id ?? null);
    },
    [updateMessage, deliverMessage],
  );

  const onSend = useCallback(
    (outgoing: ExtendedMessage[] = []) => {
      if (!outgoing.length) return;

      if (editingMessage) {
        const target = editingMessage;
        setEditingMessage(null);
        submitEdit(target, String(outgoing[0]?.text ?? ''));
        return;
      }

      if (_conversationId && localUserIdStr) {
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        callSocket.emitStopTyping(_conversationId, localUserIdStr);
      }

      const currentReplyTo = replyTo
        ? {
            _id: replyTo._id,
            text: replyTo.text ?? '',
            media: replyTo.media,
            user: replyTo.user,
          }
        : undefined;

      // Word effects: match on what I typed, animate here, and relay the emoji so
      // the other person sees the same burst without configuring the word.
      outgoing.forEach(msg => {
        const effect = matchWordEffect(msg.text ?? '');
        if (effect) {
          playWordEffect(effect.emoji);
          if (_conversationId) {
            callSocket.emitWordEffect(_conversationId, effect.emoji, effect.word);
          }
        }
      });

      outgoing.forEach(msg => {
        const uid =
          normalizeChatUserId(msg.user?._id ?? user._id) || user._id;
        const stamped: ExtendedMessage = {
          ...msg,
          createdAt: msg.createdAt ?? new Date(),
          user: {
            ...msg.user,
            _id: uid,
            name:
              typeof msg.user?.name === 'string'
                ? msg.user.name
                : typeof user.name === 'string'
                  ? user.name
                  : 'You',
          },
          pending: true,
          replyTo: currentReplyTo,
        };

        appendMessage(stamped);
        updateConversationPreview(
          formatChatListPreview(
            {
              content: String(stamped.text ?? ''),
              senderId: localUserIdStr,
            },
            localUserIdStr,
          ),
          stamped.createdAt ?? new Date(),
        );

        if (_conversationId && token) {
          deliverMessage(stamped, currentReplyTo?._id ?? null);
        } else {
          setTimeout(() => updateMessage(stamped._id, { pending: false }), 800);
        }
      });

      dispatch(resetReplayTo());
    },
    [
      editingMessage,
      submitEdit,
      user._id,
      user.name,
      replyTo,
      appendMessage,
      updateMessage,
      confirmMessage,
      dispatch,
      _conversationId,
      token,
      updateConversationPreview,
      localUserIdStr,
      deliverMessage,
      groupCryptoKey,
      isGroup,
      playWordEffect,
    ],
  );

  // ─── Send voice ────────────────────────────────────────────────────────────

  const sendVoiceMessage = useCallback(
    async (audioPath: string, duration: number) => {
      const msg: ExtendedMessage = {
        _id: `voice_${Date.now()}`,
        text: '',
        createdAt: new Date(),
        user: { _id: user._id },
        media: {
          type: 'voice',
          localUri: audioPath,
          duration,
          uploading: true,
        },
        pending: true,
      };

      appendMessage(msg);
      updateConversationPreview(
        formatChatListPreview(
          {
            messageType: 'voice',
            durationSeconds: duration,
            senderId: localUserIdStr,
          },
          localUserIdStr,
        ),
        msg.createdAt ?? new Date(),
      );

      if (_conversationId && token) {
        try {
          const remoteUri = await uploadChatMedia(audioPath, 'voice', token);
          if (remoteUri) {
            // Stay `pending` until the server ack so the thread poll can still
            // recognise this bubble as the echo of the sent message.
            updateMessage(msg._id, {
              media: {
                ...msg.media!,
                remoteUri,
                uploading: false,
              },
            });
            let wire = remoteUri;
            if (shouldEncryptOutgoing) {
              // Media URLs go through the SAME scheme as text. Leaving them on
              // the old key meant an upgraded conversation protected what was
              // said and leaked every photo, video and voice note in it — worse
              // than not claiming protection at all.
              let sealedMedia: string | null = null;
              if (isGroup && _conversationId && localUserIdStr) {
                sealedMedia = encryptGroupOutgoing(_conversationId, localUserIdStr, remoteUri);
              } else if (peerUserId && token && _conversationId) {
                const keys = await resolvePeerKeys(token, _conversationId, peerUserId);
                if (keys.mode === 'e2ee') {
                  const all = cachedPeerBundles(peerUserId);
                  sealedMedia =
                    all.length > 1
                      ? encryptOutgoingMultiDevice(_conversationId, all, remoteUri)
                      : encryptOutgoing(_conversationId, keys.bundle, remoteUri);
                }
              }
              wire = sealedMedia
                ? sealedMedia
                : isGroup
                  ? encryptGroupMessage(remoteUri, groupCryptoKey!)
                  : encryptMessagePayload(remoteUri, dmCryptoKey!);
            }
            const sent = await sendHopenityChatMessage(
              _conversationId,
              wire,
              token,
              activePage?.id ?? null,
              useV2Messages,
            );
            if (sent?.id) {
              const p = mapApiMessageToTimeline(
                sent as Record<string, unknown>,
              );
              const sDict = sent as Record<string, unknown>;
              const ackSender =
                extractMessageSenderId(sDict) ||
                String(sent.senderId ?? '').trim();
              const ackUid =
                ackSender !== ''
                  ? normalizeChatUserId(ackSender) || ackSender
                  : normalizeChatUserId(localUserIdStr) || localUserIdStr;
              const ackName =
                (sent.sender as { name?: string } | undefined)?.name ??
                (typeof user.name === 'string' ? user.name : 'You');
              confirmMessage(msg._id, {
                pending: false,
                _id: String(sent.id),
                createdAt: sent.createdAt ? new Date(sent.createdAt) : msg.createdAt,
                user: { _id: ackUid, name: ackName },
                ...(p.delivery ? { delivery: p.delivery } : {}),
              });
            } else {
              updateMessage(msg._id, { pending: false });
            }
            return;
          }
        } catch (err) {
          console.error('[InboxProvider] voice upload error:', err);
        }
      }

      updateMessage(msg._id, {
        media: { ...msg.media!, uploading: false, error: true },
        pending: false,
        failed: true,
      });
    },
    [
      user._id,
      user.name,
      appendMessage,
      updateMessage,
      confirmMessage,
      updateConversationPreview,
      _conversationId,
      token,
      localUserIdStr,
      shouldEncryptOutgoing,
      dmCryptoKey,
      groupCryptoKey,
      isGroup,
    ],
  );

  // ─── Send media (image / video) ────────────────────────────────────────────

  const sendMediaMessage = useCallback(
    async (localUri: string, mediaType: 'image' | 'video', thumbnail?: string) => {
      const msg: ExtendedMessage = {
        _id: `media_${Date.now()}`,
        text: '',
        createdAt: new Date(),
        user: { _id: user._id },
        media: { type: mediaType, localUri, thumbnail, uploading: true },
        pending: true,
      };

      appendMessage(msg);
      updateConversationPreview(
        formatChatListPreview(
          {
            content:
              mediaType === 'image'
                ? 'https://x/p.jpg'
                : 'https://x/v.mp4',
            senderId: localUserIdStr,
          },
          localUserIdStr,
        ),
        msg.createdAt ?? new Date(),
      );

      if (_conversationId && token) {
        try {
          const remoteUri = await uploadChatMedia(localUri, mediaType, token);
          if (remoteUri) {
            // Stay `pending` until the server ack so the thread poll can still
            // recognise this bubble as the echo of the sent message.
            updateMessage(msg._id, {
              media: {
                ...msg.media!,
                remoteUri,
                url: remoteUri,
                uploading: false,
              },
            });
            let wire = remoteUri;
            if (shouldEncryptOutgoing) {
              // Media URLs go through the SAME scheme as text. Leaving them on
              // the old key meant an upgraded conversation protected what was
              // said and leaked every photo, video and voice note in it — worse
              // than not claiming protection at all.
              let sealedMedia: string | null = null;
              if (isGroup && _conversationId && localUserIdStr) {
                sealedMedia = encryptGroupOutgoing(_conversationId, localUserIdStr, remoteUri);
              } else if (peerUserId && token && _conversationId) {
                const keys = await resolvePeerKeys(token, _conversationId, peerUserId);
                if (keys.mode === 'e2ee') {
                  const all = cachedPeerBundles(peerUserId);
                  sealedMedia =
                    all.length > 1
                      ? encryptOutgoingMultiDevice(_conversationId, all, remoteUri)
                      : encryptOutgoing(_conversationId, keys.bundle, remoteUri);
                }
              }
              wire = sealedMedia
                ? sealedMedia
                : isGroup
                  ? encryptGroupMessage(remoteUri, groupCryptoKey!)
                  : encryptMessagePayload(remoteUri, dmCryptoKey!);
            }
            const sent = await sendHopenityChatMessage(
              _conversationId,
              wire,
              token,
              activePage?.id ?? null,
              useV2Messages,
            );
            if (sent?.id) {
              const p = mapApiMessageToTimeline(
                sent as Record<string, unknown>,
              );
              const sDict = sent as Record<string, unknown>;
              const ackSender =
                extractMessageSenderId(sDict) ||
                String(sent.senderId ?? '').trim();
              const ackUid =
                ackSender !== ''
                  ? normalizeChatUserId(ackSender) || ackSender
                  : normalizeChatUserId(localUserIdStr) || localUserIdStr;
              const ackName =
                (sent.sender as { name?: string } | undefined)?.name ??
                (typeof user.name === 'string' ? user.name : 'You');
              confirmMessage(msg._id, {
                pending: false,
                _id: String(sent.id),
                createdAt: sent.createdAt ? new Date(sent.createdAt) : msg.createdAt,
                user: { _id: ackUid, name: ackName },
                ...(p.delivery ? { delivery: p.delivery } : {}),
              });
            } else {
              updateMessage(msg._id, { pending: false });
            }
            return;
          }
        } catch (err) {
          console.error('[InboxProvider] media upload error:', err);
        }
      }

      updateMessage(msg._id, {
        media: { ...msg.media!, uploading: false, error: true },
        pending: false,
        failed: true,
      });
    },
    [
      user._id,
      user.name,
      appendMessage,
      updateMessage,
      confirmMessage,
      updateConversationPreview,
      _conversationId,
      token,
      localUserIdStr,
      shouldEncryptOutgoing,
      dmCryptoKey,
      groupCryptoKey,
      isGroup,
    ],
  );

  // ─── Reaction ──────────────────────────────────────────────────────────────

  const handleReact = useCallback(
    (emoji: string, message: IMessage) => {
      const msg = message as ExtendedMessage;
      if (msg.deleted || msg.pending || msg.failed) return;
      const existing = msg.reactions ?? [];
      const uid = String(user._id);
      const mine = existing.find(r => r.userId === uid);

      // One reaction per person (matches the server): same emoji toggles off,
      // a different emoji replaces theirs.
      const others = existing.filter(r => r.userId !== uid);
      const updated =
        mine && mine.emoji === emoji
          ? others
          : [
              ...others,
              {
                emoji,
                userId: uid,
                userName: typeof user.name === 'string' ? user.name : 'You',
              },
            ];

      updateMessage(msg._id, { reactions: updated });

      if (!token) return;
      void reactToMessage(msg._id, emoji, token, useV2Messages).then(ok => {
        if (ok) return;
        // Roll back so the UI doesn't claim a reaction the server rejected.
        updateMessage(msg._id, { reactions: existing });
      });
    },
    [user._id, user.name, updateMessage, token, useV2Messages],
  );

  // ─── Reply ─────────────────────────────────────────────────────────────────

  const handleReply = useCallback(
    (message: IMessage) => {
      const msg = message as ExtendedMessage;
      // The message list normally holds already-decrypted text, but if the
      // group/DM key hadn't resolved yet when this particular message was
      // mapped, `.text` can still be raw ciphertext. Since the reply preview
      // snapshots `.text` once into redux (it isn't reactive to later
      // retro-decrypt passes), a stale snapshot would show ciphertext
      // forever — so re-attempt decryption right here with whatever key is
      // available now, on the way in.
      let text = msg.text ?? '';
      if (text.startsWith('HC1:') && dmCryptoKey) {
        text = maybeDecryptContent(text, dmCryptoKey);
      } else if (text.startsWith('HCG1:')) {
        const attempt = groupCryptoKey ? maybeDecryptGroupContent(text, groupCryptoKey) : text;
        text = attempt === text ? '🔒 Decrypting…' : attempt;
      }
      setEditingMessage(null);
      dispatch(
        setReplayTo({
          _id: msg._id,
          text,
          media: msg.media,
          user: msg.user,
          createdAt: new Date(msg.createdAt as Date).toISOString(),
        }),
      );
    },
    [dispatch, dmCryptoKey, groupCryptoKey],
  );

  const clearReply = useCallback(() => {
    dispatch(resetReplayTo());
  }, [dispatch]);

  // ─── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = useCallback(
    (message: IMessage) => {
      const msg = message as ExtendedMessage;
      const isMine = String(msg.user?._id ?? '') === String(localUserIdStr ?? '');
      // No time limit: the sender can delete for everyone at any time.
      const canDeleteForEveryone = isMine && !msg.deleted && !msg.pending && !msg.failed;
      const id = String(message._id);

      const deleteForMe = async () => {
        const prevList = [...allMessagesRef.current];
        deleteMessage(id);
        const { ok, error } = await deleteHopenityChatMessage(id, token, {
          scope: 'me',
          v2: useV2Messages,
        });
        if (!ok) {
          Alert.alert('Could not delete', error ?? 'Please try again.');
          // Put it back: the server still has it visible.
          setAllMessages(prevList);
          
        }
      };

      const deleteForEveryone = async () => {
        const before = { text: msg.text, media: msg.media, reactions: msg.reactions };
        // Optimistic tombstone — both sides then show "This message was deleted".
        updateMessage(id, { deleted: true, text: DELETED_TEXT, media: undefined, reactions: [] });
        const { ok, error } = await deleteHopenityChatMessage(id, token, {
          scope: 'everyone',
          v2: useV2Messages,
        });
        if (!ok) {
          updateMessage(id, { deleted: false, ...before });
          Alert.alert('Could not delete', error ?? 'Please try again.');
        } else {
          DeviceEventEmitter.emit(RELOAD_CHAT_LIST_EVENT);
        }
      };

      const buttons: Array<{ text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }> = [];
      if (canDeleteForEveryone) {
        buttons.push({ text: 'Delete for everyone', style: 'destructive', onPress: deleteForEveryone });
      }
      buttons.push({ text: 'Delete for me', style: 'destructive', onPress: deleteForMe });
      buttons.push({ text: 'Cancel', style: 'cancel' });
      Alert.alert(
        'Delete message?',
        canDeleteForEveryone
          ? 'Delete for everyone removes it for all members. Delete for me only removes it from your view.'
          : 'This removes the message from your view only.',
        buttons,
      );
    },
    [deleteMessage, updateMessage, token, localUserIdStr, useV2Messages, threadIntroPeer],
  );

  // ─── Edit ──────────────────────────────────────────────────────────────────

  const canEditMessage = useCallback(
    (message: IMessage) => {
      const msg = message as ExtendedMessage;
      const isMine = String(msg.user?._id ?? '') === String(localUserIdStr ?? '');
      const isPlainText =
        !msg.media &&
        !msg.threadIntro &&
        !msg.donationRequest &&
        (msg.messageKind == null || msg.messageKind === 'text');
      return isMine && isPlainText && !msg.deleted && !msg.pending && !msg.failed && !!msg.text;
    },
    [localUserIdStr],
  );

  const handleEdit = useCallback(
    (message: IMessage) => {
      if (!canEditMessage(message)) return;
      const msg = message as ExtendedMessage;
      dispatch(resetReplayTo());
      setEditingMessage(msg);
      // Prefill the composer with the current text (GiftedChat syncs `text` prop into its state).
      setInitialText(msg.text ?? '');
    },
    [canEditMessage, dispatch],
  );

  const cancelEdit = useCallback(() => {
    setEditingMessage(null);
  }, []);

  // ─── Forward ───────────────────────────────────────────────────────────────

  const handleForward = useCallback((message: IMessage) => {
    setForwardingMessage(message as ExtendedMessage);
  }, []);

  // ─── Scroll to reply ───────────────────────────────────────────────────────

  const scrollToMessageFnRef = useRef<((id: string | number) => void) | null>(null);

  const registerScrollToMessage = useCallback(
    (fn: (id: string | number) => void) => {
      scrollToMessageFnRef.current = fn;
    },
    [],
  );

  const handlePressReplyPreview = useCallback((messageId: string | number) => {
    scrollToMessageFnRef.current?.(messageId);
  }, []);

  // ─── Camera ────────────────────────────────────────────────────────────────

/**
 * Gallery videos are NOT compressed.
 *
 * react-native-image-picker's `quality` / `maxWidth` / `maxHeight` apply to
 * images only, and `videoQuality` only affects what the CAMERA records — a video
 * chosen from the gallery is handed over at its original size. A phone-shot clip
 * is easily 100 MB+, and pushing that through one multipart POST on a mobile
 * uplink is what made "video won't send" look like a silent failure.
 *
 * Until a real transcode step exists, refuse oversized clips with a message the
 * user can act on instead of letting them stall.
 */
const MAX_VIDEO_UPLOAD_BYTES = 100 * 1024 * 1024;

function videoTooLarge(sizeBytes?: number | null): boolean {
  return typeof sizeBytes === 'number' && sizeBytes > MAX_VIDEO_UPLOAD_BYTES;
}

const VIDEO_EXTENSIONS =
  /\.(mp4|mov|m4v|3gp|3g2|mkv|webm|avi|wmv|flv|mpeg|mpg|ts|ogv|qt)(\?|$)/i;

/**
 * Is this picked asset a video?
 *
 * `asset.type` alone is NOT reliable and relying on it is what broke video
 * sending. react-native-image-picker copies a picked video to app storage and
 * then derives its `type` via Android's `getMimeTypeFromExtension`, which
 * returns null for plenty of ordinary paths (unrecognised or upper-case
 * extension, characters that trip `getFileExtensionFromUrl`). With `type` null,
 * `type?.startsWith('video')` is false, so the clip took the IMAGE branch and
 * was uploaded as `image/jpeg` named `.jpg` — the server stored a "photo" that
 * was really an MP4, and the bubble rendered as a broken image.
 *
 * So we corroborate with two things the picker fills in independently:
 * the file extension, and `duration` — which is present ONLY on
 * `getVideoResponseMap`, never on an image asset.
 */
function isVideoAsset(asset: {
  type?: string | null;
  uri?: string | null;
  fileName?: string | null;
  duration?: number | null;
}): boolean {
  if (asset.type?.toLowerCase().startsWith('video')) return true;
  if (typeof asset.duration === 'number' && asset.duration > 0) return true;
  const name = asset.fileName ?? asset.uri ?? '';
  return VIDEO_EXTENSIONS.test(name);
}

  const handleCameraPress = useCallback(async () => {
    const ok = await checkCameraPermission();
    if (!ok) return;

    launchCamera(
      {
        mediaType: 'mixed' as MediaType,
        videoQuality: 'low',
        quality: 0.8,
        // Downscale before upload. Without a cap a 12MP camera photo goes up at
        // full resolution (4–8 MB), which is why sending an image felt slow;
        // the picker resizes natively, so this costs nothing on-device.
        maxWidth: 1600,
        maxHeight: 1600,
      },
      response => {
        if (response.didCancel || response.errorCode) return;
        const asset = response.assets?.[0];
        if (!asset?.uri) return;
        const isVideo = isVideoAsset(asset);
        if (isVideo && videoTooLarge(asset.fileSize)) {
          Toast.error('That video is too large to send. Try a shorter clip.');
          return;
        }
        void sendMediaMessage(asset.uri, isVideo ? 'video' : 'image');
      },
    );
  }, [sendMediaMessage]);

  // ─── Gallery ───────────────────────────────────────────────────────────────

  const handleGalleryPress = useCallback(async () => {
    launchImageLibrary(
      {
        mediaType: 'mixed' as MediaType,
        selectionLimit: 10,   // up to 10 at once (WhatsApp-style)
        quality: 0.8,
        videoQuality: 'low',  // hardware-compress videos before upload
        // Same cap as the camera path — gallery originals are just as large.
        maxWidth: 1600,
        maxHeight: 1600,
      },
      response => {
        if (response.didCancel || response.errorCode) return;
        const assets = response.assets ?? [];
        if (assets.length === 0) return;
        // Genuinely sequential. `assets.forEach(sendMediaMessage)` fired all ten
        // uploads at once despite the comment claiming otherwise: on a mobile
        // uplink that makes every one of them slower, and a burst of parallel
        // multipart POSTs is what tips a large batch into timeouts. One at a
        // time is faster end-to-end and actually preserves order.
        void (async () => {
          let skipped = 0;
          for (const asset of assets) {
            if (!asset?.uri) continue;
            const isVideo = isVideoAsset(asset);
            if (isVideo && videoTooLarge(asset.fileSize)) {
              skipped += 1;
              continue;
            }
            await sendMediaMessage(asset.uri, isVideo ? 'video' : 'image');
          }
          if (skipped > 0) {
            Toast.error(
              skipped === 1
                ? 'One video was too large to send.'
                : `${skipped} videos were too large to send.`,
            );
          }
        })();
      },
    );
  }, [sendMediaMessage]);

  // ─── Seller product share sheet ────────────────────────────────────────────

  const [sellerSheetVisible, setSellerSheetVisible] = useState(false);
  const openSellerSheet = useCallback(() => setSellerSheetVisible(true), []);
  const closeSellerSheet = useCallback(() => setSellerSheetVisible(false), []);

  // ─── Voice recording lifecycle ─────────────────────────────────────────────

  const handleVoiceRecordingStart = useCallback(async () => {
    const ok = await checkMicrophonePermission();
    if (!ok) return;
    setIsRecording(true);
    animateInput(1);
  }, [animateInput]);

  const handleVoiceRecordingComplete = useCallback(
    (path: string, duration: number) => {
      setIsRecording(false);
      animateInput(0);
      sendVoiceMessage(path, duration);
    },
    [animateInput, sendVoiceMessage],
  );

  const handleVoiceRecordingCancel = useCallback(() => {
    setIsRecording(false);
    animateInput(0);
  }, [animateInput]);

  // ── Long press → open tray
  const handleLongPress: HandleLongPress = useCallback(
    (setReactionTrayStyle, openTray, isRight) => {
      swipeRef.current?.close();
      wrapRef.current?.measure((_x, _y, w, h, pageX, pageY) => {
        const trayStyle = {
          top: pageY - 68,
          ...(isRight
            ? { right: Math.max(10, CHAT_SCREEN_WIDTH - pageX - w) }
            : { left: Math.max(10, pageX) }),
        };
        console.log(trayStyle);
        setReactionTrayStyle(trayStyle);
        openTray();
      });
    },
    [],
  );

  const value = useMemo(
    () => ({
      // State
      messages: messagesForUi,
      setText,
      initialText,
      setInitialText,
      user,
      insets,
      width,
      refreshTrigger,
      isRecording,
      inputAnimation,
      loadingMore,
      hasMore,
      replyTo,
      peerIsTyping,
      wordEffect,
  
      // Message CRUD
      onSend,
      retryMessage,
      loadEarlier,
      updateMessage,
      deleteMessage,
  
      // Actions
      handleReact,
      handleReply,
      clearReply,
      handleDelete,
      canEditMessage,
      handleEdit,
      cancelEdit,
      editingMessage,
      handleForward,
      forwardingMessage,
      clearForwarding,
      handlePressReplyPreview,
      handleLongPress,
  
      // Media
      handleCameraPress,
      handleGalleryPress,
      sellerSheetVisible,
      openSellerSheet,
      closeSellerSheet,
  
      // Voice
      handleVoiceRecordingStart,
      handleVoiceRecordingComplete,
      handleVoiceRecordingCancel,
  
      reactionEmojiRow,
      conversationId: _conversationId,
  
      isEncrypted: shouldEncryptOutgoing,
  
      registerScrollToMessage,
  
      // refs
      wrapRef,
      swipeRef,}),
    [
      messagesForUi,
      setText,
      initialText,
      setInitialText,
      user,
      insets,
      width,
      refreshTrigger,
      isRecording,
      inputAnimation,
      loadingMore,
      hasMore,
      replyTo,
      peerIsTyping,
      wordEffect,
      onSend,
      retryMessage,
      loadEarlier,
      updateMessage,
      deleteMessage,
      handleReact,
      handleReply,
      clearReply,
      handleDelete,
      canEditMessage,
      handleEdit,
      cancelEdit,
      editingMessage,
      handleForward,
      forwardingMessage,
      clearForwarding,
      handlePressReplyPreview,
      handleLongPress,
      handleCameraPress,
      handleGalleryPress,
      sellerSheetVisible,
      openSellerSheet,
      closeSellerSheet,
      handleVoiceRecordingStart,
      handleVoiceRecordingComplete,
      handleVoiceRecordingCancel,
      reactionEmojiRow,
      _conversationId,
      shouldEncryptOutgoing,
      registerScrollToMessage,
      wrapRef,
      swipeRef,
    ],
  );

  return (
    <InboxContext.Provider value={value}>{children}</InboxContext.Provider>
  );
}
