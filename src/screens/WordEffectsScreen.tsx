import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Trash2 } from 'lucide-react-native';
import BackHeader from '../components/BackHeader';
import { useColors } from '../hooks/useColors';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackNavigatorParamList } from '../types/navigators';
import {
  addWordEffect,
  getWordEffects,
  removeWordEffect,
  type WordEffect,
} from '../services/chatPrefs';

const EMOJI_GRID = [
  '❤️','😂','😮','😢','😡','👍','👎','🔥','🎉','💯',
  '😍','🥰','😘','😊','😁','😆','🤣','😅','🤩','🥳',
  '😎','🤔','🤯','😳','🤭','🫡','🫠','😴','🤗','🫶',
  '👏','🙏','✌️','🤞','👌','🤌','💪','🫂','💋','❤️‍🔥',
  '💔','💘','💝','💖','💗','💓','✨','⭐','🌟','💫',
  '🎊','🎈','🎁','🏆','👑','💎','🦋','🌈','🌸','🌺',
  '😈','👻','💀','🤡','👾','🤖','🐶','🐱','🐻','🐼',
  '🍕','🍔','🎂','🍰','🧁','🍭','☕','🍻','🥂','🎶',
];

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'WordEffects'>;

const WordEffectsScreen: React.FC<Props> = ({ navigation }) => {
  const colorss = useColors();
  const [effects, setEffects] = useState<WordEffect[]>(() => getWordEffects());
  const [wordInput, setWordInput] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('🎉');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const wordInputRef = useRef<TextInput>(null);

  const styles = useMemo(() => StyleSheet.create({
    screen: { flex: 1, backgroundColor: colorss.background },
    desc: { color: colorss.textSecondary, fontSize: 13, lineHeight: 19, marginHorizontal: 16, marginTop: 12, marginBottom: 4 },
    list: { flex: 1 },
    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, paddingTop: 80 },
    emptyText: { color: colorss.textSecondary, textAlign: 'center', lineHeight: 20 },
    effectRow: {
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colorss.border,
    },
    effectEmoji: { fontSize: 26, width: 36, textAlign: 'center' },
    effectWord: { flex: 1, fontSize: 15, color: colorss.textPrimary, fontWeight: '500' },
    deleteBtn: { padding: 6 },
    addRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      padding: 12, paddingBottom: Platform.OS === 'ios' ? 28 : 12,
      borderTopWidth: 1, borderTopColor: colorss.border,
      backgroundColor: colorss.cardBg,
    },
    emojiPickerBtn: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: colorss.surface, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1.5, borderColor: colorss.border,
    },
    selectedEmojiText: { fontSize: 24 },
    wordInput: {
      flex: 1, height: 42, backgroundColor: colorss.surface,
      borderRadius: 21, paddingHorizontal: 16, fontSize: 15, color: colorss.textPrimary,
    },
    addBtn: {
      backgroundColor: colorss.accent, borderRadius: 21,
      paddingHorizontal: 16, height: 42, justifyContent: 'center', alignItems: 'center',
    },
    addBtnText: { color: colorss.white, fontWeight: '700', fontSize: 14 },
    pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    pickerSheet: {
      backgroundColor: colorss.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      paddingBottom: 32, maxHeight: '60%',
    },
    pickerHandle: { width: 40, height: 4, backgroundColor: colorss.border, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 8 },
    pickerTitle: { fontSize: 15, fontWeight: '700', color: colorss.textPrimary, textAlign: 'center', marginBottom: 8 },
    emojiGridItem: { width: '12.5%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
    emojiGridText: { fontSize: 26 },
  }), [colorss]);

  const handleAdd = useCallback(() => {
    const word = wordInput.trim();
    if (!word) { Alert.alert('Enter a word', 'Type a word or phrase to pair with the emoji.'); return; }
    if (effects.some(e => e.word.toLowerCase() === word.toLowerCase())) {
      Alert.alert('Already exists', `"${word}" already has an effect. Delete it first to change the emoji.`);
      return;
    }
    addWordEffect({ word, emoji: selectedEmoji });
    setEffects(getWordEffects());
    setWordInput('');
    Keyboard.dismiss();
  }, [wordInput, selectedEmoji, effects]);

  const handleDelete = useCallback((word: string) => {
    removeWordEffect(word);
    setEffects(getWordEffects());
  }, []);

  return (
    <SafeAreaView style={styles.screen}>
      <BackHeader title="Word effects" navigation={navigation} />
      <Text style={styles.desc}>
        Pair words with emojis — an animation plays when those words appear in chat.
      </Text>

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <FlatList
          style={styles.list}
          data={effects}
          keyExtractor={item => item.word}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No word effects yet.{'\n'}Add a word and pick an emoji below.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.effectRow}>
              <Text style={styles.effectEmoji}>{item.emoji}</Text>
              <Text style={styles.effectWord}>{item.word}</Text>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.word)}>
                <Trash2 size={18} color={colorss.error} />
              </TouchableOpacity>
            </View>
          )}
        />

        <View style={styles.addRow}>
          <TouchableOpacity style={styles.emojiPickerBtn} onPress={() => { Keyboard.dismiss(); setShowEmojiPicker(true); }}>
            <Text style={styles.selectedEmojiText}>{selectedEmoji}</Text>
          </TouchableOpacity>
          <TextInput
            ref={wordInputRef}
            style={styles.wordInput}
            placeholder="Word or phrase…"
            placeholderTextColor={colorss.placeholder}
            value={wordInput}
            onChangeText={setWordInput}
            returnKeyType="done"
            onSubmitEditing={handleAdd}
            maxLength={40}
          />
          <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={showEmojiPicker} transparent animationType="slide" onRequestClose={() => setShowEmojiPicker(false)}>
        <Pressable style={styles.pickerOverlay} onPress={() => setShowEmojiPicker(false)}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHandle} />
            <Text style={styles.pickerTitle}>Pick an emoji</Text>
            <FlatList
              data={EMOJI_GRID}
              numColumns={8}
              keyExtractor={(_, i) => String(i)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.emojiGridItem}
                  onPress={() => {
                    setSelectedEmoji(item);
                    setShowEmojiPicker(false);
                    setTimeout(() => wordInputRef.current?.focus(), 150);
                  }}
                >
                  <Text style={styles.emojiGridText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

export default WordEffectsScreen;
