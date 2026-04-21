import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { colorss } from '../../theme';
import { ReplyAll } from 'lucide-react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
const EMOJIS = ['❤️', '😂', '😮', '😢', '👍', '🔥'];

export default function ReactionTray({
  currentMessage,
  position,
  onPressReactions,
  onReact,
  onReply,
}) {
  const [trayVisible, setTrayVisible] = useState(false);
  const [anchor, setAnchor] = useState(null);

  const wrapRef = useRef(null);
  const swipeRef = useRef(null);
  const hasTriggered = useRef(false);

  const isRight = position === 'right';

  const handleLongPress = () => {
    swipeRef.current?.close();

    wrapRef.current?.measure((x, y, w, h, pageX, pageY) => {
      setAnchor({ pageX, pageY, w, h });
      setTrayVisible(true);
    });
  };

  const handleSwipeTrigger = direction => {
    if (hasTriggered.current) return;

    hasTriggered.current = true;

    if (direction === 'left' && isRight) {
      onReply?.(currentMessage);
    }

    if (direction === 'right' && !isRight) {
      onReply?.(currentMessage);
    }

    swipeRef.current?.close();

    setTimeout(() => {
      hasTriggered.current = false;
    }, 200);
  };

  const trayTop = anchor ? anchor.pageY - 70 : 0;

  const trayLeft = anchor
    ? isRight
      ? undefined
      : Math.max(10, anchor.pageX)
    : 10;

  const trayRight = anchor
    ? isRight
      ? Math.max(10, SCREEN_WIDTH - anchor.pageX - anchor.w)
      : undefined
    : undefined;

  return (
    <View ref={wrapRef} collapsable={false}>
      {/* REACTION TRAY */}
      <Modal
        transparent
        visible={trayVisible}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setTrayVisible(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setTrayVisible(false)}
        >
          <Pressable
            style={[
              styles.tray,
              { top: trayTop, left: trayLeft, right: trayRight },
            ]}
            onPress={e => e.stopPropagation()}
          >
            {EMOJIS.map(emoji => (
              <TouchableOpacity
                key={emoji}
                activeOpacity={0.7}
                onPress={() => {
                  onReact?.(emoji, currentMessage);
                  setTrayVisible(false);
                }}
                style={styles.emojiBtn}
              >
                <Text style={styles.emoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* 💬 MESSAGE */}
      <View style={styles.messageContainer}>
        <Swipeable
          ref={swipeRef}
          friction={2}
          overshootLeft={false}
          overshootRight={false}
          leftThreshold={40}
          rightThreshold={40}
          onSwipeableWillOpen={dir => handleSwipeTrigger(dir)}
          renderLeftActions={isRight ? undefined : renderLeftActions}
          renderRightActions={!isRight ? undefined : renderLeftActions}
        >
          <View style={[styles.bubble, isRight ? styles.right : styles.left]}>
            <Pressable onLongPress={handleLongPress}>
              <Text style={styles.messageText}>
                {currentMessage.text || ''}
              </Text>
            </Pressable>

            {/* Reaction badge */}
            <Pressable
              style={[
                styles.badge,
                isRight ? styles.badgeRight : styles.badgeLeft,
              ]}
              onPress={onPressReactions}
            >
              <Text style={styles.badgeText}>❤️ 2</Text>
            </Pressable>
          </View>
        </Swipeable>
      </View>
    </View>
  );
}

const renderLeftActions = () => (
  <View style={styles.leftContainer}>
    <View style={styles.leftAction}>
      <ReplyAll size={18} color="#fff" />
    </View>
  </View>
);


const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },

  messageContainer: {
    marginBottom: 8,
  },

  bubble: {
    maxWidth: '72%',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },

  left: {
    alignSelf: 'flex-start',
    marginLeft: 10,
    backgroundColor: colorss.backgroundDeep,
  },

  right: {
    alignSelf: 'flex-end',
    marginRight: 10,
    backgroundColor: colorss.accent,
  },

  messageText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 18,
  },

  /* -------- TRAY -------- */
  tray: {
    position: 'absolute',
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    elevation: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },

  emojiBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },

  emoji: {
    fontSize: 26,
  },

  /* -------- ACTIONS -------- */
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leftAction: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    borderRadius: 99,
    padding: 6,
    height: 32,
    width: 32,
  },

  /* -------- BADGE -------- */
  badge: {
    position: 'absolute',
    bottom: -14,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 0.5,
    borderColor: '#ddd',
  },

  badgeLeft: { left: 8 },
  badgeRight: { right: 8 },

  badgeText: {
    fontSize: 12,
  },
});
