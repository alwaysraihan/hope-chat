import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colorss } from '../theme';
import { IC_PROFILE } from '../assets';
import type {
  BottomTabNavigatorParamList,
  RootStackNavigatorParamList,
} from '../types/navigators';
import { openHopenityBestEffort } from '../services/hopenityLinking';

/** Hope Chat actionable items vs main Hopenity social graph (deep link into Hopenity). */
type NotificationSource = 'hope_chat' | 'hopenity_world';

type NotifRow = {
  id: string;
  section: string;
  name: string;
  message: string;
  time: string;
  unread: boolean;
  source: NotificationSource;
  /** When hope_chat — optional routing hint */
  target?: 'inbox_demo' | 'requests';
};

const ROWS: NotifRow[] = [
  {
    id: 'hc1',
    section: 'Today',
    name: 'Hope Chat',
    message: 'You have unread messages.',
    source: 'hope_chat',
    target: 'inbox_demo',
    time: '2m',
    unread: true,
  },
  {
    id: 'hw1',
    section: 'Today',
    name: 'Hopenity · Story',
    source: 'hopenity_world',
    message: 'Maria reacted 🔥 on your story.',
    time: '18m',
    unread: true,
  },
  {
    id: 'hw2',
    section: 'Today',
    name: 'Hopenity',
    source: 'hopenity_world',
    message: 'New follower: James.',
    time: '52m',
    unread: false,
  },
  {
    id: 'hw3',
    section: 'Earlier',
    name: 'Hopenity · Post',
    source: 'hopenity_world',
    message: 'Taylor mentioned you in a comment.',
    time: '3h',
    unread: false,
  },
  {
    id: 'hc2',
    section: 'Earlier',
    name: 'Hope Chat · Requests',
    source: 'hope_chat',
    target: 'requests',
    message: 'Someone wants to chat with you.',
    time: '1d',
    unread: true,
  },
  {
    id: 'hw4',
    section: 'Earlier',
    name: 'Hopenity · Feels',
    source: 'hopenity_world',
    message: 'Your feel reached 250 hearts.',
    time: '5d',
    unread: false,
  },
];

type Props = CompositeScreenProps<
  BottomTabScreenProps<BottomTabNavigatorParamList, 'Notifications'>,
  NativeStackScreenProps<RootStackNavigatorParamList>
>;

const NotificationsScreen: React.FC<Props> = ({ navigation }) => {
  const grouped = useMemo(() => {
    const m = new Map<string, NotifRow[]>();
    for (const r of ROWS) {
      const g = m.get(r.section) ?? [];
      g.push(r);
      m.set(r.section, g);
    }
    return [...m.entries()];
  }, []);

  const onPress = (item: NotifRow) => {
    if (item.source === 'hopenity_world') {
      Alert.alert(
        'Open Hopenity',
        'Social notifications live in Hopenity. Continue there now?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open app', onPress: () => void openHopenityBestEffort() },
        ],
      );
      return;
    }

    const parentNav = navigation.getParent();
    if (item.target === 'requests') {
      if (parentNav) {
        (parentNav as { navigate: (n: string) => void }).navigate(
          'MessageRequests',
        );
      }
      return;
    }
    Alert.alert('Hope Chat', 'Use Home to open your conversations.');
    navigation.navigate('Home');
  };

  const renderRow = (item: NotifRow) => (
    <TouchableOpacity
      key={item.id}
      style={styles.item}
      activeOpacity={0.7}
      onPress={() => onPress(item)}
      accessibilityHint={
        item.source === 'hopenity_world'
          ? 'Opens partner app'
          : 'Hope Chat action'
      }
    >
      <Image
        source={IC_PROFILE}
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          opacity: item.source === 'hopenity_world' ? 0.85 : 1,
        }}
      />

      <View style={styles.itemContent}>
        <View style={styles.titleRow}>
          <Text style={styles.itemText} numberOfLines={2}>
            <Text style={styles.itemName}>{item.name}</Text>{' '}
            <Text style={styles.itemMsg}>{item.message}</Text>
          </Text>
          <View
            style={[
              styles.pill,
              item.source === 'hope_chat' ? styles.pillHope : styles.pillHopenity,
            ]}
          >
            <Text style={styles.pillTxt}>
              {item.source === 'hope_chat' ? 'Hope Chat' : 'Hopenity'}
            </Text>
          </View>
        </View>

        <Text style={[styles.itemTime, item.unread && styles.itemTimeUnread]}>
          · {item.time}
        </Text>
      </View>

      {item.unread ? <View style={styles.unreadDot} /> : null}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        <Text style={styles.sub}>Hope Chat inbox vs social on Hopenity</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {grouped.map(([section, rows]) => (
          <View key={section}>
            <Text style={styles.sectionLabel}>{section}</Text>
            {rows.map(renderRow)}
          </View>
        ))}
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
  },
  title: {
    color: colorss.textPrimary,
    fontSize: 26,
    fontWeight: '700',
  },
  sub: {
    marginTop: 4,
    color: colorss.textSecondary,
    fontSize: 13,
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
  itemContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  itemText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  itemName: {
    color: colorss.textPrimary,
    fontWeight: '700',
  },
  itemMsg: {
    color: colorss.textSecondary,
    fontWeight: '400',
  },
  pill: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  pillHope: {
    backgroundColor: `${colorss.primary}22`,
  },
  pillHopenity: {
    backgroundColor: 'rgba(99,102,241,0.15)',
  },
  pillTxt: {
    fontSize: 10,
    fontWeight: '700',
    color: colorss.textPrimary,
  },
  itemTime: {
    color: colorss.textSecondary,
    fontSize: 12,
    marginTop: 4,
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
