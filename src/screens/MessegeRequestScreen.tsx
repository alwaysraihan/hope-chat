import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, MoreVertical } from 'lucide-react-native';
import { colorss as C } from '../theme';
import { IC_PROFILE } from '../assets';

const YOU_MAY_KNOW = [
  {
    id: '1',
    name: 'Michael Johnson',
    msg: 'Hey, we met at the conference!',
    time: 'Apr 12',
    colorIndex: 0,
  },
  { id: '2', name: 'Emily Carter', msg: '👍 · Jan 8', time: '', colorIndex: 3 },
  {
    id: '3',
    name: 'David Williams',
    msg: 'Check this out: https://example.com',
    time: 'Dec 26',
    colorIndex: 2,
  },
  {
    id: '4',
    name: 'Tech Innovators',
    msg: 'You left the group.',
    time: 'Sept 21',
    colorIndex: 7,
    online: true,
  },
  {
    id: '5',
    name: 'Chris Brown',
    msg: 'Sent you a photo.',
    time: 'Oct 8',
    colorIndex: 5,
  },
  {
    id: '6',
    name: 'Daily Deals USA',
    msg: 'You left the group.',
    time: 'Jun 17',
    colorIndex: 6,
  },
  {
    id: '7',
    name: 'Sophia Martinez',
    msg: '👍 · Jan 14',
    time: '',
    colorIndex: 1,
  },
];

const SPAM = [
  {
    id: 's1',
    name: 'Unknown Sender',
    msg: 'Claim your reward now!',
    time: '2 days ago',
    colorIndex: 4,
  },
  {
    id: 's2',
    name: 'Promo Alerts',
    msg: 'You’ve won a free iPhone!',
    time: '1 week ago',
    colorIndex: 6,
  },
];

export const MessageRequestsScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('know');
  const data = activeTab === 'know' ? YOU_MAY_KNOW : SPAM;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* NAV */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => navigation?.goBack()}>
          <ArrowLeft size={22} color={C.textPrimary} />
        </TouchableOpacity>

        <Text style={styles.navTitle}>Message requests</Text>

        <TouchableOpacity>
          <MoreVertical size={22} color={C.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* TABS */}
      <View style={styles.tabBar}>
        {['know', 'spam'].map(tab => (
          <TouchableOpacity
            key={tab}
            style={styles.tab}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab && styles.tabTextActive,
              ]}
            >
              {tab === 'know' ? 'YOU MAY KNOW' : 'SPAM'}
            </Text>

            {activeTab === tab && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* INFO */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoText}>
            Open a chat to learn more about who sent it. They won’t know you’ve
            seen it until you reply.{' '}
            <Text style={styles.link}>Choose who can message you</Text>
          </Text>
        </View>

        {/* LIST */}
        {data.map((item, index) => (
          <React.Fragment key={item.id}>
            <TouchableOpacity style={styles.item}>
              <Image
                source={IC_PROFILE}
                style={{ width: 52, height: 52, borderRadius: 26 }}
              />

              <View style={styles.itemContent}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemMsg}>
                  {item.msg}
                  {item.time && (
                    <Text style={styles.itemTime}> · {item.time}</Text>
                  )}
                </Text>
              </View>
            </TouchableOpacity>

            {index < data.length - 1 && <View style={styles.divider} />}
          </React.Fragment>
        ))}

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── STYLES ───────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.background },

  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  navTitle: {
    color: C.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },

  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
  },
  tabText: {
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: C.textPrimary,
    fontWeight: '700',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    height: 2.5,
    backgroundColor: C.textPrimary,
  },

  infoBanner: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  infoText: {
    color: C.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  link: {
    color: C.primary,
    fontWeight: '500',
  },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  itemContent: { flex: 1 },
  itemName: {
    color: C.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  itemMsg: {
    color: C.textSecondary,
    fontSize: 13,
  },
  itemTime: {
    color: C.textSecondary,
    fontSize: 13,
  },

  divider: {
    height: 1,
    backgroundColor: C.border,
    marginLeft: 84,
  },
});
