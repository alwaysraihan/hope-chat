import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import FastImage from '@d11/react-native-fast-image';

import { IC_PROFILE } from '../../assets';
import { colorss } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';

type Props = {
  peerName: string;
  subtitle?: string;
  prompt: string;
  avatarUrl?: string | null;
  messagesExist?: Boolean;
};

/**
 * Inline “conversation start” ribbon (Instagram / Hopenity style) above timestamps.
 */
export default function ChatThreadIntroCard({
  peerName,
  subtitle = "You're friends on Hopenity",
  prompt,
  avatarUrl,
  messagesExist,
}: Props) {
  const { colors, isDark } = useAppTheme();
  return (
    <View style={styles.wrap}>
      <View style={styles.avatarRing}>
        {avatarUrl ? (
          <FastImage source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <FastImage source={IC_PROFILE} style={styles.avatar} />
        )}
      </View>

      <Text
        style={[
          styles.peerName,
          {
            color: colors.textPrimary,
          },
        ]}
      >
        {peerName}
      </Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        {subtitle}
      </Text>

      {messagesExist ? null : (
        <>
          <View style={styles.mutualRow}>
            <View style={styles.mutualDot} />
            <View style={[styles.mutualDot, styles.mutualDotSecond]} />
          </View>
          <Text style={styles.prompt}>{prompt}</Text>{' '}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
    maxWidth: '100%',
  },
  avatarRing: {
    borderWidth: 2,
    borderColor: `${colorss.primary}55`,
    borderRadius: 60,
    padding: 4,
    marginBottom: 8,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  peerName: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    marginBottom: 10,
  },
  mutualRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  mutualDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#dfe2ea',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  mutualDotSecond: { marginLeft: -12 },
  prompt: {
    fontSize: 13,
    color: colorss.textMuted ?? colorss.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 8,
  },
});
