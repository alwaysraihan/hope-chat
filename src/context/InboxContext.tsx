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
import { useChats } from './ChatsContext';
import {
  fetchHopenityChatMessages,
  formatChatTime,
  markHopenityChatRead,
  sendHopenityChatMessage,
  uploadChatMedia,
} from '../services/chatService';
import {
  selectAuthToken,
  selectHopenityProfile,
} from '../redux/features/auth/authSlice';
import { normalizeChatUserId } from '../utils/chatUserId';
import {
  mergeLocalCallLogsFromCache,
  readThreadMessagesCache,
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
  getEffectiveDisappearingTtlSec,
  getReactionPalette,
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
  handlePressReplyPreview: (messageId: string | number) => void;
  handleLongPress: HandleLongPress;

  // ── Media / camera
  handleCameraPress: () => void;
  handleGalleryPress: () => void;

  // ── Voice
  handleVoiceRecordingStart: () => void;
  handleVoiceRecordingComplete: (path: string, duration: number) => void;
  handleVoiceRecordingCancel: () => void;

  reactionEmojiRow: string[];

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
      subtitle: "You're friends on Hopenity",
      avatarUrl: peer.avatarUrl ?? null,
    },
    text: `Say hi to your new Hopenity friend, ${first}.`,
    createdAt: new Date(1),
    user: { _id: '__hopenity_intro', name: 'Hopenity' },
  };
}

function stripIntro(descNewestFirst: ExtendedMessage[]): ExtendedMessage[] {
  return descNewestFirst.filter(m => m._id !== INTRO_MESSAGE_ID);
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
  remoteReactionPalette = null,
}: InboxProviderProps) {
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wrapRef = useRef<View>(null);
  const swipeRef = useRef<any>(null);

  // ── Auth / user
  const gifted = useAppSelector(state => state.auth.giftedChatUser);
  const hopenityProfile = useAppSelector(selectHopenityProfile);
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

  const shouldEncryptOutgoing = isE2eeEnabled() && !!dmCryptoKey;

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
      : getReactionPalette();

  const mapHopenityMessage = useCallback(
    (raw: any): ExtendedMessage => {
      const sender = raw.sender ?? {};
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
      const senderName =
        sender.name ??
        raw.senderName ??
        raw.sender_name ??
        'Unknown';
      const createdAtRaw = raw.createdAt ?? raw.created_at;
      const id = String(raw.id ?? `${_conversationId ?? 'chat'}_${Date.now()}`);

      const rawObj = { ...(raw as Record<string, unknown>) };
      const rawContent = String(rawObj.content ?? rawObj.text ?? '').trimStart();
      if (dmCryptoKey && rawContent.startsWith('HC1:')) {
        rawObj.content = maybeDecryptContent(rawContent, dmCryptoKey);
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

      return {
        _id: id,
        text: parsed.text,
        createdAt: createdAtRaw ? new Date(createdAtRaw) : new Date(),
        user: {
          _id: resolvedUid,
          name: senderName,
        },
        media,
        messageKind: parsed.messageKind,
        delivery: parsed.delivery,
        outgoingHint: hint,
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
        return [row, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
      });
    },
    [_conversationId, setConversations],
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
        });
        const fetched = page.messages ?? [];
        const mapped = fetched.map(mapHopenityMessage);
        const mergedAsc = mergeLocalCallLogsFromCache(_conversationId, mapped);
        setAllMessages(mergedAsc);
        const desc = [...mergedAsc].reverse();
        setMessages(mergeIntroDesc(desc, threadIntroPeer));
        setHasMore(
          page.pagination?.hasMore ??
            fetched.length >= PAGE_SIZE,
        );
        writeThreadMessagesCache(_conversationId, mergedAsc);
        markHopenityChatRead(_conversationId, token).catch(() => undefined);
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
        });
        const chunk = res.messages ?? [];
        const mapped = chunk.map(mapHopenityMessage);

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
            wire = encryptMessagePayload(plain, dmCryptoKey!);
          }
          sendHopenityChatMessage(_conversationId, wire, token)
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
              updateMessage(stamped._id, {
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
      dispatch,
      _conversationId,
      token,
      updateConversationPreview,
      localUserIdStr,
      shouldEncryptOutgoing,
      dmCryptoKey,
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
            updateMessage(msg._id, {
              media: {
                ...msg.media!,
                remoteUri,
                uploading: false,
              },
              pending: false,
            });
            let wire = remoteUri;
            if (shouldEncryptOutgoing) {
              wire = encryptMessagePayload(remoteUri, dmCryptoKey!);
            }
            const sent = await sendHopenityChatMessage(
              _conversationId,
              wire,
              token,
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
              updateMessage(msg._id, {
                _id: String(sent.id),
                createdAt: sent.createdAt ? new Date(sent.createdAt) : msg.createdAt,
                user: { _id: ackUid, name: ackName },
                ...(p.delivery ? { delivery: p.delivery } : {}),
              });
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
      updateConversationPreview,
      _conversationId,
      token,
      localUserIdStr,
      shouldEncryptOutgoing,
      dmCryptoKey,
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
            updateMessage(msg._id, {
              media: {
                ...msg.media!,
                remoteUri,
                url: remoteUri,
                uploading: false,
              },
              pending: false,
            });
            let wire = remoteUri;
            if (shouldEncryptOutgoing) {
              wire = encryptMessagePayload(remoteUri, dmCryptoKey!);
            }
            const sent = await sendHopenityChatMessage(
              _conversationId,
              wire,
              token,
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
              updateMessage(msg._id, {
                _id: String(sent.id),
                createdAt: sent.createdAt ? new Date(sent.createdAt) : msg.createdAt,
                user: { _id: ackUid, name: ackName },
                ...(p.delivery ? { delivery: p.delivery } : {}),
              });
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
      updateConversationPreview,
      _conversationId,
      token,
      localUserIdStr,
      shouldEncryptOutgoing,
      dmCryptoKey,
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
      Alert.alert('Delete message?', 'This will delete the message for you.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteMessage(message._id);
            // TODO: api.deleteMessage(message._id);
          },
        },
      ]);
    },
    [deleteMessage],
  );

  // ─── Forward ───────────────────────────────────────────────────────────────

  const handleForward = useCallback((message: IMessage) => {
    // TODO: navigate to contact picker and forward message
    console.log('[InboxProvider] forward message:', message._id);
  }, []);

  // ─── Scroll to reply ───────────────────────────────────────────────────────

  const handlePressReplyPreview = useCallback((messageId: string | number) => {
    // TODO: wire flatListRef.current?.scrollToItem(...)
    console.log('[InboxProvider] scroll to message:', messageId);
  }, []);

  // ─── Camera ────────────────────────────────────────────────────────────────

  const handleCameraPress = useCallback(async () => {
    const ok = await checkCameraPermission();
    if (!ok) return;

    launchCamera(
      { mediaType: 'mixed' as MediaType, videoQuality: 'medium', quality: 0.8 },
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
      { mediaType: 'mixed' as MediaType, selectionLimit: 1, quality: 0.8 },
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
    handlePressReplyPreview,
    handleLongPress,

    // Media
    handleCameraPress,
    handleGalleryPress,

    // Voice
    handleVoiceRecordingStart,
    handleVoiceRecordingComplete,
    handleVoiceRecordingCancel,

    reactionEmojiRow,

    // refs
    wrapRef,
    swipeRef,
  };

  return (
    <InboxContext.Provider value={value}>{children}</InboxContext.Provider>
  );
}
