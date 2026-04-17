import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Info } from 'lucide-react-native';

import { colorss } from '../theme';
import { IC_PROFILE } from '../assets';

const NOTIFICATIONS = [
  {
    id: '1',
    section: 'Today',
    name: 'Emily Johnson',
    message: 'Liked your photo.',
    time: '1h',
    unread: true,
  },
  {
    id: '2',
    section: 'Today',
    name: 'Michael Smith',
    message: 'Commented: Awesome!',
    time: '2h',
    unread: true,
  },
  {
    id: '3',
    section: 'Today',
    name: 'Ashley Williams',
    message: 'Sent you a friend request.',
    time: '4h',
    unread: true,
  },
  {
    id: '4',
    section: 'Earlier',
    name: 'Christopher Brown',
    message: 'You are now friends. Tap to chat.',
    time: '1d',
    unread: true,
  },
  {
    id: '5',
    section: 'Earlier',
    name: 'Jessica Davis',
    message: 'Shared a post with you.',
    time: '2d',
    unread: true,
  },
  {
    id: '6',
    section: 'Earlier',
    name: 'Daniel Miller',
    message: 'Mentioned you in a comment.',
    time: '3d',
    unread: true,
  },
  {
    id: '7',
    section: 'This Week',
    name: 'Matthew Wilson',
    message: 'Reacted 👍 to your story.',
    time: '5d',
    unread: true,
  },
  {
    id: '8',
    section: 'This Week',
    name: 'Olivia Moore',
    message: 'Started following you.',
    time: '6d',
    unread: true,
  },
  {
    id: '9',
    section: 'Older',
    name: 'David Taylor',
    message: 'Updated profile picture.',
    time: '1w',
    unread: true,
  },
  {
    id: '10',
    section: 'Older',
    name: 'Sophia Anderson',
    message: 'Liked your comment.',
    time: '2w',
    unread: true,
  },
];

const NotificationsScreen = () => {
  const todayItems = NOTIFICATIONS.filter(n => n.section === 'Today');
  const earlierItems = NOTIFICATIONS.filter(n => n.section !== 'Today');

  const renderItem = item => (
    <TouchableOpacity key={item.id} style={styles.item} activeOpacity={0.7}>
      {item.isSystem ? (
        <View style={styles.systemIcon}>
          <Info size={20} color={colorss.textPrimary} />
        </View>
      ) : (
        <Image
          source={IC_PROFILE}
          style={{ width: 52, height: 52, borderRadius: 26 }}
        />
      )}

      <View style={styles.itemContent}>
        <Text style={styles.itemText}>
          <Text style={styles.itemName}>{item.name} </Text>
          <Text style={styles.itemMsg}>{item.message}</Text>
        </Text>

        <Text style={[styles.itemTime, item.unread && styles.itemTimeUnread]}>
          · {item.time}
        </Text>
      </View>

      {item.unread && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* TODAY */}
        {todayItems.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Today</Text>
            {todayItems.map(renderItem)}
          </>
        )}

        {/* EARLIER */}
        {earlierItems.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Earlier</Text>
            {earlierItems.map(renderItem)}
          </>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

export default NotificationsScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colorss.white,
  },

  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colorss.border,
    backgroundColor: colorss.white,
  },

  title: {
    color: colorss.textPrimary,
    fontSize: 26,
    fontWeight: '700',
  },

  sectionLabel: {
    color: colorss.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },

  systemIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colorss.backgroundDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatar: {
    backgroundColor: colorss.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarText: {
    color: colorss.white,
    fontSize: 16,
    fontWeight: '700',
  },

  itemContent: {
    flex: 1,
  },

  itemText: {
    fontSize: 14,
    lineHeight: 20,
  },

  itemName: {
    color: colorss.textPrimary,
    fontWeight: '700',
  },

  itemMsg: {
    color: colorss.textSecondary,
  },

  itemTime: {
    color: colorss.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },

  itemTimeUnread: {
    color: colorss.primary,
    fontWeight: '600',
  },

  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colorss.primary,
  },
});
