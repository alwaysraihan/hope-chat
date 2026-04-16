import { useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BackHeader from '../components/BackHeader';
import { colorss } from '../theme';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackNavigatorParamList } from '../types/navigators';

const CHIPS = [
  { emoji: '🧋', label: 'spill the tea' },
  { emoji: '💯', label: 'facts' },
  { emoji: '🐐', label: 'goat' },
  { emoji: '👑', label: 'queen' },
  { emoji: '✨', label: 'fancy' },
];

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'WordEffects'>;

const WordEffectsScreen: React.FC<Props> = ({ navigation }) => {
  const [input, setInput] = useState('');

  return (
    <SafeAreaView style={styles.screen}>
      <BackHeader title="Word effects" navigation={navigation} />
      <KeyboardAvoidingView
        behavior={'padding'}
        style={{
          flex: 1,
        }}
      >
        <ScrollView
          contentContainerStyle={{
            paddingBottom: 90,
            justifyContent: 'center',
            alignItems: 'center',
            flex: 1,
          }}
        >
          <View style={styles.effectsDesc}>
            <Text style={styles.effectsTitle}>Add effects to your chat</Text>
            <Text style={styles.effectsSubtitle}>
              Pair words that have special meaning with fun effects. Everyone
              will see an animation whenever these words are used.{' '}
              <Text style={styles.link}>Learn more</Text>
            </Text>
          </View>
          <View style={styles.chipsWrap}>
            {CHIPS.map(c => (
              <TouchableOpacity
                key={c.label}
                style={styles.chip}
                activeOpacity={0.7}
              >
                <Text style={styles.chipEmoji}>{c.emoji}</Text>
                <Text style={styles.chipLabel}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <View style={styles.effectsInputRow}>
          <TouchableOpacity style={styles.emojiBtn}>
            <Text style={{ fontSize: 22 }}>🙂</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.effectsInput}
            placeholder="Add a word or phrase"
            placeholderTextColor={colorss.textSecondary}
            value={input}
            onChangeText={setInput}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default WordEffectsScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colorss.white,
  },
  effectsDesc: { padding: 32, paddingBottom: 16, alignItems: 'center' },
  effectsTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colorss.textPrimary,
    marginBottom: 10,
    textAlign: 'center',
  },
  effectsSubtitle: {
    fontSize: 15,
    color: colorss.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  link: { color: colorss.accent, fontWeight: '500' },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 10,
    rowGap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 18,
    backgroundColor: colorss.surface,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colorss.primary,
  },
  chipEmoji: { fontSize: 18 },
  chipLabel: { fontSize: 15, color: colorss.textPrimary, fontWeight: '500' },
  effectsInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    borderTopWidth: 1,
    borderTopColor: colorss.border,
    backgroundColor: colorss.white,
    gap: 10,
  },
  emojiBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colorss.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  effectsInput: {
    flex: 1,
    height: 40,
    backgroundColor: colorss.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    fontSize: 15,
    color: colorss.textPrimary,
  },
});
