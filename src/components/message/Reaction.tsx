import React, { useRef, useState, useCallback } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Animated,
  Platform,
  Clipboard,
  Alert,
} from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import {
  Copy,
  Trash2,
  MoreHorizontal,
  Reply,
  Forward,
} from 'lucide-react-native';
import { IMessage } from 'react-native-gifted-chat';
import { useAppDispatch } from '../../hooks/redux';
import { setReplayTo } from '../../redux/features/inbox/inboxSlice';
import ReactorList from './ReactorList';
import MediaPreviewModal from './ImagePreviewModal';
import { Anchor, ExtendedMessage } from '../types/chat';
import { colorss } from '../../theme';

type ReactionProps = {
  currentMessage: ExtendedMessage;
  position: 'left' | 'right';
  onPressReactions?: () => void;
  onReact?: (emoji: string, message: IMessage) => void;
  onReply?: (message: IMessage) => void;
  onDelete?: (message: IMessage) => void;
  onForward?: (message: IMessage) => void;
  onStar?: (message: IMessage) => void;
  children: React.ReactNode;
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const EMOJIS = ['❤️', '😂', '😮', '😢', '👍', '🔥'];

type ActionButton = {
  id: string;
  label: string;
  icon: React.ReactNode;
  color?: string;
  onPress: () => void;
};

export default function Reaction({
  currentMessage,
  position,
  onReact,
  onReply,
  onDelete,
  onForward,
  children,
}: ReactionProps) {
  const dispatch = useAppDispatch();
  const isRight = position === 'right';

  const wrapRef = useRef<View>(null);
  const swipeRef = useRef<any>(null);
  const hasTriggered = useRef(false);

  const [trayVisible, setTrayVisible] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [reactorListVisible, setReactorListVisible] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'image' | 'video'>('image');
  const msg = currentMessage as ExtendedMessage;
  const media = msg?.media;

  // ── Animations
  // Backdrop
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  // Emoji tray
  const trayScale = useRef(new Animated.Value(0.85)).current;
  const trayOpacity = useRef(new Animated.Value(0)).current;
  const trayTranslateY = useRef(new Animated.Value(-20)).current;
  // Action sheet slides up from below
  const sheetTranslateY = useRef(new Animated.Value(60)).current;
  const sheetOpacity = useRef(new Animated.Value(0)).current;

  const openTray = useCallback(() => {
    setTrayVisible(true);
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(trayTranslateY, {
        toValue: 0,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(trayOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.spring(trayScale, {
        toValue: 1,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(sheetTranslateY, {
        toValue: 0,
        tension: 80,
        friction: 9,
        useNativeDriver: true,
      }),
      Animated.timing(sheetOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [
    backdropOpacity,
    trayTranslateY,
    trayOpacity,
    trayScale,
    sheetTranslateY,
    sheetOpacity,
  ]);

  const closeTray = useCallback(
    (cb?: () => void) => {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(trayOpacity, {
          toValue: 0,
          duration: 140,
          useNativeDriver: true,
        }),
        Animated.timing(trayScale, {
          toValue: 0.85,
          duration: 140,
          useNativeDriver: true,
        }),
        Animated.timing(trayTranslateY, {
          toValue: -20,
          duration: 140,
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: 60,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(sheetOpacity, {
          toValue: 0,
          duration: 140,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setTrayVisible(false);
        cb?.();
      });
    },
    [
      backdropOpacity,
      trayOpacity,
      trayScale,
      trayTranslateY,
      sheetTranslateY,
      sheetOpacity,
    ],
  );

  // ── Long press
  const handleLongPress = useCallback(() => {
    swipeRef.current?.close();
    wrapRef.current?.measure((_x, _y, w, h, pageX, pageY) => {
      setAnchor({ pageX, pageY, w, h });
      openTray();
    });
  }, [openTray]);

  // ── Swipe to reply
  const dispatchReply = useCallback(() => {
    onReply?.(currentMessage);
    dispatch(
      setReplayTo({
        _id: currentMessage._id,
        text: currentMessage.text,
        media: currentMessage.media,
        user: currentMessage.user,
        createdAt: new Date(currentMessage.createdAt as Date).toISOString(),
      }),
    );
  }, [currentMessage, dispatch, onReply]);

  const handleSwipe = useCallback(
    (direction: string) => {
      if (hasTriggered.current) return;
      hasTriggered.current = true;

      const shouldTrigger =
        (direction === 'left' && isRight) ||
        (direction === 'right' && !isRight);

      if (shouldTrigger) dispatchReply();

      swipeRef.current?.close();
      setTimeout(() => {
        hasTriggered.current = false;
      }, 200);
    },
    [isRight, dispatchReply],
  );

  // ── Emoji press
  const handleEmojiPress = useCallback(
    (emoji: string) => {
      closeTray(() => onReact?.(emoji, currentMessage));
    },
    [closeTray, onReact, currentMessage],
  );

  const handleMediaPress = useCallback(() => {
    const type = media?.type;
    if (type === 'image' || type === 'video') {
      setPreviewUrl(media?.remoteUri ?? media?.url ?? '');
      setPreviewType(type);
    }
  }, [media?.remoteUri, media?.type, media?.url]);

  // ── Action buttons
  const actions: ActionButton[] = [
    {
      id: 'reply',
      label: 'Reply',
      icon: <Reply size={22} color={colorss.primary ?? '#F72585'} />,
      onPress: () => closeTray(() => dispatchReply()),
    },
    {
      id: 'copy',
      label: 'Copy',
      icon: <Copy size={22} color={colorss.primary ?? '#F72585'} />,
      onPress: () => {
        if (currentMessage.text) {
          Clipboard.setString(currentMessage.text);
        }
        closeTray();
      },
    },
    {
      id: 'forward',
      label: 'Forward',
      icon: <Forward size={22} color={colorss.primary ?? '#F72585'} />,
      onPress: () => closeTray(() => onForward?.(currentMessage)),
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: <Trash2 size={22} color="#ef4444" />,
      color: '#ef4444',
      onPress: () =>
        closeTray(() => {
          Alert.alert(
            'Delete message?',
            'This will delete the message for you.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => onDelete?.(currentMessage),
              },
            ],
          );
        }),
    },
    {
      id: 'more',
      label: 'More',
      icon: <MoreHorizontal size={22} color={colorss.primary ?? '#F72585'} />,
      onPress: () => closeTray(),
    },
  ];

  // ── Tray positioning

  const trayStyle = anchor
    ? {
        top: anchor.pageY - 68,
        ...(isRight
          ? { right: Math.max(10, SCREEN_WIDTH - anchor.pageX - anchor.w) }
          : { left: Math.max(10, anchor.pageX) }),
      }
    : { top: 0, left: 10 };

  // ── Reaction badge summary
  const hasReactions =
    currentMessage.reactions && currentMessage.reactions.length > 0;

  const reactionSummary = hasReactions
    ? currentMessage
        .reactions!.reduce<{ emoji: string; count: number }[]>((acc, r) => {
          const found = acc.find(x => x.emoji === r.emoji);
          if (found) found.count++;
          else acc.push({ emoji: r.emoji, count: 1 });
          return acc;
        }, [])
        .slice(0, 3)
    : [];

  const swipeAction = () => (
    <View style={styles.swipeAction}>
      <Reply size={16} color="#fff" />
    </View>
  );

  return (
    <View
      ref={wrapRef}
      collapsable={false}
      style={[styles.wrapper, hasReactions && styles.wrapperWithReaction]}
    >
      {/* ── Context sheet modal ───*/}
      <Modal
        transparent
        visible={trayVisible}
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => closeTray()}
      >
        {/* Dimmed backdrop */}
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => closeTray()}
          />
        </Animated.View>

        {/* ── Emoji reaction tray ── */}
        <Animated.View
          style={[styles.tray, trayStyle]}
          pointerEvents="box-none"
        >
          {EMOJIS.map(emoji => (
            <TouchableOpacity
              key={emoji}
              onPress={() => handleEmojiPress(emoji)}
              style={styles.emojiBtn}
              activeOpacity={0.7}
            >
              <Animated.Text
                style={[
                  styles.emoji,
                  {
                    transform: [
                      {
                        scale: trayScale.interpolate({
                          inputRange: [0.85, 1],
                          outputRange: [0.6, 1],
                        }),
                      },
                    ],
                  },
                ]}
              >
                {emoji}
              </Animated.Text>
            </TouchableOpacity>
          ))}
        </Animated.View>

        {/* ── Action buttons sheet ── */}
        <Animated.View
          style={[
            styles.actionSheet,
            {
              opacity: sheetOpacity,
              transform: [{ translateY: sheetTranslateY }],
            },
          ]}
        >
          <View style={styles.actionRow}>
            {actions.map(action => (
              <TouchableOpacity
                key={action.id}
                style={styles.actionItem}
                onPress={action.onPress}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.actionIconWrap,
                    action.id === 'delete' && styles.actionIconDelete,
                  ]}
                >
                  {action.icon}
                </View>
                <Text
                  style={[
                    styles.actionLabel,
                    action.color ? { color: action.color } : null,
                  ]}
                >
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      </Modal>

      {/* ── Swipeable message row ───*/}
      <Swipeable
        ref={swipeRef}
        friction={2}
        overshootLeft={false}
        overshootRight={false}
        leftThreshold={40}
        rightThreshold={40}
        onSwipeableWillOpen={handleSwipe}
        renderLeftActions={isRight ? undefined : swipeAction}
        renderRightActions={isRight ? swipeAction : undefined}
      >
        <View style={[styles.row, isRight ? styles.rowRight : styles.rowLeft]}>
          <Pressable onLongPress={handleLongPress} onPress={handleMediaPress}>
            {children}
          </Pressable>

          {/* Reaction badge */}
          {hasReactions && (
            <Pressable
              style={[
                styles.badge,
                isRight ? styles.badgeRight : styles.badgeLeft,
              ]}
              onPress={() => setReactorListVisible(true)}
            >
              <Text style={styles.badgeText}>
                {reactionSummary.map(r => r.emoji).join('')}{' '}
                {currentMessage.reactions!.length}
              </Text>
            </Pressable>
          )}
        </View>
      </Swipeable>

      {/* Reactor list modal */}
      <Modal transparent visible={reactorListVisible} animationType="slide">
        <ReactorList onClose={() => setReactorListVisible(false)} />
      </Modal>

      <MediaPreviewModal
        visible={!!previewUrl}
        mediaUrl={previewUrl}
        mediaType={previewType}
        onClose={() => setPreviewUrl(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 6,
  },
  wrapperWithReaction: {
    marginBottom: 24,
  },

  // ── Backdrop
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },

  // ── Emoji tray
  tray: {
    position: 'absolute',
    flexDirection: 'row',
    backgroundColor: colorss.white,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    elevation: 24,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    gap: 2,
  },
  emojiBtn: {
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  emoji: {
    fontSize: 26,
  },

  // ── Action sheet
  actionSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colorss.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 20,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingHorizontal: 8,
  },
  actionItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  actionIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FDE8F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIconDelete: {
    backgroundColor: '#FFEDED',
  },
  actionLabel: {
    fontSize: 12,
    color: '#1a1a2e',
    fontWeight: '500',
    textAlign: 'center',
  },

  // ── Swipe row
  row: {
    position: 'relative',
  },
  rowLeft: {
    alignSelf: 'flex-start',
    marginLeft: 12,
  },
  rowRight: {
    alignSelf: 'flex-end',
    marginRight: 12,
  },
  swipeAction: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    borderRadius: 50,
    width: 32,
    height: 32,
    alignSelf: 'center',
    marginHorizontal: 6,
  },

  // ── Reaction badge
  badge: {
    position: 'absolute',
    bottom: -18,
    backgroundColor: '#1e1e2e',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  badgeLeft: { left: 6 },
  badgeRight: { right: 6 },
  badgeText: {
    fontSize: 11,
    color: '#e2e8f0',
    fontWeight: '500',
  },
});
