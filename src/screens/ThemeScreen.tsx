import React, { useMemo, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LucideArrowLeft, Moon, Sun } from 'lucide-react-native';
import { colorss } from '../theme';
import { THEME_1, THEME_2, THEME_3, THEME_4, THEME_5 } from '../assets';
import {
  getChatAppearance,
  setChatAppearance,
  getConvAppearance,
  setConvAppearance,
  getEffectiveAppearance,
} from '../services/chatPrefs';
import { useAppTheme } from '../context/ThemeContext';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GAP = 6;
const ITEM_SIZE = (SCREEN_WIDTH - GAP * 4) / 3;

const THEME_DATA = [
  { id: 1, name: 'Light', img: THEME_1 },
  { id: 2, name: 'Dark', img: THEME_2 },
  { id: 3, name: 'Blue', img: THEME_3 },
  { id: 4, name: 'Green', img: THEME_4 },
  { id: 5, name: 'Pink', img: THEME_5 },
];

const ThemeScreen = ({ navigation, route }: { navigation: any; route?: any }) => {
  const { isDark, toggleDarkMode, colors } = useAppTheme();
  const conversationId: string | undefined = route?.params?.conversationId;

  const appearance = useMemo(
    () => (conversationId ? getEffectiveAppearance(conversationId) : getChatAppearance()),
    [conversationId],
  );
  const [selectedTheme, setSelectedTheme] = useState(appearance.themePresetId);
  const [wallpaperUri, setWallpaperUri] = useState(appearance.wallpaperUri ?? '');
  const [reactionPack, setReactionPack] = useState(
    appearance.reactionEmojiPalette.join(' '),
  );

  const saveAppearance = (patch: { themePresetId?: number; wallpaperUri?: string | null; reactionEmojiPalette?: string[] }) => {
    if (conversationId) {
      setConvAppearance(conversationId, patch);
    } else {
      setChatAppearance(patch);
    }
  };

  const handleSelectTheme = (id: number) => {
    setSelectedTheme(id);
    saveAppearance({ themePresetId: id });
    // Dark mode toggle only applies to global setting (affects UI chrome, not per-chat)
    if (!conversationId) {
      if (id === 2 && !isDark) toggleDarkMode();
      else if (id !== 2 && isDark) toggleDarkMode();
    }
  };

  return (
    <View style={[styles.sheet, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation?.goBack?.()}>
          <LucideArrowLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Theme</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Dark mode quick toggle */}
      <View style={[styles.darkRow, { borderBottomColor: colors.border }]}>
        {isDark ? (
          <Moon size={20} color={colors.accent} />
        ) : (
          <Sun size={20} color={colors.textPrimary} />
        )}
        <Text style={[styles.darkLabel, { color: colors.textPrimary }]}>
          {isDark ? 'Dark mode' : 'Light mode'}
        </Text>
        <Switch
          value={isDark}
          onValueChange={() => {
            toggleDarkMode();
            saveAppearance({ themePresetId: isDark ? 1 : 2 });
            setSelectedTheme(isDark ? 1 : 2);
          }}
          trackColor={{ false: colorss.border, true: colors.accent }}
          thumbColor={colorss.white}
          ios_backgroundColor={colorss.border}
        />
      </View>

      <FlatList
        data={THEME_DATA}
        numColumns={3}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.list}
        columnWrapperStyle={styles.column}
        renderItem={({ item }) => {
          const active = selectedTheme === item.id;
          return (
            <TouchableOpacity
              style={styles.gridItem}
              onPress={() => handleSelectTheme(item.id)}
            >
              <View
                style={[
                  styles.imageWrapper,
                  active && { borderColor: colorss.primary, borderWidth: 2 },
                ]}
              >
                <Image
                  source={item.img}
                  style={styles.image}
                  resizeMode="cover"
                />
              </View>
              <Text style={[styles.themeText, { color: colors.textPrimary }]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          );
        }}
        ListFooterComponent={
          <View style={styles.footer}>
            <Text style={[styles.footerTitle, { color: colors.textPrimary }]}>
              Chat wallpaper URL
            </Text>
            <TextInput
              value={wallpaperUri}
              onChangeText={setWallpaperUri}
              onBlur={() => saveAppearance({ wallpaperUri: wallpaperUri.trim() || null })}
              placeholder="https://…"
              placeholderTextColor={colorss.placeholder}
              style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.inputBg }]}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={[styles.footerTitle, { color: colors.textPrimary }]}>
              Quick reactions (space-separated)
            </Text>
            <TextInput
              value={reactionPack}
              onChangeText={setReactionPack}
              onBlur={() =>
                saveAppearance({
                  reactionEmojiPalette: reactionPack
                    .trim()
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 12),
                })
              }
              placeholder="❤️ 👍 😂 …"
              placeholderTextColor={colorss.placeholder}
              style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.inputBg }]}
            />
          </View>
        }
      />
    </View>
  );
};

export default ThemeScreen;

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 20,
    paddingTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 18, fontWeight: '700' },
  darkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  darkLabel: { flex: 1, fontSize: 16, fontWeight: '500' },
  list: { paddingHorizontal: GAP, paddingTop: 16, gap: GAP },
  column: { gap: GAP },
  gridItem: { width: ITEM_SIZE, marginBottom: 4 },
  imageWrapper: {
    width: '100%',
    height: 140,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  image: { width: '100%', height: '100%' },
  themeText: { textAlign: 'center', marginTop: 6, fontSize: 12 },
  footer: { paddingHorizontal: GAP, gap: 10, marginTop: 20, paddingBottom: 24 },
  footerTitle: { fontSize: 13, fontWeight: '600' },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 8,
  },
});
