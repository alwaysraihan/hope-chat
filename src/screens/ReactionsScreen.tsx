import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import BackHeader from '../components/BackHeader';
import { useColors } from '../hooks/useColors';
import { RootStackNavigatorParamList } from '../types/navigators';
import {
  getEffectiveAppearance,
  setChatAppearance,
  setConvAppearance,
  DEFAULT_REACTION_PALETTE,
} from '../services/chatPrefs';

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'Reactions'>;

const EMOJI_GRID = [
  '❤️','😂','😮','😢','😡','👍','👎','🔥','🎉','💯',
  '😍','🥰','😘','😊','😁','😆','🤣','😅','🤩','🥳',
  '😎','🤔','🤯','😳','🤭','🫡','🫠','😴','🤗','🫶',
  '👏','🙏','✌️','🤞','👌','🤌','💪','🫂','💋','❤️‍🔥',
  '💔','💘','💝','💖','💗','💓','✨','⭐','🌟','💫',
  '🎊','🎈','🎁','🏆','👑','💎','🦋','🌈','🌸','🌺',
  '🍕','🍔','🎂','🍰','🧁','🍭','☕','🍻','🥂','🎶',
  '😈','👻','💀','🤡','👾','🤖','🐶','🐱','🐻','🐼',
];

const SLOT_COUNT = 6;

export default function ReactionsScreen({ navigation, route }: Props) {
  const colorss = useColors();
  const conversationId: string | undefined = (route?.params as { conversationId?: string } | undefined)?.conversationId;

  const [palette, setPalette] = useState<string[]>(() => {
    const p = getEffectiveAppearance(conversationId).reactionEmojiPalette;
    return p.length >= SLOT_COUNT
      ? p.slice(0, SLOT_COUNT)
      : [...p, ...DEFAULT_REACTION_PALETTE.slice(p.length, SLOT_COUNT)];
  });

  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const styles = useMemo(() => StyleSheet.create({
    screen: { flex: 1, backgroundColor: colorss.background },
    desc: { color: colorss.textSecondary, fontSize: 13, lineHeight: 19, margin: 16 },
    slotsRow: {
      flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
      backgroundColor: colorss.cardBg, marginHorizontal: 16, borderRadius: 16,
      paddingVertical: 20, paddingHorizontal: 12,
      borderWidth: 1, borderColor: colorss.border,
    },
    slot: {
      width: 52, height: 52, borderRadius: 26,
      backgroundColor: colorss.surface,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: 'transparent',
    },
    slotActive: { borderColor: colorss.accent, backgroundColor: colorss.backgroundDeep },
    slotEmoji: { fontSize: 26 },
    resetBtn: { marginHorizontal: 16, marginTop: 12, paddingVertical: 10, alignItems: 'center' },
    resetText: { color: colorss.accent, fontSize: 14, fontWeight: '600' },
    hintRow: { margin: 16 },
    hintSub: { fontSize: 13, color: colorss.textSecondary, lineHeight: 19 },
    pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    pickerSheet: {
      backgroundColor: colorss.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      paddingBottom: 32, maxHeight: '60%',
    },
    pickerHandle: {
      width: 40, height: 4, backgroundColor: colorss.border,
      borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 8,
    },
    pickerTitle: { fontSize: 15, fontWeight: '700', color: colorss.textPrimary, textAlign: 'center', marginBottom: 12 },
    emojiItem: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
    emojiText: { fontSize: 26 },
  }), [colorss]);

  const saveAndSync = (next: string[]) => {
    setPalette(next);
    if (conversationId) {
      setConvAppearance(conversationId, { reactionEmojiPalette: next });
    } else {
      setChatAppearance({ reactionEmojiPalette: next });
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <BackHeader title="Quick reactions" navigation={navigation} />

      <Text style={styles.desc}>
        Choose 6 emojis that appear when you long-press a message. Tap a slot to change it.
      </Text>

      <View style={styles.slotsRow}>
        {palette.map((emoji, i) => (
          <Pressable
            key={i}
            style={[styles.slot, editingIndex === i && styles.slotActive]}
            onPress={() => setEditingIndex(editingIndex === i ? null : i)}
          >
            <Text style={styles.slotEmoji}>{emoji}</Text>
          </Pressable>
        ))}
      </View>

      <TouchableOpacity style={styles.resetBtn} onPress={() => saveAndSync([...DEFAULT_REACTION_PALETTE.slice(0, SLOT_COUNT)])}>
        <Text style={styles.resetText}>Reset to defaults</Text>
      </TouchableOpacity>

      <View style={styles.hintRow}>
        <Text style={styles.hintSub}>{palette.join('  ')} — tap any slot above to change it.</Text>
      </View>

      <Modal visible={editingIndex !== null} transparent animationType="slide" onRequestClose={() => setEditingIndex(null)}>
        <Pressable style={styles.pickerOverlay} onPress={() => setEditingIndex(null)}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHandle} />
            <Text style={styles.pickerTitle}>Pick emoji for slot {editingIndex !== null ? editingIndex + 1 : ''}</Text>
            <FlatList
              data={EMOJI_GRID}
              numColumns={7}
              keyExtractor={(_, i) => String(i)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.emojiItem}
                  onPress={() => {
                    if (editingIndex === null) return;
                    const next = [...palette];
                    next[editingIndex] = item;
                    saveAndSync(next);
                    setEditingIndex(null);
                  }}
                >
                  <Text style={styles.emojiText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
