import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Ban,
  Bell,
  Eye,
  FileText,
  MessageCircle,
  Moon,
  Shield,
  Trash2,
  User,
  X,
} from 'lucide-react-native';
import FastImage from '@d11/react-native-fast-image';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colorss } from '../theme';
import { IC_PROFILE } from '../assets';
import { RootStackNavigatorParamList } from '../types/navigators';
import { useAppSelector } from '../hooks/redux';
import { selectHopenityProfile } from '../redux/features/auth/authSlice';
import { useT } from '../hooks/useT';

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'Settings'>;

type SettingRow = {
  id: string;
  icon: React.ReactNode;
  label: string;
  sub?: string;
  onPress?: () => void;
};

// ─── Coming Soon Modal ────────────────────────────────────────────────────────

function ComingSoonModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const scaleAnim = useRef(new Animated.Value(0.82)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 90,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.82);
      opacityAnim.setValue(0);
    }
  }, [visible, scaleAnim, opacityAnim]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={modal.backdrop}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                modal.card,
                { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
              ]}
            >
              {/* Close button */}
              <TouchableOpacity style={modal.closeBtn} onPress={onClose}>
                <X size={18} color={colorss.textSecondary} />
              </TouchableOpacity>

              {/* Emoji */}
              <View style={modal.emojiWrap}>
                <Text style={modal.emoji}>🍳</Text>
              </View>

              <Text style={modal.title}>{t.coming_soon_title}</Text>
              <Text style={modal.body}>{t.coming_soon_body}</Text>
              <View style={modal.divider} />
              <View style={modal.chipRow}>
                {([t.coming_soon_design, t.coming_soon_build, t.coming_soon_polish] as const).map((step, i) => (
                  <View key={step} style={[modal.chip, i === 0 && modal.chipDone, i === 1 && modal.chipActive]}>
                    <Text style={[modal.chipText, i === 0 && modal.chipTextDone, i === 1 && modal.chipTextActive]}>
                      {i === 0 ? '✓ ' : i === 1 ? '⚡ ' : '⏳ '}{step}
                    </Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity style={modal.okBtn} onPress={onClose} activeOpacity={0.85}>
                <Text style={modal.okText}>{t.got_it}</Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

const SettingsScreen: React.FC<Props> = ({ navigation }) => {
  const t = useT();
  const profile = useAppSelector(selectHopenityProfile);
  const [comingSoonVisible, setComingSoonVisible] = useState(false);

  const comingSoon = () => setComingSoonVisible(true);

  const sections: { title: string; rows: SettingRow[] }[] = [
    {
      title: t.section_privacy,
      rows: [
        { id: 'read-receipts',  icon: <Eye size={20} color={colorss.textPrimary} />,           label: t.read_receipts,         sub: t.read_receipts_sub,         onPress: comingSoon },
        { id: 'message-perms',  icon: <MessageCircle size={20} color={colorss.textPrimary} />, label: t.message_permissions,   sub: t.message_permissions_sub,   onPress: comingSoon },
        { id: 'typing',         icon: <User size={20} color={colorss.textPrimary} />,           label: t.typing_indicator,      sub: t.typing_indicator_sub,      onPress: comingSoon },
        { id: 'disappearing',   icon: <Moon size={20} color={colorss.textPrimary} />,           label: t.disappearing_messages, sub: t.disappearing_messages_sub, onPress: comingSoon },
      ],
    },
    {
      title: t.section_notifications,
      rows: [
        { id: 'notif-sounds', icon: <Bell size={20} color={colorss.textPrimary} />, label: t.notification_sounds, sub: t.notification_sounds_sub, onPress: comingSoon },
      ],
    },
    {
      title: t.section_appearance,
      rows: [
        { id: 'theme', icon: <Moon size={20} color={colorss.textPrimary} />, label: t.theme, sub: t.theme_sub, onPress: comingSoon },
      ],
    },
    {
      title: t.section_security,
      rows: [
        { id: 'blocked',         icon: <Ban size={20} color={colorss.textPrimary} />,      label: t.blocked_people,  sub: t.blocked_people_sub, onPress: () => navigation.navigate('BlockedPeople') },
        { id: 'report',          icon: <Shield size={20} color={colorss.textPrimary} />,   label: t.report_problem,                             onPress: comingSoon },
        { id: 'auto-save',       icon: <Trash2 size={20} color={colorss.textPrimary} />,   label: t.auto_save,                                  onPress: comingSoon },
        { id: 'privacy-policy',  icon: <FileText size={20} color={colorss.textPrimary} />, label: t.privacy_policy,  sub: 'hopechat.chat/privacy-policy', onPress: () => Linking.openURL('https://hopechat.chat/privacy-policy/') },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color={colorss.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.settings}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <FastImage
            source={profile?.avatarUrl ? { uri: profile.avatarUrl } : IC_PROFILE}
            style={styles.avatar}
          />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName} numberOfLines={1}>
              {profile?.displayName ?? 'HopeChat User'}
            </Text>
            <Text style={styles.profileSub} numberOfLines={1}>{t.hopenity_account}</Text>
          </View>
        </View>

        {/* Settings sections */}
        {sections.map(section => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.rows.map((row, idx) => (
                <React.Fragment key={row.id}>
                  <TouchableOpacity
                    style={styles.row}
                    onPress={row.onPress}
                    activeOpacity={0.7}
                  >
                    <View style={styles.rowIcon}>{row.icon}</View>
                    <View style={styles.rowContent}>
                      <Text style={styles.rowLabel}>{row.label}</Text>
                      {row.sub ? (
                        <Text style={styles.rowSub}>{row.sub}</Text>
                      ) : null}
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </TouchableOpacity>
                  {idx < section.rows.length - 1 && <View style={styles.divider} />}
                </React.Fragment>
              ))}
            </View>
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>

      <ComingSoonModal
        visible={comingSoonVisible}
        onClose={() => setComingSoonVisible(false)}
      />
    </SafeAreaView>
  );
};

export default SettingsScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colorss.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colorss.white,
    borderBottomWidth: 1,
    borderBottomColor: colorss.border,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colorss.textPrimary },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colorss.white,
    padding: 16,
    marginBottom: 8,
  },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '700', color: colorss.textPrimary },
  profileSub: { fontSize: 13, color: colorss.textSecondary, marginTop: 2 },
  section: { marginBottom: 8 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colorss.textSecondary,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCard: {
    backgroundColor: colorss.white,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 14,
  },
  rowIcon: { width: 28, alignItems: 'center' },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 15, color: colorss.textPrimary, fontWeight: '500' },
  rowSub: { fontSize: 12, color: colorss.textSecondary, marginTop: 2 },
  chevron: { fontSize: 20, color: colorss.placeholder },
  divider: {
    height: 1,
    backgroundColor: colorss.border,
    marginLeft: 58,
  },
});

const modal = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    backgroundColor: colorss.white,
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 20,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    padding: 6,
    borderRadius: 20,
    backgroundColor: colorss.background,
  },
  emojiWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${colorss.primary}12`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  emoji: { fontSize: 40 },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colorss.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    color: colorss.textSecondary,
    textAlign: 'center',
    lineHeight: 23,
    marginBottom: 20,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: colorss.border,
    marginBottom: 18,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colorss.background,
    borderWidth: 1,
    borderColor: colorss.border,
  },
  chipDone: {
    backgroundColor: '#dcfce7',
    borderColor: '#22c55e',
  },
  chipActive: {
    backgroundColor: `${colorss.primary}15`,
    borderColor: colorss.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colorss.textSecondary,
  },
  chipTextDone: { color: '#15803d' },
  chipTextActive: { color: colorss.primary },
  okBtn: {
    width: '100%',
    backgroundColor: colorss.primary,
    borderRadius: 50,
    paddingVertical: 14,
    alignItems: 'center',
  },
  okText: {
    color: colorss.white,
    fontWeight: '700',
    fontSize: 16,
  },
});
