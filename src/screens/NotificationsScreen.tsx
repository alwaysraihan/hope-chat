import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  SectionList,
} from 'react-native';

import {
  ChevronLeft,
  Settings2,
  BookMarked,
  CreditCard,
  Bell,
  Crown,
} from 'lucide-react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';

// ─────────────────────────────────────────────

const FILTERS = ['All', 'Remainders', 'Payment', 'Booking'];
const NOTIFICATIONS = [
  {
    id: 'Today',
    data: [
      {
        id: '1',
        type: 'booking',
        title: 'Booking confirmed!',
        time: '10:04 am',
        message: 'Your booking for Slot-02 is confirmed for 23. Please ',
        highlight: 'view details',
        suffix: ' for more info',
        category: 'Booking',
      },
      {
        id: '2',
        type: 'payment',
        title: 'Payment Method Saved',
        time: '9:23 am',
        message:
          'Your payment method has been securely saved and is now ready to use for future transactions',
        category: 'Payment',
      },
    ],
  },
  {
    id: 'Earlier',
    data: [
      {
        id: '3',
        type: 'bell',
        title: 'Session reminder',
        time: '10:04 am',
        message:
          "You have an upcoming session. Don't forget to show up on time!",
        category: 'Remainders',
      },
      {
        id: '4',
        type: 'bell',
        title: 'Session cancelled',
        time: '9:23 am',
        message: 'Your booking has been cancelled. You can ',
        highlight: 'reschedule',
        suffix: ' anytime',
        category: 'Remainders',
      },
      {
        id: '5',
        type: 'payment',
        title: 'Payment successful',
        time: '9:45 am',
        message:
          'Thank you for your purchase! A confirmation email has been sent to your address.',
        category: 'Payment',
      },
      {
        id: '6',
        type: 'crown',
        title: 'Goal Achieved',
        time: '9:45 am',
        message: "Great job! You've attended your 30th class in your journey",
        category: 'All',
      },
    ],
  },
];

// ─────────────────────────────────────────────

const ICONS = {
  booking: BookMarked,
  payment: CreditCard,
  bell: Bell,
  crown: Crown,
};

// ─────────────────────────────────────────────

const NotifIcon = ({ type }) => {
  const Icon = ICONS[type] || Bell;

  return (
    <View style={styles.iconContainer}>
      <Icon size={20} color={theme.textPrimary} strokeWidth={1.8} />
    </View>
  );
};

// ─────────────────────────────────────────────

const NotificationItem = React.memo(({ item, isLast }) => {
  return (
    <View style={[styles.notificationItem, !isLast && styles.divider]}>
      <NotifIcon type={item.type} />

      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <Text style={styles.notificationTitle}>{item.title}</Text>

          <Text style={styles.notificationTime}>{item.time}</Text>
        </View>

        <Text style={styles.notificationText}>
          {item.message}

          {item.highlight && (
            <Text style={styles.notificationLink}>{item.highlight}</Text>
          )}

          {item.suffix}
        </Text>
      </View>
    </View>
  );
});

// ─────────────────────────────────────────────

export default function NotificationsScreen() {
  const [activeFilter, setActiveFilter] = useState('All');

  const filteredSections = useMemo(() => {
    return NOTIFICATIONS.map(section => ({
      ...section,
      data:
        activeFilter === 'All'
          ? section.data
          : section.data.filter(
              item => item.category === activeFilter || item.category === 'All',
            ),
    })).filter(section => section.data.length > 0);
  }, [activeFilter]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton}>
          <ChevronLeft size={24} color={theme.textPrimary} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Notifications</Text>

        <TouchableOpacity style={styles.iconButton}>
          <Settings2 size={22} color={theme.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Notifications */}
      <SectionList
        ListHeaderComponent={
          <FlatList
            data={FILTERS}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={item => item}
            contentContainerStyle={styles.filterContainer}
            renderItem={({ item }) => {
              const active = activeFilter === item;

              return (
                <TouchableOpacity
                  onPress={() => setActiveFilter(item)}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                >
                  <Text
                    style={[
                      styles.filterText,
                      active && styles.filterTextActive,
                    ]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        }
        sections={filteredSections}
        keyExtractor={item => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.sectionContainer}
        showsVerticalScrollIndicator={false}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionTitle}>{section.id}</Text>
        )}
        renderItem={({ item, index, section }) => (
          <NotificationItem
            item={item}
            isLast={index === section.data.length - 1}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  headerTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: theme.textPrimary,
    letterSpacing: -0.4,
  },

  iconButton: {
    padding: 6,
  },

  // Filters
  filterContainer: {
    paddingHorizontal: 16,
    paddingBottom: 18,
    gap: 10,
  },

  filterChip: {
    minHeight: 38,
    paddingHorizontal: 18,

    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.border,

    backgroundColor: theme.white,

    justifyContent: 'center',
    alignItems: 'center',
  },

  filterChipActive: {
    backgroundColor: theme.textPrimary,
    borderColor: theme.textPrimary,
  },

  filterText: {
    fontSize: 13,
    fontWeight: '500',

    includeFontPadding: false,
    textAlignVertical: 'center',

    color: theme.textSecondary,
  },

  filterTextActive: {
    color: theme.white,
  },

  // Sections
  sectionContainer: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 12,
    marginTop: 8,
  },

  // Notification Item
  notificationItem: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 16,
  },

  divider: {
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },

  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: theme.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  notificationContent: {
    flex: 1,
  },

  notificationHeader: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },

  notificationTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: theme.textPrimary,
  },

  notificationTime: {
    fontSize: 12,
    color: theme.textMuted,
  },

  notificationText: {
    fontSize: 13,
    lineHeight: 20,
    color: theme.textSecondary,
  },

  notificationLink: {
    fontWeight: '700',
    color: theme.textPrimary,
    textDecorationLine: 'underline',
  },
});
