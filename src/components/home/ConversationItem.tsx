import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { colors, radius, fonts, spacing, colorss } from '../../theme';
import { IC_PROFILE } from '../../assets';

const ConversationItem = ({ item, onPress, onLongPress }) => {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
      onLongPress={onLongPress}
    >
      <View style={styles.avatarWrap}>
        <Image source={IC_PROFILE} style={styles.avatar} />
        {item.isOnline && <View style={styles.onlineDot} />}
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
    paddingVertical: spacing.md,
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
  avatarEmoji: {
    fontSize: 22,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: radius.full,
    backgroundColor: colors.online,
    borderWidth: 2.5,
    borderColor: colors.background,
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
