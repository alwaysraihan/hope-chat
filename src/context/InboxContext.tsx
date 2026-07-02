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
  const [groupCryptoKey, setGroupCryptoKey] = useState<Uint8Array | null>(null);

  useEffect(() => {
    if (!isGroup || !_conversationId || !token || !isE2eeEnabled()) {
      setGroupCryptoKey(null);
      return;
    }
    let cancelled = false;
    fetchGroupInfo(_conversationId, token).then(info => {
      if (cancelled || !info || info.members.length === 0) return;
      try {
        const key = deriveGroupMessageKey(
          _conversationId,
          info.members.map(m => m.userId),
        );
        setGroupCryptoKey(key);
      } catch {
        // leave null — group will send/receive plaintext
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [isGroup, _conversationId, token]);

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
  const [text, setText] = useState('');
  const [initialText, setInitialText] = useState('');

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
      const replyToMapped = rawReplyTo
        ? {
            _id: String(rawReplyTo.id ?? rawReplyTo._id ?? ''),
            text: String(rawReplyTo.content ?? rawReplyTo.text ?? ''),
            media: undefined,
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
        delivery: parsed.delivery,
        outgoingHint: hint,
        replyTo: replyToMapped,
      };
    },
    [_conversationId, dmCryptoKey, localUserIdStr, peerUserId, isGroup],
  );

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
        const mapped = fetched.map(mapHopenityMessage);
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
        markHopenityChatRead(_conversationId, token, isGroup).catch(() => undefined);
      } catch (err) {
        console.error('[InboxProvider] load chat messages error:', err);
      }
    };

    load();
  }, [
    _conversationId,
    seedMessages,
    token,
    mapHopenityMessage,
    threadIntroPeer,
    mergeLocalCallLogsFromCache,
  ]);

  // ─── Live poll: fetch new messages every 15 s while this chat is open ─────
  useEffect(() => {
    if (!_conversationId || !token) return;
    const poll = async () => {
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
    };
    const id = setInterval(poll, 15_000);
    return () => clearInterval(id);
  }, [_conversationId, token, useV2Messages, mapHopenityMessage, threadIntroPeer]);

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

    // Trigger an immediate poll when a new_message event arrives so the chat list
    // and inbox refresh without waiting for the 15/30-second polling cycle.
    const unsubNew = callSocket.onNewMessage(({ chatId }) => {
      if (String(chatId) !== String(_conversationId)) return;
      DeviceEventEmitter.emit(RELOAD_CHAT_LIST_EVENT);
    });

    return () => {
      callSocket.leaveChatRoom(_conversationId);
      unsubDeleted();
      unsubNew();
    };
  }, [_conversationId, deleteMessage]);

  // ─── Send text / media ─────────────────────────────────────────────────────

  const onSend = useCallback(
    (outgoing: ExtendedMessage[] = []) => {
      if (!outgoing.length) return;

      const currentReplyTo = replyTo
        ? {
            _id: replyTo._id,
            text: replyTo.text ?? '',
            media: replyTo.media,
            user: replyTo.user,
          }
        : undefined;

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
          let wire = plain;
          if (shouldEncryptOutgoing && plain.length > 0) {
            wire = isGroup
              ? encryptGroupMessage(plain, groupCryptoKey!)
              : encryptMessagePayload(plain, dmCryptoKey!);
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
      shouldEncryptOutgoing,
      dmCryptoKey,
      groupCryptoKey,
      isGroup,
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

      updateMessage(msg._id, { reactions: updated });

      // TODO: api.reactToMessage(msg._id, emoji, alreadyReacted ? 'remove' : 'add');
    },
    [user._id, user.name, updateMessage],
  );

  // ─── Reply ─────────────────────────────────────────────────────────────────

  const handleReply = useCallback(
    (message: IMessage) => {
      const msg = message as ExtendedMessage;
      dispatch(
        setReplayTo({
          _id: msg._id,
          text: msg.text ?? '',
          media: msg.media,
          user: msg.user,
          createdAt: new Date(msg.createdAt as Date).toISOString(),
        }),
      );
    },
    [dispatch],
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

  const handleCameraPress = useCallback(async () => {
    const ok = await checkCameraPermission();
    if (!ok) return;

    launchCamera(
      { mediaType: 'mixed' as MediaType, videoQuality: 'low', quality: 0.8 },
      response => {
        if (response.didCancel || response.errorCode) return;
        const asset = response.assets?.[0];
        if (!asset?.uri) return;
        sendMediaMessage(
          asset.uri,
          asset.type?.startsWith('video') ? 'video' : 'image',
        );
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
      },
      response => {
        if (response.didCancel || response.errorCode) return;
        const assets = response.assets ?? [];
        if (assets.length === 0) return;
        // Send each asset sequentially so the order is preserved
        assets.forEach(asset => {
          if (!asset?.uri) return;
          sendMediaMessage(
            asset.uri,
            asset.type?.startsWith('video') ? 'video' : 'image',
          );
        });
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
