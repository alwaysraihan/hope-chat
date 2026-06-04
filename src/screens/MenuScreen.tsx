import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
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
  ChevronDown,
  LucideArchive,
  LucideGlobe,
  LucideLogOut,
  LucideMessageCircleMore,
  LucideSettings,
  LucideUsers,
  Phone,
} from 'lucide-react-native';
import FastImage from '@d11/react-native-fast-image';
import { IC_PROFILE } from '../assets';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import {
  selectHopenityProfile,
  selectActivePage,
  setActivePage,
} from '../redux/features/auth/authSlice';
import { useLanguage } from '../context/LanguageContext';
import { openHopenityBestEffort } from '../services/hopenityLinking';
import { useT } from '../hooks/useT';
import { performLogout } from '../services/logout';
import { fetchMyPages, type OwnedPage } from '../services/pageService';
import { selectAuthToken } from '../redux/features/auth/authSlice';

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
  const token = useAppSelector(selectAuthToken);
  const activePage = useAppSelector(selectActivePage);
  const isVerified = !!profile?.isVerified;
  const { lang, setLang } = useLanguage();

  const [pages, setPages] = useState<OwnedPage[]>([]);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [showSwitcher, setShowSwitcher] = useState(false);

  useEffect(() => {
    if (!token) return;
    setPagesLoading(true);
    fetchMyPages(token).then(p => {
      setPages(p);
      setPagesLoading(false);
    });
  }, [token]);

  const switchTo = (page: OwnedPage | null) => {
    dispatch(setActivePage(page));
    setShowSwitcher(false);
  };

  const currentName  = activePage?.name  ?? profile?.displayName ?? 'HopeChat User';
  const currentImage = activePage?.image ?? profile?.avatarUrl   ?? null;

  const handleLogout = () => {
    Alert.alert(t.logout_confirm_title, t.logout_confirm_message, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.logout,
        style: 'destructive',
        onPress: () => performLogout(dispatch),
      },
    ]);
  };

  const menuItems = [
    { id: 'settings',         title: t.settings,              icon: <LucideSettings size={20} color={colors.textPrimary} />,           onPress: () => navigation.navigate('Settings') },
    { id: 'message-requests', title: t.message_requests_label, icon: <LucideMessageCircleMore size={20} color={colors.textPrimary} />,  onPress: () => navigation.navigate('MessageRequests') },
    { id: 'archive',          title: t.archive_label,          icon: <LucideArchive size={20} color={colors.textPrimary} />,            onPress: () => navigation.navigate('Archive') },
    { id: 'friend-requests',  title: activePage ? 'Followers' : t.friend_requests, icon: <LucideUsers size={20} color={colors.textPrimary} />, onPress: () => void openHopenityBestEffort().catch(() => undefined) },
    {
      id: 'premium-calls',
      title: 'Premium Calls',
      icon: <Phone size={20} color={colors.primary} />,
      onPress: () => navigation.navigate('PremiumCallSetup'),
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Text style={styles.heading}>{t.menu}</Text>

      <TouchableOpacity
        style={styles.profileRow}
        onPress={() => setShowSwitcher(v => !v)}
        activeOpacity={0.75}
      >
        <FastImage
          source={currentImage ? { uri: currentImage } : IC_PROFILE}
          style={styles.avatar}
        />
        <View style={styles.profileText}>
          <Text style={styles.displayName} numberOfLines={1}>{currentName}</Text>
          <Text style={styles.profileSub} numberOfLines={1}>
            {activePage ? 'Page · tap to switch' : 'Personal · tap to switch'}
          </Text>
        </View>
        <ChevronDown
          size={18}
          color={colors.textSecondary}
          style={{ transform: [{ rotate: showSwitcher ? '180deg' : '0deg' }] }}
        />
      </TouchableOpacity>

      {/* Account switcher panel */}
      {showSwitcher && (
        <View style={styles.switcherPanel}>
          {/* Personal row */}
          <TouchableOpacity
            style={[styles.switcherRow, !activePage && styles.switcherRowActive]}
            onPress={() => switchTo(null)}
            activeOpacity={0.7}
          >
            <FastImage
              source={profile?.avatarUrl ? { uri: profile.avatarUrl } : IC_PROFILE}
              style={styles.switcherAvatar}
            />
            <View style={styles.switcherInfo}>
              <Text style={styles.switcherName}>{profile?.displayName ?? 'Personal'}</Text>
              <Text style={styles.switcherSub}>Personal account</Text>
            </View>
            {!activePage && <View style={styles.switcherDot} />}
          </TouchableOpacity>

          {pagesLoading && <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 8 }} />}

          {pages.map(page => (
            <TouchableOpacity
              key={page.id}
              style={[styles.switcherRow, activePage?.id === page.id && styles.switcherRowActive]}
              onPress={() => switchTo(page)}
              activeOpacity={0.7}
            >
              <FastImage
                source={page.image ? { uri: page.image } : IC_PROFILE}
                style={styles.switcherAvatar}
              />
              <View style={styles.switcherInfo}>
                <Text style={styles.switcherName}>{page.name}</Text>
                <Text style={styles.switcherSub}>Page</Text>
              </View>
              {activePage?.id === page.id && <View style={styles.switcherDot} />}
            </TouchableOpacity>
          ))}

          {!pagesLoading && pages.length === 0 && (
            <Text style={styles.switcherEmpty}>You don't have any pages yet.</Text>
          )}
        </View>
      )}

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

  // ── Account switcher ───────────────────────────────────────────────
  switcherPanel: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    marginBottom: 12,
    overflow: 'hidden',
  },
  switcherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 12,
  },
  switcherRowActive: {
    backgroundColor: `${colors.primary}12`,
  },
  switcherAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
  },
  switcherInfo: { flex: 1 },
  switcherName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  switcherSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  switcherDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  switcherEmpty: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 12,
  },
});
