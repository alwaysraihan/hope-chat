import React from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BottomTabNavigatorParamList,
  RootStackNavigatorParamList,
} from '../types/navigators';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  LucideArchive,
  LucideGlobe,
  LucideLogOut,
  LucideMessageCircleMore,
  LucideSettings,
  LucideUsers,
} from 'lucide-react-native';
import { IC_PROFILE } from '../assets';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { clearAuth, selectHopenityProfile } from '../redux/features/auth/authSlice';
import { clearPersistedHopenityUser } from '../services/hopenitySharedAuth';
import { useLanguage } from '../context/LanguageContext';
import { openHopenityBestEffort } from '../services/hopenityLinking';
import { useT } from '../hooks/useT';

type Props = CompositeScreenProps<
  BottomTabScreenProps<BottomTabNavigatorParamList, 'Menu'>,
  NativeStackScreenProps<RootStackNavigatorParamList>
>;

const colors = {
  primary: '#FF4E8C',
  background: '#f9fafb',
  surface: '#FFFFFF',
  textPrimary: '#10182B',
  textSecondary: '#4A5568',
  divider: '#E5E7EB',
  error: '#EF4444',
};

const MenuScreen: React.FC<Props> = ({ navigation }) => {
  const t = useT();
  const dispatch = useAppDispatch();
  const profile = useAppSelector(selectHopenityProfile);
  const { lang, setLang } = useLanguage();

  const handleLogout = () => {
    Alert.alert(t.logout_confirm_title, t.logout_confirm_message, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.logout,
        style: 'destructive',
        onPress: () => {
          clearPersistedHopenityUser();
          dispatch(clearAuth());
        },
      },
    ]);
  };

  const menuItems = [
    { id: 'settings',         title: t.settings,              icon: <LucideSettings size={20} color={colors.textPrimary} />,           onPress: () => navigation.navigate('Settings') },
    { id: 'message-requests', title: t.message_requests_label, icon: <LucideMessageCircleMore size={20} color={colors.textPrimary} />,  onPress: () => navigation.navigate('MessageRequests') },
    { id: 'archive',          title: t.archive_label,          icon: <LucideArchive size={20} color={colors.textPrimary} />,            onPress: () => navigation.navigate('Archive') },
    { id: 'friend-requests',  title: t.friend_requests,        icon: <LucideUsers size={20} color={colors.textPrimary} />,              onPress: () => void openHopenityBestEffort().catch(() => undefined) },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Text style={styles.heading}>{t.menu}</Text>

      <View style={styles.profileRow}>
        <Image
          source={profile?.avatarUrl ? { uri: profile.avatarUrl } : IC_PROFILE}
          style={styles.avatar}
        />
        <View style={styles.profileText}>
          <Text style={styles.displayName} numberOfLines={1}>
            {profile?.displayName ?? 'HopeChat User'}
          </Text>
          <Text style={styles.profileSub} numberOfLines={1}>{t.view_profile}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        {/* Main menu items */}
        {menuItems.map((item, idx) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.row, idx > 0 && styles.rowBorder]}
            onPress={item.onPress}
            activeOpacity={0.65}
          >
            <View style={styles.iconWrap}>{item.icon}</View>
            <Text style={styles.rowLabel}>{item.title}</Text>
          </TouchableOpacity>
        ))}

        <View style={styles.divider} />

        {/* Language toggle */}
        <View style={styles.row}>
          <View style={styles.iconWrap}>
            <LucideGlobe size={20} color={colors.textPrimary} />
          </View>
          <Text style={styles.rowLabel}>{t.language}</Text>
          <View style={styles.langToggle}>
            {(['en', 'bn'] as const).map(option => (
              <TouchableOpacity
                key={option}
                onPress={() => setLang(option)}
                style={[
                  styles.langBtn,
                  lang === option && styles.langBtnActive,
                ]}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.langBtnText,
                    lang === option && styles.langBtnTextActive,
                  ]}
                >
                  {option === 'en' ? t.english : t.bangla}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.divider} />

        {/* Logout */}
        <TouchableOpacity
          style={styles.row}
          onPress={handleLogout}
          activeOpacity={0.65}
        >
          <View style={styles.iconWrap}>
            <LucideLogOut size={20} color={colors.error} />
          </View>
          <Text style={[styles.rowLabel, { color: colors.error }]}>
            {t.logout}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

export default MenuScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#E5E7EB',
  },
  profileText: {
    flex: 1,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  profileSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: 8,
  },
  scroll: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    gap: 12,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  iconWrap: {
    width: 28,
    alignItems: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  langToggle: {
    flexDirection: 'row',
    gap: 6,
  },
  langBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  langBtnActive: {
    backgroundColor: colors.primary,
  },
  langBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  langBtnTextActive: {
    color: '#FFFFFF',
  },
});
