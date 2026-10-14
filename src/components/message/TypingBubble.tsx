import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import FastImage from '@d11/react-native-fast-image';

import { colorss } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';

export type TypingPerson = {
  userId: string;
  name?: string;
  avatar?: string;
};

type Props = {
  people: TypingPerson[];
  /** Group threads label who is typing; a 1:1 thread needs no name. */
  showNames?: boolean;
};

const MAX_AVATARS = 3;

function Dot({ delay }: { delay: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(v, {
          toValue: 0,
          duration: 300,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(600 - delay),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, delay]);
  return (
    <Animated.View
      style={[
        styles.dot,
        {
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }],
        },
      ]}
    />
  );
}

function Avatar({ person, index }: { person: TypingPerson; index: number }) {
  const initial = (person.name ?? '').trim().charAt(0).toUpperCase() || '•';
  return (
    <View style={[styles.avatarRing, index > 0 && styles.avatarOverlap]}>
      {person.avatar ? (
        <FastImage source={{ uri: person.avatar }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Text style={styles.avatarInitial}>{initial}</Text>
        </View>
      )}
    </View>
  );
}

function typingLabel(people: TypingPerson[]): string {
  const names = people.map(p => (p.name ?? '').trim().split(/\s+/)[0]).filter(Boolean);
  if (names.length === 0) return '';
  if (names.length === 1) return `${names[0]} is typing`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing`;
  return `${names[0]} and ${names.length - 1} others are typing`;
}

/**
 * Typing indicator that shows WHO is typing — their photo on the left, like an
 * incoming message — instead of anonymous dots. In a group that is the only
 * way to tell which member the dots belong to.
 */
export default function TypingBubble({ people, showNames }: Props) {
  const { isDark, colors } = useAppTheme();
  if (people.length === 0) return null;
  const shown = people.slice(0, MAX_AVATARS);
  const label = showNames ? typingLabel(people) : '';
  return (
    <View style={styles.row} accessibilityLiveRegion="polite" accessibilityLabel={label || 'Typing'}>
      <View style={styles.avatars}>
        {shown.map((p, i) => (
          <Avatar key={p.userId} person={p} index={i} />
        ))}
      </View>
      <View>
        {label ? (
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>
        ) : null}
        <View
          style={[
            styles.bubble,
            { backgroundColor: isDark ? colors.cardBg : colors.bubbleIn },
          ]}
        >
          <Dot delay={0} />
          <Dot delay={150} />
          <Dot delay={300} />
        </View>
      </View>
    </View>
  );
}

const AVATAR = 24;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginLeft: 12,
    marginBottom: 8,
    marginTop: 2,
    gap: 6,
  },
  avatars: { flexDirection: 'row', alignItems: 'center' },
  avatarRing: {
    width: AVATAR + 2,
    height: AVATAR + 2,
    borderRadius: (AVATAR + 2) / 2,
    backgroundColor: colorss.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOverlap: { marginLeft: -8 },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  avatarPlaceholder: {
    backgroundColor: colorss.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: '#fff', fontSize: 11, fontWeight: '700' },
  label: {
    fontSize: 11,
    color: colorss.textSecondary,
    marginBottom: 2,
    marginLeft: 4,
    maxWidth: 220,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 18,
    borderTopLeftRadius: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colorss.textSecondary,
  },
});
