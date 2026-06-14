import { Appearance } from 'react-native';

// ─── Base palettes ────────────────────────────────────────────────────────────
// Kept in sync with ThemeContext.ts lightColors / darkColors.

export const lightPalette = {
  primary: '#FF4E8C',
  primaryLight: '#FF7FA8',
  primaryDark: '#CC3E70',
  background: '#F8F8F8',
  surface: '#F8FAFC',
  backgroundDeep: '#e2e5ea',
  darkBg: '#1a1a2e',
  white: '#FFFFFF',
  border: '#E5E5EA',
  textPrimary: '#10182B',
  textSecondary: '#4A5568',
  placeholder: '#A0AEC0',
  accent: '#FF4E8C',
  success: '#22C55E',
  error: '#EF4444',
  cardBg: '#FFFFFF',
  inputBg: '#F8F8F8',
  bubbleOut: '#FF4E8C',
  bubbleIn: '#eaeef3',
  bubbleTextOut: '#FFFFFF',
  bubbleTextIn: '#10182B',
};

export const darkPalette = {
  primary: '#FF4E8C',
  primaryLight: '#FF7FA8',
  primaryDark: '#CC3E70',
  background: '#000000',
  surface: '#111111',
  backgroundDeep: '#000000',
  darkBg: '#000000',
  white: '#0A0A0A',
  border: '#1E1E1E',
  textPrimary: '#FFFFFF',
  textSecondary: '#8E8E93',
  placeholder: '#48484A',
  accent: '#FF4E8C',
  success: '#22C55E',
  error: '#EF4444',
  cardBg: '#111111',
  inputBg: '#1A1A1A',
  bubbleOut: '#CC3E70',
  bubbleIn: '#1E1E1E',
  bubbleTextOut: '#FFFFFF',
  bubbleTextIn: '#FFFFFF',
};

/**
 * `colorss` is a mutable object. ThemeContext mutates it via `applyThemePalette`
 * whenever the user toggles dark / light mode, so components that read it at
 * render time (inline styles, useMemo) always get the current palette.
 *
 * ⚠️  Module-level StyleSheet.create bakes values in at module-init time and
 * will NOT react to palette changes.  Move those StyleSheets inside the
 * component with useMemo(() => StyleSheet.create({…}), [colorss]).
 */
function resolveInitialPalette() {
  // Lazily read MMKV only when the module is first imported (avoids import-time
  // crashes on Android where MMKV may not be ready at cold-start).
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createMMKV } = require('react-native-mmkv') as typeof import('react-native-mmkv');
    const store = createMMKV({ id: 'hopechat-chat-prefs-v1' });
    if (store.contains('dark_mode_v1')) {
      return store.getBoolean('dark_mode_v1') ? darkPalette : lightPalette;
    }
  } catch { /* MMKV not ready — fall through */ }
  return Appearance.getColorScheme() === 'dark' ? darkPalette : lightPalette;
}

export const colorss = { ...resolveInitialPalette() };

/** Called by ThemeContext when the user switches themes at runtime. */
export function applyThemePalette(dark: boolean): void {
  Object.assign(colorss, dark ? darkPalette : lightPalette);
}

// ─── Misc exports (unchanged) ─────────────────────────────────────────────────

export const colors = {
  background: '#0F0F1A',
  backgroundCard: '#1e1e30',
  backgroundDeep: '#0d0d1a',
  surface: '#1a1a2c',
  border: '#1e1e30',
  purple: '#7C3AED',
  purpleLight: '#9B5CF6',
  purpleMuted: 'rgba(124,58,237,0.15)',
  purpleBorder: 'rgba(124,58,237,0.3)',
  white: '#FFFFFF',
  textPrimary: '#F0F0FF',
  textSecondary: '#8888aa',
  textMuted: '#5a5a7a',
  textUnread: '#c0c0d8',
  online: '#22c55e',
  pink: '#EC4899',
  amber: '#F59E0B',
};

export const fonts = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};
