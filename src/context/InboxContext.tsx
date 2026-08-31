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
  DeviceEventEmitter,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IMessage } from 'react-native-gifted-chat';
import { Toast } from '../components/Toast';
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
  fetchHopenityChatMessages,
  formatChatTime,
  markHopenityChatRead,
  reactToMessage,
  sendHopenityChatMessage,
  uploadChatMedia,
} from '../services/chatService';
import {
  selectAuthToken,
  selectHopenityProfile,
  selectActivePage,
} from '../redux/features/auth/authSlice';
import { normalizeChatUserId } from '../utils/chatUserId';
import {
  readCachedGroupMembers,
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
  deriveGroupMessageKey,
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
  text: string;
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
  updateMessage: (id: string | number, patch: Partial<ExtendedMessage>) => void;
  deleteMessage: (id: string | number) => void;

  // ── Actions
  handleReact: (emoji: string, message: IMessage) => void;
  handleReply: (message: IMessage) => void;
  clearReply: () => void;
  handleDelete: (message: IMessage) => void;
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

interface ThreadIntroPeer {
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

const INTRO_MESSAGE_ID = '__hopenity_thread_intro';

function buildThreadIntroMessage(peer: ThreadIntroPeer): ExtendedMessage {
  const first = peer.name.split(/\s+/)[0] || peer.name;
  return {
    _id: INTRO_MESSAGE_ID,
    threadIntro: {
      peerName: peer.name,
      subtitle: peer.subtitle ?? "You're friends on Hopenity",
      avatarUrl: peer.avatarUrl ?? null,
    },
    text: peer.prompt ?? `Say hi to your new Hopenity friend, ${first}.`,
    createdAt: new Date(1),
    user: { _id: '__hopenity_intro', name: 'Hopenity' },
  };
}

function stripIntro(descNewestFirst: ExtendedMessage[]): ExtendedMessage[] {
  return descNewestFirst.filter(m => m._id !== INTRO_MESSAGE_ID);
}

function createdAtMs(t: unknown): number {
  return t instanceof Date
    ? t.getTime()
    : new Date(t as string | number).getTime();
}

/**
 * True when `server` (fresh from the API) is the echo of a still-pending
 * optimistic bubble: same sender, same visible content, within 2 minutes.
 * Content matching is required because the optimistic _id is client-generated
 * and the send ack that swaps it for the server id can lose the race against
 * the thread poll — matching by _id alone rendered every sent message twice.
 */
function isServerEchoOfPending(
  pending: ExtendedMessage,
  server: ExtendedMessage,
): boolean {
  const pUid =
    normalizeChatUserId(pending.user?._id) || String(pending.user?._id ?? '');
  const sUid =
    normalizeChatUserId(server.user?._id) || String(server.user?._id ?? '');
  if (!pUid || !sUid) return false;
  const sameSender =
    pUid === sUid ||
    (/^\d+$/.test(pUid) && /^\d+$/.test(sUid) && Number(pUid) === Number(sUid));
  if (!sameSender) return false;
  const dt = Math.abs(createdAtMs(server.createdAt) - createdAtMs(pending.createdAt));
  if (!Number.isFinite(dt) || dt > 2 * 60 * 1000) return false;
  const pText = String(pending.text ?? '').trim();
  const sText = String(server.text ?? '').trim();
  if (pText && sText && pText === sText) return true;
  const pMediaUrl = pending.media?.remoteUri ?? pending.media?.url ?? '';
  const sMediaUrl = server.media?.remoteUri ?? server.media?.url ?? '';
  if (pMediaUrl && sMediaUrl && pMediaUrl === sMediaUrl) return true;
  // Media messages travel as a bare URL in `content`.
  if (pMediaUrl && sText && pMediaUrl === sText) return true;
  return false;
}

/**
 * Merge freshly fetched messages into `prev` (both ascending). Rows whose id we
 * already have are dropped; a server row that matches a still-pending optimistic
 * bubble REPLACES it in place instead of appearing next to it.
 * Returns null when nothing changed.
 */
function mergeFetchedAsc(
  prev: ExtendedMessage[],
  fetchedAsc: ExtendedMessage[],
): ExtendedMessage[] | null {
  const existingIds = new Set(prev.map(m => String(m._id)));
  const fresh = fetchedAsc.filter(m => !existingIds.has(String(m._id)));
  if (fresh.length === 0) return null;
  const next = [...prev];
  const appended: ExtendedMessage[] = [];
  for (const srv of fresh) {
    const i = next.findIndex(
      m => (m.pending || m.failed) && isServerEchoOfPending(m, srv),
    );
    if (i >= 0) next[i] = srv;
    else appended.push(srv);
  }
  if (appended.length === 0) return next;
  const combined = [...next, ...appended];
  combined.sort((a, b) => createdAtMs(a.createdAt) - createdAtMs(b.createdAt));
  return combined;
}

/** Gifted Chat is newest-first; intro is oldest timestamp so it appears at top visually. */
function mergeIntroDesc(
  descNewestFirst: ExtendedMessage[],
  peer?: ThreadIntroPeer,
): ExtendedMessage[] {
  if (!peer?.name?.trim()) return descNewestFirst;
  const intro = buildThreadIntroMessage(peer);
  return [...descNewestFirst, intro];
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
    const cached = readCachedGroupMembers(_conversationId);
    if (!cached) return null;
    try {
      return deriveGroupMessageKey(_conversationId, cached);
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

    // Always refresh: membership changes invalidate the key, and a stale key
    // would decrypt nothing once someone joins or leaves.
    const pending = fetchGroupInfo(_conversationId, token)
      .then(info => {
        if (!info || info.members.length === 0) return null;
        const memberIds = info.members.map(m => m.userId);
        try {
          const key = deriveGroupMessageKey(_conversationId, memberIds);
          if (!cancelled) {
            if (!sameMembers(cachedMembers, memberIds)) {
              writeCachedGroupMembers(_conversationId, memberIds);
            }
            setGroupCryptoKey(key);
          }
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

  // ── Message state
  const [messages, setMessages] = useState<ExtendedMessage[]>([]);
  const [allMessages, setAllMessages] = useState<ExtendedMessage[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(1);

  // ── Input state
  const [text, setTextRaw] = useState('');
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
  const token = useAppSelector(selectAuthToken);

  const reactionEmojiRow =
    remoteReactionPalette && remoteReactionPalette.length > 0
      ? remoteReactionPalette.slice(0, 8)
      : getEffectiveReactionPalette(_conversationId);

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
      if (dmCryptoKey && rawContent.startsWith('HC1:')) {
        rawObj.content = maybeDecryptContent(rawContent, dmCryptoKey);
      } else if (groupCryptoKey && rawContent.startsWith('HCG1:')) {
        rawObj.content = maybeDecryptGroupContent(rawContent, groupCryptoKey);
      }

      const parsed = mapApiMessageToTimeline(rawObj);

      let media = parsed.media;
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
        media = {
          ...media,
          remoteUri: maybeDecryptGroupContent(media.remoteUri, groupCryptoKey),
        };
      }
      if (groupCryptoKey && media?.url?.startsWith('HCG1:')) {
        media = {
          ...media,
          url: maybeDecryptGroupContent(media.url!, groupCryptoKey),
        };
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
        replyText = maybeDecryptGroupContent(rawReplyContent, groupCryptoKey);
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
        delivery: parsed.delivery,
        outgoingHint: hint,
        replyTo: replyToMapped,
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
  useEffect(() => {
    if (_conversationId && allMessages.length > 0) {
      writeThreadMessagesCache(_conversationId, allMessages);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_conversationId, allMessages]);

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
    const fromSeed = seedMessages?.length ? seedMessages : [];
    const base = fromSeed.length
      ? fromSeed
      : cached?.length
        ? cached
        : [];

    setLoadingMore(false);
    setAllMessages(base);
    setMessages(mergeIntroDesc([...base].reverse(), threadIntroPeer));
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
        setMessages(prev => {
          const serverIds = new Set(mergedAsc.map(m => String(m._id)));
          const pendingToKeep = (prev as ExtendedMessage[]).filter(
            (m: ExtendedMessage) => keepPending(m, serverIds),
          );
          const desc = [...mergedAsc].reverse();
          if (pendingToKeep.length === 0) return mergeIntroDesc(desc, threadIntroPeer);
          const combined = [...mergedAsc, ...pendingToKeep];
          combined.sort((a, b) => createdAtMs(a.createdAt) - createdAtMs(b.createdAt));
          return mergeIntroDesc([...combined].reverse(), threadIntroPeer);
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
    // mapHopenityMessage is intentionally NOT a dependency — see
    // mapHopenityMessageRef above. This effect should only run on a genuine
    // conversation switch / reconnect, not every time the group crypto key
    // resolves (that's handled by the retro-decrypt pass + fresh polls).
  }, [
    _conversationId,
    seedMessages,
    token,
    threadIntroPeer,
    mergeLocalCallLogsFromCache,
  ]);

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
      setMessages(prev => {
        const prevAsc = [...stripIntro(prev as ExtendedMessage[])].reverse();
        const merged = mergeFetchedAsc(prevAsc, mapped);
        if (!merged) return prev;
        return mergeIntroDesc([...merged].reverse(), threadIntroPeer);
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
        const res = await fetchHopenityChatMessages(_conversationId, token, {
          limit: PAGE_SIZE,
          before,
          isGroup: useV2Messages,
        });
        const chunk = res.messages ?? [];
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
        setMessages(mergeIntroDesc(desc, threadIntroPeer));
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
    [_conversationId, token, allMessages, mapHopenityMessage, threadIntroPeer],
  );

  // ─── Pagination ────────────────────────────────────────────────────────────

  const loadEarlier = useCallback(() => {
    if (loadingMore || !hasMore) return;
    const next = pageRef.current + 1;
    pageRef.current = next;
    fetchMessages(next);
  }, [loadingMore, hasMore, fetchMessages]);

  // ─── Message CRUD ──────────────────────────────────────────────────────────

  const appendMessage = useCallback(
    (msg: ExtendedMessage) => {
      setMessages(prev =>
        mergeIntroDesc([msg, ...stripIntro(prev)], threadIntroPeer),
      );
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
      setMessages(prev => {
        if (stripIntro(prev).some(m => String(m._id) === String(msg._id))) {
          return prev;
        }
        return mergeIntroDesc([msg, ...stripIntro(prev)], threadIntroPeer);
      });
      setAllMessages(prev =>
        prev.some(m => String(m._id) === String(msg._id)) ? prev : [...prev, msg],
      );
    },
    [threadIntroPeer],
  );

  const updateMessage = useCallback(
    (id: string | number, patch: Partial<ExtendedMessage>) => {
      const apply = (m: ExtendedMessage) =>
        m._id === id ? { ...m, ...patch } : m;
      setMessages(prev =>
        mergeIntroDesc(stripIntro(prev).map(apply), threadIntroPeer),
      );
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
      setMessages(prev =>
        mergeIntroDesc(apply(stripIntro(prev)), threadIntroPeer),
      );
      setAllMessages(prev => apply(prev));
      bumpRefresh();
    },
    [bumpRefresh, threadIntroPeer],
  );

  const deleteMessage = useCallback(
    (id: string | number) => {
      setMessages(prev =>
        mergeIntroDesc(
          stripIntro(prev).filter(m => m._id !== id),
          threadIntroPeer,
        ),
      );
      setAllMessages(prev => prev.filter(m => m._id !== id));
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

    const unsubDeleted = callSocket.onMessageDeleted(({ chatId, messageId }) => {
      if (String(chatId) !== String(_conversationId)) return;
      deleteMessage(messageId);
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

    return () => {
      callSocket.leaveChatRoom(_conversationId);
      unsubDeleted();
      unsubNew();
      unsubWordEffect();
    };
  }, [
    _conversationId,
    appendMessageIfNew,
    deleteMessage,
    localUserIdStr,
    mapHopenityMessage,
    playWordEffect,
    pollMessagesNow,
  ]);

  // ─── Retro-decrypt: groupCryptoKey is derived asynchronously (after an
  // extra fetchGroupInfo round-trip), so any group message mapped before it
  // resolved was stored with its raw "HCG1:…" ciphertext still in `.text` and
  // never re-processed. Once the key becomes available, sweep the messages
  // already in state and decrypt anything still ciphertext-shaped.
  useEffect(() => {
    if (!isGroup || !groupCryptoKey) return;
    const decryptPass = (list: ExtendedMessage[]) =>
      list.map(m => {
        const t = String(m.text ?? '');
        if (!t.startsWith('HCG1:')) return m;
        const plain = maybeDecryptGroupContent(t, groupCryptoKey);
        return plain === t ? m : { ...m, text: plain };
      });
    setAllMessages(prev => decryptPass(prev));
    setMessages(prev => mergeIntroDesc(decryptPass(stripIntro(prev)), threadIntroPeer));
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
      setTextRaw(t);
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

  // ─── Send text / media ─────────────────────────────────────────────────────

  const onSend = useCallback(
    (outgoing: ExtendedMessage[] = []) => {
      if (!outgoing.length) return;

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
          const plain = String(stamped.text ?? '');
          void (async () => {
          let wire = plain;
          if (isE2eeEnabled() && plain.length > 0) {
            if (isGroup) {
              // Wait for the key rather than downgrading: sending before it
              // resolved used to put a plaintext message into an otherwise
              // encrypted thread.
              const gk = await resolveGroupKey();
              if (gk) wire = encryptGroupMessage(plain, gk);
            } else if (dmCryptoKey) {
              wire = encryptMessagePayload(plain, dmCryptoKey);
            }
          }
          sendHopenityChatMessage(_conversationId, wire, token, activePage?.id ?? null, useV2Messages, currentReplyTo?._id ?? null)
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
        } else {
          setTimeout(() => updateMessage(stamped._id, { pending: false }), 800);
        }
      });

      dispatch(resetReplayTo());
    },
    [
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
      resolveGroupKey,
      dmCryptoKey,
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
              wire = isGroup
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
              wire = isGroup
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
      const existing = msg.reactions ?? [];
      const uid = String(user._id);
      const alreadyReacted = existing.some(
        r => r.userId === uid && r.emoji === emoji,
      );

      const updated = alreadyReacted
        ? existing.filter(r => !(r.userId === uid && r.emoji === emoji))
        : [
            ...existing,
            {
              emoji,
              userId: uid,
              userName: typeof user.name === 'string' ? user.name : 'You',
            },
          ];

      // Optimistic, then persist. Without the server call the reaction lived
      // only in local state: it vanished on reload and the other person never
      // saw it.
      updateMessage(msg._id, { reactions: updated });

      if (!token) return;
      void reactToMessage(msg._id, emoji, token).then(ok => {
        if (ok) return;
        // Roll back so the UI doesn't claim a reaction the server rejected.
        updateMessage(msg._id, { reactions: existing });
      });
    },
    [user._id, user.name, updateMessage, token],
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
      } else if (text.startsWith('HCG1:') && groupCryptoKey) {
        text = maybeDecryptGroupContent(text, groupCryptoKey);
      }
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
      const isMine = String((message as ExtendedMessage).user?._id ?? '') === String(localUserIdStr ?? '');
      const ageMs = Date.now() - new Date((message as ExtendedMessage).createdAt ?? 0).getTime();
      const withinWindow = ageMs < 30 * 60 * 1000;

      if (!isMine) {
        Alert.alert("Can't delete", "You can only delete messages you sent.");
        return;
      }

      const canDeleteForEveryone = withinWindow;
      const title = canDeleteForEveryone ? 'Delete message?' : 'Delete for me?';
      const body = canDeleteForEveryone
        ? 'This will remove the message for everyone in this chat.'
        : 'This message is older than 30 minutes and will only be removed from your view.';

      Alert.alert(title, body, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Optimistic removal
            deleteMessage(message._id);

            if (canDeleteForEveryone) {
              const { ok, error } = await deleteHopenityChatMessage(message._id, token);
              if (!ok) {
                // Restore is not straightforward; show error only
                Alert.alert('Could not delete', error ?? 'Please try again.');
              }
            }
          },
        },
      ]);
    },
    [deleteMessage, token, localUserIdStr],
  );

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
        const isVideo = !!asset.type?.startsWith('video');
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
            const isVideo = !!asset.type?.startsWith('video');
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

  const value = {
    // State
    messages: messagesForUi,
    text,
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
    loadEarlier,
    updateMessage,
    deleteMessage,

    // Actions
    handleReact,
    handleReply,
    clearReply,
    handleDelete,
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

    isEncrypted: shouldEncryptOutgoing,

    registerScrollToMessage,

    // refs
    wrapRef,
    swipeRef,
  };

  return (
    <InboxContext.Provider value={value}>{children}</InboxContext.Provider>
  );
}
