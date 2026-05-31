import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Timer } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colorss } from '../theme';
import Radio from '../components/Radio';
import type { RootStackNavigatorParamList } from '../types/navigators';
import {
  initialDisappearingTtlSec,
  setDisappearingForConversation,
  setDisappearingGlobal,
} from '../services/chatPrefs';
import { patchConversationDisappearing } from '../services/userSettingsService';
import { useAppSelector } from '../hooks/redux';
import { selectAuthToken } from '../redux/features/auth/authSlice';

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'DisappearingMessages'>;

const OPTIONS: { id: string; label: string; sublabel: string; seconds: number }[] = [
  { id: 'off',  label: 'Off',      sublabel: 'Messages will not disappear',   seconds: 0 },
  { id: '24h',  label: '24 hours', sublabel: 'Messages disappear after 1 day', seconds: 86400 },
  { id: '7d',   label: '7 days',   sublabel: 'Messages disappear after 1 week', seconds: 604800 },
  { id: '90d',  label: '90 days',  sublabel: 'Messages disappear after 3 months', seconds: 7776000 },
];

const DisappearingMessagesScreen: React.FC<Props> = ({ navigation, route }) => {
  const conversationId = route.params?.conversationId;
  const token = useAppSelector(selectAuthToken);
  const [saving, setSaving] = useState(false);

  const [selected, setSelected] = useState(() => {
    const ttl = initialDisappearingTtlSec(conversationId);
    return OPTIONS.find(o => o.seconds === ttl)?.id ?? 'off';
  });

  const applySelection = useCallback(
    async (id: string) => {
      setSelected(id);
      const sec = OPTIONS.find(o => o.id === id)?.seconds ?? 0;
      if (conversationId) {
        setDisappearingForConversation(conversationId, sec);
        if (token) {
          setSaving(true);
          await patchConversationDisappearing(conversationId, sec, token);
          setSaving(false);
        }
      } else {
        setDisappearingGlobal(sec);
      }
    },
    [conversationId, token],
  );

  const selectedOption = OPTIONS.find(o => o.id === selected);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={12}
          accessibilityRole="button"
        >
          <ChevronLeft size={26} color={colorss.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Disappearing messages</Text>
        {saving ? (
          <ActivityIndicator size="small" color={colorss.accent} />
        ) : (
          <View style={{ width: 26 }} />
        )}
      </View>

      {/* Info banner */}
      <View style={styles.banner}>
        <Timer size={20} color={colorss.accent} />
        <Text style={styles.bannerText}>
          {conversationId
            ? 'Set a timer for messages in this chat.'
            : 'Set a default timer for all new chats.'}
        </Text>
      </View>

      <View style={styles.content}>
        {OPTIONS.map(opt => {
          const active = selected === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              style={[styles.optionRow, active && styles.optionRowActive]}
              onPress={() => applySelection(opt.id)}
              activeOpacity={0.7}
            >
              <Radio selected={active} onPress={() => applySelection(opt.id)} />
              <View style={styles.optionTextCol}>
                <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
                  {opt.label}
                </Text>
                <Text style={styles.optionSub}>{opt.sublabel}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {selectedOption && selectedOption.id !== 'off' && (
        <View style={styles.hintBox}>
          <Text style={styles.hintText}>
            New messages in {conversationId ? 'this chat' : 'new chats'} will disappear after{' '}
            <Text style={styles.hintBold}>{selectedOption.label}</Text>. Messages sent before
            this change are not affected.
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
};

export default DisappearingMessagesScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colorss.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colorss.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colorss.textPrimary },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#EBF5FF',
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
  },
  bannerText: { flex: 1, color: colorss.accent, fontSize: 13, lineHeight: 18 },
  content: { paddingHorizontal: 20, paddingTop: 8 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colorss.border,
  },
  optionRowActive: { backgroundColor: '#FAFEFF' },
  optionTextCol: { flex: 1 },
  optionLabel: { color: colorss.textPrimary, fontSize: 16, fontWeight: '500' },
  optionLabelActive: { color: colorss.accent },
  optionSub: { color: colorss.textSecondary, fontSize: 13, marginTop: 2 },
  hintBox: {
    marginHorizontal: 20,
    marginTop: 20,
    padding: 14,
    backgroundColor: colorss.backgroundDeep,
    borderRadius: 10,
  },
  hintText: { color: colorss.textSecondary, fontSize: 13, lineHeight: 20 },
  hintBold: { fontWeight: '700', color: colorss.textPrimary },
});
