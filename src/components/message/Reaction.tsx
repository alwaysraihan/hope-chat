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
} from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { ReplyAll } from 'lucide-react-native';
import { IMessage } from 'react-native-gifted-chat';
import { useAppDispatch } from '../../hooks/redux';
import { setReplayTo } from '../../redux/features/inbox/inboxSlice';
import ReactorList from './ReactorList';
import { Anchor, ExtendedMessage } from '../types/chat';
import { colorss } from '../../theme';

type ReactionProps = {
  currentMessage: ExtendedMessage;
  position: 'left' | 'right';
  onPressReactions?: () => void;
  onReact?: (emoji: string, message: IMessage) => void;
  onReply?: (message: IMessage) => void;
  children: React.ReactNode;
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const EMOJIS = ['❤️', '😂', '😮', '😢', '👍', '🔥'];

export default function Reaction({
  currentMessage,
  position,
  onReact,
  onReply,
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

  // Tray animation
  const trayScale = useRef(new Animated.Value(0.5)).current;
  const trayOpacity = useRef(new Animated.Value(0)).current;

  const openTray = useCallback(() => {
    setTrayVisible(true);
    Animated.parallel([
      Animated.spring(trayScale, {
        toValue: 1,
        tension: 90,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(trayOpacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, [trayScale, trayOpacity]);

  const closeTray = useCallback(() => {
    Animated.parallel([
      Animated.timing(trayScale, {
        toValue: 0.5,
        duration: 130,
        useNativeDriver: true,
      }),
      Animated.timing(trayOpacity, {
        toValue: 0,
        duration: 130,
        useNativeDriver: true,
      }),
    ]).start(() => setTrayVisible(false));
  }, [trayScale, trayOpacity]);

  const handleLongPress = useCallback(() => {
    swipeRef.current?.close();
    wrapRef.current?.measure((_x, _y, w, h, pageX, pageY) => {
      setAnchor({ pageX, pageY, w, h });
      openTray();
    });
  }, [openTray]);

  const handleSwipe = useCallback(
    (direction: string) => {
      if (hasTriggered.current) return;
      hasTriggered.current = true;

      const shouldTrigger =
        (direction === 'left' && isRight) ||
        (direction === 'right' && !isRight);

      if (shouldTrigger) {
        onReply?.(currentMessage);
        dispatch(
          setReplayTo({
            ...currentMessage,
            createdAt: new Date(currentMessage.createdAt as Date).toISOString(),
          }),
        );
      }

      swipeRef.current?.close();
      setTimeout(() => {
        hasTriggered.current = false;
      }, 200);
    },
    [isRight, onReply, currentMessage, dispatch],
  );

  const handleEmojiPress = useCallback(
    (emoji: string) => {
      onReact?.(emoji, currentMessage);
      closeTray();
    },
    [onReact, currentMessage, closeTray],
  );

  const trayStyle = anchor
    ? {
        top: anchor.pageY - 76,
        ...(isRight
          ? { right: Math.max(10, SCREEN_WIDTH - anchor.pageX - anchor.w) }
          : { left: Math.max(10, anchor.pageX) }),
      }
    : { top: 0, left: 10 };

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
      <ReplyAll size={16} color="#fff" />
    </View>
  );

  return (
    // Extra bottom margin when there ARE reactions so badge doesn't overlap next message
    <View
      ref={wrapRef}
      collapsable={false}
      style={[styles.wrapper, hasReactions && styles.wrapperWithReaction]}
    >
      {/* Emoji Tray Modal */}
      <Modal
        transparent
        visible={trayVisible}
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeTray}
      >
        <Pressable style={styles.backdrop} onPress={closeTray}>
          <Animated.View
            style={[
              styles.tray,
              trayStyle,
              { transform: [{ scale: trayScale }], opacity: trayOpacity },
            ]}
          >
            {EMOJIS.map(emoji => (
              <TouchableOpacity
                key={emoji}
                onPress={() => handleEmojiPress(emoji)}
                style={styles.emojiBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.emoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </Animated.View>
        </Pressable>
      </Modal>

      {/* Message Row */}
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
          <Pressable onLongPress={handleLongPress}>{children}</Pressable>

          {/* Reaction Badge */}
          {/* {hasReactions && ( */}
          <Pressable
            style={[
              styles.badge,
              isRight ? styles.badgeRight : styles.badgeLeft,
            ]}
            onPress={() => setReactorListVisible(true)}
          >
            <Text style={styles.badgeText}>
              ❤️ 2
              {/* {reactionSummary.map(r => r.emoji).join('')}{' '}
                {currentMessage.reactions!.length} */}
            </Text>
          </Pressable>
          {/* )} */}
        </View>
      </Swipeable>

      {/* Reactor List Modal */}
      <Modal transparent visible={reactorListVisible} animationType="slide">
        <ReactorList onClose={() => setReactorListVisible(false)} />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 6,
  },
  wrapperWithReaction: {
    // Extra space so the reaction badge doesn't overlap the next message
    marginBottom: 24,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  row: {
    position: 'relative',
    marginBottom:20
  },
  rowLeft: {
    alignSelf: 'flex-start',
    marginLeft: 12,
  },
  rowRight: {
    alignSelf: 'flex-end',
    marginRight: 12,
  },
  tray: {
    position: 'absolute',
    flexDirection: 'row',
    backgroundColor: '#1e1e2e',
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
  badge: {
    position: 'absolute',
    bottom: -18,
    backgroundColor: colorss.white,
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
