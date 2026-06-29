import React from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Ban,
  Bell,
  Eye,
  FileText,
  Image as ImageIcon,
  LogOut,
  MessageCircle,
  Moon,
  Shield,
  Timer,
  User,
} from 'lucide-react-native';
import FastImage from '@d11/react-native-fast-image';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colorss } from '../theme';
import { IC_PROFILE } from '../assets';
import { RootStackNavigatorParamList } from '../types/navigators';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { selectHopenityProfile } from '../redux/features/auth/authSlice';
import { useT } from '../hooks/useT';
import { performLogout } from '../services/logout';
import { useAppTheme } from '../context/ThemeContext';
import { isE2eeEnabled, setE2eeEnabled } from '../services/chatPrefs';

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'Settings'>;

type SettingRow = {
  id: string;
  icon: React.ReactNode;
  label: string;
  sub?: string;
  onPress?: () => void;
  rightEl?: React.ReactNode;
};

const SettingsScreen: React.FC<Props> = ({ navigation }) => {
  const t = useT();
  const dispatch = useAppDispatch();
  const profile = useAppSelector(selectHopenityProfile);
  const { isDark, colors, toggleDarkMode } = useAppTheme();
  const [e2eeOn, setE2eeOn] = React.useState(() => isE2eeEnabled());

  const iconColor = colors.textPrimary;

  const handleLogout = () => {
    Alert.alert(t.logout_confirm_title, t.logout_confirm_message, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.logout,
        style: 'destructive',
        onPress: () => {
          if (navigation.canGoBack()) navigation.goBack();
          setTimeout(() => performLogout(dispatch), 50);
        },
      },
    ]);
  };

  const DarkSwitch = (
    <Switch
      value={isDark}
      onValueChange={toggleDarkMode}
      trackColor={{ false: colorss.border, true: colors.accent }}
      thumbColor={colorss.white}
      ios_backgroundColor={colorss.border}
    />
  );

  const E2eeSwitch = (
    <Switch
      value={e2eeOn}
      onValueChange={v => { setE2eeOn(v); setE2eeEnabled(v); }}
      trackColor={{ false: colorss.border, true: colors.accent }}
      thumbColor={colorss.white}
      ios_backgroundColor={colorss.border}
    />
  );

  const sections: { title: string; rows: SettingRow[] }[] = [
    {
      title: t.section_privacy,
      rows: [
        {
          id: 'read-receipts',
          icon: <Eye size={20} color={iconColor} />,
          label: t.read_receipts,
          sub: t.read_receipts_sub,
          onPress: () => navigation.navigate('ReadReceipts'),
        },
        {
          id: 'message-perms',
          icon: <MessageCircle size={20} color={iconColor} />,
          label: t.message_permissions,
          sub: t.message_permissions_sub,
          onPress: () => navigation.navigate('MessagePermissions'),
        },
        {
          id: 'typing',
          icon: <User size={20} color={iconColor} />,
          label: t.typing_indicator,
          sub: t.typing_indicator_sub,
          onPress: () => navigation.navigate('TypingIndicator'),
        },
        {
          id: 'disappearing',
          icon: <Timer size={20} color={iconColor} />,
          label: t.disappearing_messages,
          sub: t.disappearing_messages_sub,
          onPress: () => navigation.navigate('DisappearingMessages', {}),
        },
        {
          id: 'e2ee',
          icon: <Shield size={20} color={iconColor} />,
          label: 'End-to-end encryption',
          sub: e2eeOn ? 'Messages are encrypted on your device' : 'Encryption is off',
          rightEl: E2eeSwitch,
        },
      ],
    },
    {
      title: t.section_notifications,
      rows: [
        {
          id: 'notif-sounds',
          icon: <Bell size={20} color={iconColor} />,
          label: t.notification_sounds,
          sub: t.notification_sounds_sub,
          onPress: () => navigation.navigate('NotificationsSounds'),
        },
      ],
    },
    {
      title: t.section_appearance,
      rows: [
        {
          id: 'dark-mode',
          icon: <Moon size={20} color={iconColor} />,
          label: isDark ? 'Dark mode' : 'Light mode',
          sub: isDark ? 'Switch to light mode' : 'Switch to dark mode',
          onPress: toggleDarkMode,
          rightEl: DarkSwitch,
        },
        // {
        //   id: 'theme',
        //   icon: <ImageIcon size={20} color={iconColor} />,
        //   label: t.theme,
        //   sub: t.theme_sub,
        //   onPress: () => navigation.navigate('Theme'),
        // },
      ],
    },
    {
      title: t.section_security,
      rows: [
        {
          id: 'blocked',
          icon: <Ban size={20} color={iconColor} />,
          label: t.blocked_people,
          sub: t.blocked_people_sub,
          onPress: () => navigation.navigate('BlockedPeople'),
        },
        {
          id: 'report',
          icon: <Shield size={20} color={iconColor} />,
          label: t.report_problem,
          onPress: () => navigation.navigate('ReportProblem'),
        },
        {
          id: 'auto-save',
          icon: <ImageIcon size={20} color={iconColor} />,
          label: t.auto_save,
          onPress: () => navigation.navigate('AutoSavePhotos'),
        },
        {
          id: 'privacy-policy',
          icon: <FileText size={20} color={iconColor} />,
          label: t.privacy_policy,
          sub: 'hopechat.chat/privacy-policy',
          onPress: () => Linking.openURL('https://hopechat.chat/privacy-policy/'),
        },
      ],
    },
  ];

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <View style={[styles.header, { backgroundColor: colors.cardBg, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t.settings}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={[styles.profileCard, { backgroundColor: colors.cardBg }]}>
          <FastImage
            source={profile?.avatarUrl ? { uri: profile.avatarUrl } : IC_PROFILE}
            style={styles.avatar}
          />
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: colors.textPrimary }]} numberOfLines={1}>
              {profile?.displayName ?? 'HopeChat User'}
            </Text>
            <Text style={[styles.profileSub, { color: colors.textSecondary }]} numberOfLines={1}>
              {t.hopenity_account}
            </Text>
          </View>
        </View>

        {sections.map(section => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              {section.title}
            </Text>
            <View style={[styles.sectionCard, { backgroundColor: colors.cardBg }]}>
              {section.rows.map((row, idx) => (
                <React.Fragment key={row.id}>
                  <TouchableOpacity
                    style={styles.row}
                    onPress={row.onPress}
                    activeOpacity={0.7}
                  >
                    <View style={styles.rowIcon}>{row.icon}</View>
                    <View style={styles.rowContent}>
                      <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
                        {row.label}
                      </Text>
                      {row.sub ? (
                        <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
                          {row.sub}
                        </Text>
                      ) : null}
                    </View>
                    {row.rightEl ?? (
                      <Text style={[styles.chevron, { color: colors.placeholder }]}>›</Text>
                    )}
                  </TouchableOpacity>
                  {idx < section.rows.length - 1 && (
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  )}
                </React.Fragment>
              ))}
            </View>
          </View>
        ))}

        {/* Sign out */}
        <View style={styles.section}>
          <View style={[styles.sectionCard, { backgroundColor: colors.cardBg }]}>
            <TouchableOpacity style={styles.row} onPress={handleLogout} activeOpacity={0.7}>
              <View style={styles.rowIcon}>
                <LogOut size={20} color={colorss.error} />
              </View>
              <View style={styles.rowContent}>
                <Text style={[styles.rowLabel, { color: colorss.error }]}>{t.logout}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

export default SettingsScreen;

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    marginBottom: 8,
  },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '700' },
  profileSub: { fontSize: 13, marginTop: 2 },
  section: { marginBottom: 8 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCard: {},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 14,
  },
  rowIcon: { width: 28, alignItems: 'center' },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '500' },
  rowSub: { fontSize: 12, marginTop: 2 },
  chevron: { fontSize: 20 },
  divider: { height: 1, marginLeft: 58 },
});
