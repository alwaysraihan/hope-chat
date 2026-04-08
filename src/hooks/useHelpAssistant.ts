import { useState, useCallback, useEffect, useRef } from 'react';
import { Dimensions, Animated, Keyboard, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
// import { useDispatch, useSelector } from 'react-redux';
import { GiftedChat, IMessage } from 'react-native-gifted-chat';
import { launchImageLibrary } from 'react-native-image-picker';
import { checkMicrophonePermission } from '../utils/permissions';
// import useBackHandlerWithKeyboard from './useBackHandler';
// import { checkoutMode, DeliveryType } from '../constants/AppConfig';

const { width } = Dimensions.get('window');

// Interface (duplicated for now, could be in types.ts)
export interface MediaMessage extends IMessage {
  media?:
    | {
        type: 'image';
        localUri: string | undefined;
        remoteUri: string | null;
        uploading: boolean;
        error?: boolean;
        url?: string;
      }
    | {
        type: 'voice';
        url: string;
        duration: number;
        remoteUri?: string;
      };
  replyTo?: any;
  read?: boolean;
  pending?: boolean;
  failed?: boolean;
  localId?: string;
}

const user = {
  _id: 'hello',
  name: 'Emon hossain',
};

const API_URL = 'http://localhost:8000';

export const useHelpAssistant = () => {
  // const { t } = useTranslation();
  // const dispatch = useDispatch();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();

  // Create refs
  const inputAnimation = useRef(new Animated.Value(1)).current;
  const allSwipeableRefs = useRef<Map<string | number, any>>(new Map());
  // const swipeableRowRef = useRef<any>(null);

  // useBackHandlerWithKeyboard();

  // State
  const [messages, setMessages] = useState<MediaMessage[]>([
    {
      _id: 1,
      text: 'Hello, how can I help you?',
      createdAt: new Date(),
      user: user,
    },
    {
      _id: 2,
      text: 'I need a help',
      createdAt: new Date(),
      user: user,
    },
    {
      _id: 3,
      text: 'I need a help',
      createdAt: new Date(),
      user: {
        _id: 'admin',
        name: 'Admin',
      },
    },
  ]);
  const [initialText, setInitialText] = useState<string>('');
  const [text, setText] = useState('');
  const [replyMessage, setReplyMessage] = useState<IMessage | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const [modalImageUrl, setModalImageUrl] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);
  const [loading, setLoading] = useState(true);

  // Redux
  // const user = useSelector((state: RootState) => state.auth.user);
  // const chatIdFromStore = useSelector((state: RootState) => state.auth.chatId);
  const [chatId, setChatIdLocal] = useState<string | null>('chatIdFromStore');

  // --- Effects ---

  // Refresh trigger
  useEffect(() => {
    if (isFocused) {
      setRefreshTrigger(prev => prev + 1);
    }
  }, [isFocused]);

  // Keyboard listeners
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', e =>
      setKeyboardHeight(e.endCoordinates.height),
    );
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
      if (!isRecording) {
        Animated.timing(inputAnimation, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [inputAnimation, isRecording]);

  // Focus effect cleanup
  useFocusEffect(
    useCallback(() => {
      return () => {
        Keyboard.dismiss();
        setIsRecording(false);
        Animated.timing(inputAnimation, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      };
    }, [inputAnimation]),
  );

  // ChatId sync
  useEffect(() => {
    if ('chatIdFromStore' !== chatId) {
      setChatIdLocal('chatIdFromStore');
    }
  }, [chatId]);

  // Fetch initial messages / chat
  useEffect(() => {
    const fetchChatAndMessages = async () => {
      if (!user || !user._id) return;
      setLoading(true);
      try {
        const chatRes = await fetch(
          `${API_URL}/chats/user/me?userId=${user._id}`,
        );
        const chatData = await chatRes.json();
        const chatIdFetched = chatData.chat?._id;

        if (chatIdFetched && chatIdFetched !== 'chatIdFromStore') {
          //   dispatch(setChatId(chatIdFetched));
          setChatIdLocal(chatIdFetched);
        }

        if (chatIdFetched) {
          await fetchMessagesInitial(chatIdFetched);
        }
      } catch (err) {
        console.log(err, 'error');
      } finally {
        setLoading(false);
      }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  const fetchMessagesInitial = async (id: string) => {
    const msgRes = await fetch(
      `${API_URL}/chats/${id}/messages?page=1&limit=20`,
    );
    const msgData = await msgRes.json();
    const formatted = formatMessages(msgData.messages || []);

    if (msgData.total) {
      setHasMore(msgData.total > formatted.length);
    }
    setMessages(formatted);
  };

  const formatMessages = (msgs: any[]): MediaMessage[] => {
    return msgs.map((m: any) => ({
      ...m,
      _id: m._id,
      text: m.text,
      createdAt: new Date(m.createdAt),
      user: {
        _id: m.sender,
        name: m.sender === (user ? user._id : '') ? 'You' : 'Admin',
      },
      media: m.media && m.media.length > 0 ? m.media[0] : undefined,
      customOrder: m.customOrder,
      isCustomOrderInvite: m.isCustomOrderInvite,
      orderItems: m.orderItems,
      replyTo: m.replyTo,
      orderId: m.orderId ? m.orderId : null,
      read: m.read,
      pending: false,
      failed: false,
    }));
  };

  // Socket
  useEffect(() => {}, [chatId]);

  useEffect(() => {
    const handleMessageReceive = (message: any) => {
      if (message.chatId === chatId) {
        setMessages(prev => {
          if (message.localId) {
            return prev.map(msg =>
              msg._id === message.localId
                ? { ...msg, ...message, pending: false, failed: false }
                : msg,
            );
          }
          if (prev.some(msg => msg._id === message._id)) return prev;

          return GiftedChat.append(prev, [
            {
              ...message,
              createdAt: new Date(message.createdAt),
              user: {
                _id: message.sender,
                name:
                  message.sender === (user ? user._id : '') ? 'You' : 'Admin',
              },
              media:
                message.media && message.media.length > 0
                  ? message.media[0]
                  : undefined,
              pending: false,
              failed: false,
            },
          ]);
        });
      }
    };

    const handleChatUpdate = ({
      chatId: updatedChatId,
    }: {
      chatId: string;
    }) => {
      if (chatId && updatedChatId === chatId) {
        fetchMessagesInitial(chatId);
      }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, user?._id]);

  // --- Actions ---

  const closeAllSwipeableRows = useCallback(() => {
    allSwipeableRefs.current.forEach(ref => ref?.close());
  }, []);

  const onSend = useCallback(
    (newMessages: MediaMessage[] = []) => {
      if (!chatId || !user || !user._id) return;
      const msg = newMessages[0];
      const localId = `local-${Date.now()}-${Math.random()}`;

      setMessages(prev =>
        GiftedChat.append(prev, [
          { ...msg, _id: localId, pending: true, failed: false },
        ]),
      );
      //   setPendingMap(prev => ({ ...prev, [localId]: 'pending' }));

      const payload = {
        chatId,
        sender: user._id,
        receiver: 'admin',
        text: msg?.text,
        media: msg?.media ? [msg.media] : [],
        customOrder: (msg as any)?.customOrder,
        orderItems: (msg as any)?.orderItems,
        replyTo: (msg as any)?.replyTo?._id,
        localId,
      };

      if (replyMessage) {
        setReplyMessage(null);
        closeAllSwipeableRows();
      }
    },
    [chatId, replyMessage, closeAllSwipeableRows],
  );

  // Voice logic
  const handleVoiceRecordingStart = useCallback(async () => {
    const hasPermission = await checkMicrophonePermission();
    if (hasPermission) {
      setIsRecording(true);
      Animated.timing(inputAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [inputAnimation]);

  const handleVoiceRecordingComplete = useCallback(
    async (audioPath: string, duration: number) => {
      setIsRecording(false);
      Animated.timing(inputAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      if (!audioPath || audioPath === 'Recorder stopped') return;
      if (!user || !user._id) return;

      try {
        let fileToUpload: any = {
          uri: audioPath.startsWith('file://')
            ? audioPath
            : audioPath.startsWith('/storage/')
            ? `file://${audioPath}`
            : audioPath,
          name: 'audio.m4a',
          type: 'audio/m4a',
        };
        // const url = await uploadToCloudinary(fileToUpload);
        // if (!url) throw new Error('Upload failed');

        onSend([
          {
            _id: '', // filled in onSend
            text: '[Voice Message]',
            createdAt: new Date(),
            user: { _id: user._id, name: 'You' },
            media: { type: 'voice', url: '', duration },
          },
        ]);
      } catch (err) {
        console.error('Voice upload error', err);
      }
    },
    [inputAnimation, onSend],
  );

  const handleVoiceRecordingCancel = useCallback(() => {
    setIsRecording(false);
    Animated.timing(inputAnimation, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [inputAnimation]);

  // Image logic
  const handleCameraPress = useCallback(() => {
    launchImageLibrary(
      { mediaType: 'photo', selectionLimit: 1, includeBase64: false },
      async response => {
        if (
          response.didCancel ||
          response.errorCode ||
          !response.assets?.[0]?.uri
        )
          return;
        const asset = response.assets[0];

        // Optimistic update
        const tempId = Date.now().toString();
        const pendingMsg: MediaMessage = {
          _id: tempId,
          createdAt: new Date(),
          user: { _id: user?._id || '1', name: 'You' },
          text: '',
          media: {
            type: 'image',
            localUri: asset.uri,
            remoteUri: null,
            uploading: true,
          },
          pending: true,
          failed: false,
        };
        setMessages(prev => GiftedChat.append(prev, [pendingMsg]));
        // setPendingUploads(prev => ({ ...prev, [tempId]: true }));

        try {
          const fileToUpload = {
            uri: asset.uri,
            name: asset.fileName || 'upload.jpg',
            type: asset.type || 'image/jpeg',
          };
          //   const url = await uploadToCloudinary(fileToUpload);
          //   if (!url) throw new Error('Upload failed');

          // Send real message
          const localId = `local-${Date.now()}-${Math.random()}`;
          const payload = {
            chatId,
            sender: user?._id,
            receiver: 'admin',
            text: '',
            media: [{ type: 'image', url: '' }],
            localId,
          };

          // Replace local pending msg logic with real send...
          // Actually reusing onSend logic here is harder because we already added optimistic.
          // So we manually update.

          // @ts-ignore
          setMessages(prev =>
            prev.map(msg => {
              if (msg._id === tempId) {
                return {
                  ...msg,
                  media: {
                    ...msg.media,
                    remoteUri: 'url',
                    uploading: false,
                    type: 'image',
                  },
                  pending: true,
                  _id: localId,
                };
              }
              return msg;
            }),
          );
          //   setPendingUploads(prev => {
          //     const c = { ...prev };
          //     delete c[tempId];
          //     return c;
          //   });
          //   setPendingMap(prev => ({ ...prev, [localId]: 'pending' }));

          //   socket.emit('message:send', payload, (ack: any) => {
          //     if (ack && ack.error) {
          //       setPendingMap(prev => ({ ...prev, [localId]: 'failed' }));
          //       setMessages(prev =>
          //         prev.map(m =>
          //           m._id === localId
          //             ? { ...m, pending: false, failed: true }
          //             : m,
          //         ),
          //       );
          //     }
          //   });
        } catch (err) {
          setMessages(prev =>
            prev.map(msg =>
              msg._id === tempId
                ? { ...msg, pending: false, failed: true }
                : msg,
            ),
          );
        }
      },
    );
  }, [chatId]);

  // Pagination
  const loadEarlier = useCallback(async () => {
    if (hasMore && !loadingMore && chatId) {
      setLoadingMore(true);
      try {
        const nextPage = page + 1;
        const res = await fetch(
          `${API_URL}/chats/${chatId}/messages?page=${nextPage}&limit=20`,
        );
        const data = await res.json();
        const formatted = formatMessages(data.messages || []);
        setMessages(prev => [...prev, ...formatted.reverse()]);
        setPage(nextPage);
        setHasMore(data.total > messages.length + formatted.length);
      } finally {
        setLoadingMore(false);
      }
    }
  }, [hasMore, loadingMore, page, chatId, messages.length]);

  return {
    messages,
    text,
    setText,
    initialText,
    setInitialText,
    user,
    insets,
    refreshTrigger,
    keyboardHeight,
    isRecording,
    inputAnimation,
    modalVisible,
    modalImageUrl,
    setModalVisible,
    setModalImageUrl,
    isProcessingOrder,
    loadingMore,
    hasMore,
    width,

    // Actions
    onSend,
    handleVoiceRecordingStart,
    handleVoiceRecordingComplete,
    handleVoiceRecordingCancel,
    handleCameraPress,
    loadEarlier,
  };
};
