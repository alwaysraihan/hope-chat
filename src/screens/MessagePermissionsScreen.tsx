import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colorss } from '../theme';
import BackHeader from '../components/BackHeader';
import { getMessageOpenTo, setMessageOpenTo, MessageOpenTo } from '../services/chatPrefs';
import { patchUserSettings } from '../services/userSettingsService';
import { useAppSelector } from '../hooks/redux';
import { selectAuthToken } from '../redux/features/auth/authSlice';

const OPTIONS: { value: MessageOpenTo; label: string; sub: string }[] = [
  {
    value: 'everyone',
    label: 'Everyone',
    sub: 'Anyone on HopeChat can send you messages.',
  },
  {
    value: 'contacts',
    label: 'My contacts only',
    sub: 'Only people whose chats you have accepted can message you.',
  },
];

const MessagePermissionsScreen = ({ navigation }: { navigation: any }) => {
  const token = useAppSelector(selectAuthToken);
  const [selected, setSelected] = useState<MessageOpenTo>(() => getMessageOpenTo());

  const handleSelect = (value: MessageOpenTo) => {
    setSelected(value);
    setMessageOpenTo(value);
    if (token) {
      patchUserSettings({ messageOpenTo: value }, token);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <BackHeader title="Message Permissions" navigation={navigation} />

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Who can send you messages?</Text>

        {OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.value}
            style={styles.option}
            onPress={() => handleSelect(opt.value)}
            activeOpacity={0.7}
          >
            <View style={[styles.radio, selected === opt.value && styles.radioSelected]}>
              {selected === opt.value && <View style={styles.radioDot} />}
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionLabel}>{opt.label}</Text>
              <Text style={styles.optionSub}>{opt.sub}</Text>
            </View>
          </TouchableOpacity>
        ))}

        <Text style={styles.hint}>
          Changing this setting affects who can start a new conversation with you.
          Existing accepted chats are not affected.
        </Text>
      </View>
    </SafeAreaView>
  );
};

export default MessagePermissionsScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colorss.white },
  content: { padding: 20 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colorss.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 16,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colorss.border,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colorss.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  radioSelected: { borderColor: colorss.accent },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colorss.accent,
  },
  optionText: { flex: 1 },
  optionLabel: {
    color: colorss.textPrimary,
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 3,
  },
  optionSub: { color: colorss.textSecondary, fontSize: 13, lineHeight: 18 },
  hint: {
    color: colorss.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 20,
  },
});
