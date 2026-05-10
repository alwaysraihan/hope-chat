import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colorss } from '../theme';
import Radio from '../components/Radio';
import type { RootStackNavigatorParamList } from '../types/navigators';
import {
  initialDisappearingTtlSec,
  setDisappearingForConversation,
  setDisappearingGlobal,
} from '../services/chatPrefs';

type Props = NativeStackScreenProps<
  RootStackNavigatorParamList,
  'DisappearingMessages'
>;

const OPTIONS: { id: string; label: string; seconds: number }[] = [
  { id: 'off', label: 'Off', seconds: 0 },
  { id: '5m', label: '5 minutes', seconds: 300 },
  { id: '1h', label: '1 hour', seconds: 3600 },
  { id: '24h', label: '24 hours', seconds: 86400 },
  { id: '7d', label: '7 days', seconds: 604800 },
];

const DisappearingMessagesScreen: React.FC<Props> = ({ navigation, route }) => {
  const conversationId = route.params?.conversationId;
  const [selected, setSelected] = useState(() => {
    const ttl = initialDisappearingTtlSec(conversationId);
    return OPTIONS.find(o => o.seconds === ttl)?.id ?? 'off';
  });
  const [convIdInput, setConvIdInput] = useState(conversationId ?? '');

  const applySelection = useCallback(
    (id: string) => {
      setSelected(id);
      const sec = OPTIONS.find(o => o.id === id)?.seconds ?? 0;
      const targetConv = route.params?.conversationId ?? convIdInput.trim();
      if (targetConv.length > 0) {
        setDisappearingForConversation(targetConv, sec);
      } else {
        setDisappearingGlobal(sec);
      }
    },
    [route.params?.conversationId, convIdInput],
  );

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
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.content}>
        {!route.params?.conversationId ? (
          <View style={styles.hintBox}>
            <Text style={styles.hintLabel}>
              Optional: target a single chat by id (defaults to global setting).
            </Text>
            <TextInput
              value={convIdInput}
              onChangeText={setConvIdInput}
              placeholder="Conversation id (optional)"
              placeholderTextColor={colorss.placeholder}
              style={styles.textIn}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        ) : null}

        {OPTIONS.map(opt => {
          const active = selected === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              style={styles.optionRow}
              onPress={() => applySelection(opt.id)}
              activeOpacity={0.7}
            >
              <Radio
                selected={active}
                onPress={() => applySelection(opt.id)}
              />
              <Text style={styles.optionLabel}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}

        <View style={styles.hintBox}>
          <Text style={styles.hintText}>
            New messages disappear from this device after the timer. Clearing the
            per-chat field uses the global timer for new threads.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default DisappearingMessagesScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colorss.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colorss.border,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colorss.textPrimary,
  },
  content: {
    paddingTop: 10,
    paddingHorizontal: 20,
    backgroundColor: colorss.white,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  optionLabel: { color: colorss.textPrimary, fontSize: 16 },
  hintBox: {
    marginTop: 10,
    marginBottom: 8,
  },
  hintText: {
    color: colorss.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  hintLabel: {
    fontSize: 12,
    color: colorss.textSecondary,
    marginBottom: 8,
  },
  textIn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colorss.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colorss.textPrimary,
  },
});
