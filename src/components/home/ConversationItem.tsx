import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radius, fonts, spacing, colorss } from '../../theme';
import FastImage from '@d11/react-native-fast-image';

type Item = {
  id: string;
  name: string;
  emoji?: string;
  preview: string;
  time: string;
  unreadCount: number;
  isTyping?: boolean;
  isUnread?: boolean;
  avatarUrl?: string | null;
};

const ConversationItem = ({
  item,
  onPress,
  onLongPress,
}: {
  item: Item;
  onPress?: () => void;
  onLongPress?: () => void;
}) => {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
      onLongPress={onLongPress}
    >
      <View style={styles.avatarWrap}>
        {item.avatarUrl ? (
          <FastImage source={{ uri: item.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarInitialWrap]}>
            <Text style={styles.avatarInitial}>
              {(item.name ?? '?').trim().charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.time}>{item.time}</Text>
        </View>
        <Text
          style={[styles.preview, item.isUnread && styles.previewUnread]}
          numberOfLines={1}
        >
          {item.isTyping ? (
            <Text style={styles.typingText}>Typing...</Text>
          ) : (
            item.preview
          )}
        </Text>
      </View>

      {item.unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {item.unreadCount > 9 ? '9+' : item.unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitialWrap: {
    backgroundColor: colorss.primary,
  },
  avatarInitial: {
    color: colors.white,
    fontSize: 18,
    fontWeight: fonts.bold,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 3,
  },
  name: {
    fontSize: 15,
    fontWeight: fonts.semibold,
    color: colorss.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  },
  time: {
    fontSize: 11,
    color: colors.textMuted,
  },
  preview: {
    fontSize: 13,
    color: colorss.textSecondary,
  },
  previewUnread: {
    color: colorss.textPrimary,
    fontWeight: fonts.medium,
  },
  typingText: {
    color: colors.purpleLight,
    fontStyle: 'italic',
    fontSize: 13,
  },
  badge: {
    backgroundColor: colorss.primary,
    minWidth: 20,
    height: 20,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: fonts.bold,
  },
});

export default ConversationItem;
