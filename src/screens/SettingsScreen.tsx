import { SectionList, StyleSheet, Switch, Text, View } from 'react-native';
import React from 'react';
import { colorss } from '../theme';
import { IC_PROFILE } from '../assets';
import FastImage from '@d11/react-native-fast-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AtSign,
  Bell,
  ChevronRight,
  MessageCircle,
  Moon,
  Phone,
  Users,
} from 'lucide-react-native';

const SettingsScreen = () => {
  const contents = [
    {
      id: 1,
      title: 'Hello',
      data: [
        {
          id: 1,
          title: 'Dark Mode',
          icon: <Moon size={18} color={colorss.white} fill={colorss.white} />,
          iconBg: colorss.darkBg,
          rightSection: (
            <Switch
              value={false}
              trackColor={{
                false: colorss.border,
                true: colorss.primary,
              }}
              thumbColor={colorss.white}
              ios_backgroundColor={colorss.border}
            />
          ),
        },
        {
          id: 2,
          title: 'Active Status',
          icon: <Moon size={18} color={colorss.white} fill={colorss.white} />,
          iconBg: colorss.darkBg,
          rightSection: (
            <View style={styles.rowMeta}>
              <Text style={styles.metaText}>On</Text>
              <ChevronRight size={16} color={colorss.placeholder} />
            </View>
          ),
        },
        {
          id: 3,
          title: 'Username',
          icon: <AtSign size={18} color={colorss.white} />,
          iconBg: colorss.error,
          rightSection: (
            <View style={styles.rowMeta}>
              <Text style={styles.metaText}>emonhossain</Text>
              <ChevronRight size={16} color={colorss.placeholder} />
            </View>
          ),
        },
        {
          id: 4,
          title: 'Phone',
          icon: <Phone size={18} color={colorss.white} fill={colorss.white} />,
          iconBg: colorss.accent,
          rightSection: (
            <View style={styles.rowMeta}>
              <Text style={styles.metaText}>+8801 234 567 890</Text>
              <ChevronRight size={16} color={colorss.placeholder} />
            </View>
          ),
        },
      ],
    },
    {
      id: 2,
      title: 'preferences',
      data: [
        {
          id: 1,
          title: 'Notifications & Sounds',
          icon: <Bell size={18} color={colorss.white} fill={colorss.white} />,
          iconBg: colorss.accent,
          rightSection: <ChevronRight size={16} color={colorss.placeholder} />,
        },
        {
          id: 2,
          title: 'People',
          icon: <Users size={18} color={colorss.white} fill={colorss.white} />,
          iconBg: colorss.accent,
          rightSection: <ChevronRight size={16} color={colorss.placeholder} />,
        },
        {
          id: 3,
          title: 'Messaging Settings',
          icon: (
            <MessageCircle
              size={18}
              color={colorss.white}
              fill={colorss.white}
            />
          ),
          iconBg: colorss.accent,
          rightSection: <ChevronRight size={16} color={colorss.placeholder} />,
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'top']}>
      <View style={styles.topBar}>
        <Text style={styles.doneText}>Settings</Text>
        <Text style={styles.doneText}>Done</Text>
      </View>

      <View style={styles.profileBox}>
        <FastImage source={IC_PROFILE} style={styles.avatar} />
        <Text style={styles.name}>MD Emon Hossain</Text>
      </View>

      <SectionList
        sections={contents}
        keyExtractor={item => String(item.id)}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View key={item.id} style={styles.rowContainer}>
            <View style={[styles.iconWrap, { backgroundColor: item.iconBg }]}>
              {item.icon}
            </View>
            <View style={styles.rowInner}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              {item.rightSection}
            </View>
          </View>
        )}
        renderSectionHeader={({ section }) => {
          if (section.id === 1) return null;
          return <Text style={styles.sectionHeader}>{section.title}</Text>;
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
};

export default SettingsScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colorss.white,
    paddingHorizontal: 20,
  },

  /* ── Top bar ── */
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 8,
  },
  doneText: {
    fontSize: 16,
    fontWeight: '600',
    color: colorss.textPrimary,
    letterSpacing: 0.1,
  },

  /* ── Profile ── */
  profileBox: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: 12,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: colorss.textPrimary,
    letterSpacing: -0.2,
  },

  /* ── List ── */
  listContent: {
    paddingBottom: 32,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: colorss.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 28,
    marginBottom: 10,
  },

  /* ── Row ── */
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colorss.border,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colorss.textPrimary,
    flex: 1,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  metaText: {
    fontSize: 15,
    fontWeight: '400',
    color: colorss.textSecondary,
  },
  separator: {
    height: 0,
  },
});
