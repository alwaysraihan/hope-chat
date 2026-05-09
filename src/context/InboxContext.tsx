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
import { Anchor, ExtendedMessage } from '../components/types/chat';
import {
  checkCameraPermission,
  checkMicrophonePermission,
} from '../utils/permissions';

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

interface InboxProviderProps {
  children: React.ReactNode;
  /** When set, replaces the default seeded thread (e.g. chosen from home list). */
  seedMessages?: ExtendedMessage[];
  /** Stable id for pagination / future API (must match conversation list id). */
  conversationId?: string;
}

export function InboxProvider({
  children,
  seedMessages,
  conversationId: _conversationId,
}: InboxProviderProps) {
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wrapRef = useRef<View>(null);
  const swipeRef = useRef<any>(null);

  // ── Auth / user
  const user =
    useAppSelector(state => state.auth.giftedChatUser) ?? { _id: '1', name: 'You' };

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
    const base = seedMessages?.length ? seedMessages : [];

    setLoadingMore(false);
    setAllMessages(base);
    setMessages([...base].reverse());
    setHasMore(false);
    // TODO: when API exists, use _conversationId + page > 1 inside fetchMessages.
  }, [_conversationId, seedMessages]);

  // ─── Fetch messages ────────────────────────────────────────────────────────

  const fetchMessages = useCallback(async (page: number) => {
    setLoadingMore(page > 1);

    try {
      // TODO: replace with real API — use _conversationId when wiring backend
      const fetched: ExtendedMessage[] = [];

      if (page === 1) {
        setAllMessages(fetched);
        setMessages([...fetched].reverse());
      } else {
        setAllMessages(prev => [...fetched, ...prev]);
        setMessages(prev => [...prev, ...[...fetched].reverse()]);
      }

      setHasMore(fetched.length === PAGE_SIZE);
    } catch (err) {
      console.error('[InboxProvider] fetchMessages error:', err);
    } finally {
      setLoadingMore(false);
    }
  }, []);

  // ─── Pagination ────────────────────────────────────────────────────────────

  const loadEarlier = useCallback(() => {
    if (loadingMore || !hasMore) return;
    const next = pageRef.current + 1;
    pageRef.current = next;
    fetchMessages(next);
  }, [loadingMore, hasMore, fetchMessages]);

  // ─── Message CRUD ──────────────────────────────────────────────────────────

  const appendMessage = useCallback((msg: ExtendedMessage) => {
    setMessages(prev => [msg, ...prev]);
    setAllMessages(prev => [...prev, msg]);
  }, []);

  const updateMessage = useCallback(
    (id: string | number, patch: Partial<ExtendedMessage>) => {
      const apply = (m: ExtendedMessage) =>
        m._id === id ? { ...m, ...patch } : m;
      setMessages(prev => prev.map(apply));
      setAllMessages(prev => prev.map(apply));
      bumpRefresh();
    },
    [bumpRefresh],
  );

  const deleteMessage = useCallback(
    (id: string | number) => {
      setMessages(prev => prev.filter(m => m._id !== id));
      setAllMessages(prev => prev.filter(m => m._id !== id));
      bumpRefresh();
    },
    [bumpRefresh],
  );

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
        const stamped: ExtendedMessage = {
          ...msg,
          createdAt: msg.createdAt ?? new Date(),
          user: msg.user ?? { _id: user._id },
          pending: true,
          replyTo: currentReplyTo,
        };

        appendMessage(stamped);

        // TODO: replace with real API / socket send
        // api.sendMessage(stamped)
        //   .then(confirmed => updateMessage(stamped._id, { pending: false, ...confirmed }))
        //   .catch(() => updateMessage(stamped._id, { pending: false, failed: true }));

        setTimeout(() => updateMessage(stamped._id, { pending: false }), 800);
      });

      dispatch(resetReplayTo());
    },
    [user._id, replyTo, appendMessage, updateMessage, dispatch],
  );

  // ─── Send voice ────────────────────────────────────────────────────────────

  const sendVoiceMessage = useCallback(
    (audioPath: string, duration: number) => {
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

      // TODO: uploadAudio(audioPath)
      //   .then(remoteUri => updateMessage(msg._id, { media: { ...msg.media!, remoteUri, uploading: false }, pending: false }))
      //   .catch(() => updateMessage(msg._id, { media: { ...msg.media!, uploading: false, error: true }, pending: false, failed: true }));

      setTimeout(() => {
        updateMessage(msg._id, {
          media: { ...msg.media!, uploading: false },
          pending: false,
        });
      }, 1200);
    },
    [user._id, appendMessage, updateMessage],
  );

  // ─── Send media (image / video) ────────────────────────────────────────────

  const sendMediaMessage = useCallback(
    (localUri: string, mediaType: 'image' | 'video', thumbnail?: string) => {
      const msg: ExtendedMessage = {
        _id: `media_${Date.now()}`,
        text: '',
        createdAt: new Date(),
        user: { _id: user._id },
        media: { type: mediaType, localUri, thumbnail, uploading: true },
        pending: true,
      };

      appendMessage(msg);

      // TODO: uploadMedia(localUri)
      //   .then(remoteUri => updateMessage(msg._id, { media: { ...msg.media!, remoteUri, url: remoteUri, uploading: false }, pending: false }))
      //   .catch(() => updateMessage(msg._id, { media: { ...msg.media!, uploading: false, error: true }, pending: false, failed: true }));

      setTimeout(() => {
        updateMessage(msg._id, {
          media: { ...msg.media!, uploading: false },
          pending: false,
        });
      }, 1500);
    },
    [user._id, appendMessage, updateMessage],
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
    [user._id, updateMessage],
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
    messages,
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

    // refs
    wrapRef,
    swipeRef,
  };

  return (
    <InboxContext.Provider value={value}>{children}</InboxContext.Provider>
  );
}
