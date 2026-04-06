import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { colors, fonts, spacing } from '../../theme';

const TAB_ICONS = {
  Chats: ({ active }) => (
    <View style={styles.iconWrap}>
      <View style={[styles.bubbleRect, active && styles.bubbleRectActive]} />
      <View style={[styles.bubbleTail, active && styles.bubbleTailActive]} />
    </View>
  ),
  People: ({ active }) => (
    <View style={styles.iconWrap}>
      <View style={[styles.personHead, active && styles.activeStroke]} />
      <View style={[styles.personBody, active && styles.activeStrokeBody]} />
    </View>
  ),
  Discover: ({ active }) => (
    <View style={[styles.discoverGrid]}>
      {[0, 1, 2, 3].map(i => (
        <View
          key={i}
          style={[
            styles.discoverSquare,
            active && styles.discoverSquareActive,
          ]}
        />
      ))}
    </View>
  ),
  Profile: ({ active }) => (
    <View style={styles.iconWrap}>
      <View style={[styles.profileHead, active && styles.profileHeadActive]} />
      <View style={[styles.profileShoulder, active && styles.profileShoulderActive]} />
    </View>
  ),
};

const tabs = ['Chats', 'People', 'Discover', 'Profile'];

const BottomTabBar = ({ activeTab = 'Chats', onTabPress }) => {
  return (
    <View style={styles.container}>
      {tabs.map(tab => {
        const active = activeTab === tab;
        const Icon = TAB_ICONS[tab];
        return (
          <TouchableOpacity
            key={tab}
            style={styles.tab}
            onPress={() => onTabPress && onTabPress(tab)}
            activeOpacity={0.7}
          >
            <View style={styles.tabIconArea}>
              <Icon active={active} />
              {tab === 'Profile' && <View style={styles.profileDot} />}
            </View>
            <Text style={[styles.label, active && styles.labelActive]}>{tab}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 10,
    paddingBottom: 28,
    backgroundColor: '#0d0d1a',
    borderTopWidth: 0.5,
    borderTopColor: '#1e1e30',
  },
  tab: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingTop: 4,
    borderRadius: 12,
  },
  tabIconArea: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  label: {
    fontSize: 10,
    fontWeight: fonts.medium,
    color: colors.textMuted,
  },
  labelActive: {
    color: colors.purple,
  },
  iconWrap: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  // Chats icon
  bubbleRect: {
    width: 18,
    height: 14,
    borderRadius: 4,
    borderWidth: 1.8,
    borderColor: colors.textMuted,
    position: 'absolute',
    top: 0,
    left: 2,
  },
  bubbleRectActive: {
    borderColor: colors.purple,
  },
  bubbleTail: {
    width: 5,
    height: 5,
    borderBottomWidth: 1.8,
    borderLeftWidth: 1.8,
    borderColor: colors.textMuted,
    position: 'absolute',
    bottom: 1,
    left: 3,
    transform: [{ rotate: '15deg' }],
  },
  bubbleTailActive: {
    borderColor: colors.purple,
  },
  // People icon
  personHead: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.8,
    borderColor: colors.textMuted,
    position: 'absolute',
    top: 0,
    left: 7,
  },
  activeStroke: {
    borderColor: colors.purple,
  },
  personBody: {
    width: 14,
    height: 7,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    borderWidth: 1.8,
    borderColor: colors.textMuted,
    borderBottomWidth: 0,
    position: 'absolute',
    bottom: 0,
    left: 4,
  },
  activeStrokeBody: {
    borderColor: colors.purple,
  },
  // Discover icon
  discoverGrid: {
    width: 18,
    height: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  discoverSquare: {
    width: 7,
    height: 7,
    borderRadius: 1,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
  },
  discoverSquareActive: {
    borderColor: colors.purple,
  },
  // Profile icon
  profileHead: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.8,
    borderColor: colors.textMuted,
    position: 'absolute',
    top: 0,
    left: 6,
  },
  profileHeadActive: {
    borderColor: colors.purple,
  },
  profileShoulder: {
    width: 16,
    height: 7,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 1.8,
    borderColor: colors.textMuted,
    borderBottomWidth: 0,
    position: 'absolute',
    bottom: 0,
    left: 3,
  },
  profileShoulderActive: {
    borderColor: colors.purple,
  },
  profileDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.purple,
    position: 'absolute',
    top: -1,
    right: -2,
  },
});

export default BottomTabBar;
