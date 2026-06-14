import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Appearance } from 'react-native';
import {
  getDarkMode,
  isDarkModeExplicitlySet,
  setDarkMode,
} from '../services/chatPrefs';
import { applyThemePalette } from '../theme';

// ─── Color palettes ────────────────────────────────────────────────────────────
// Both palettes mirror the full shape of the static `colorss` export in
// src/theme/index.tsx so that components can shadow `colorss` with useColors()
// without any TypeScript errors.
// These are re-exported as the source-of-truth; `theme/index.tsx` derives from them.

export type AppColors = {
  // Primary brand
  primary: string;
  primaryLight: string;
  primaryDark: string;
  // Backgrounds
  background: string;
  surface: string;
  backgroundDeep: string;
  darkBg: string;
  // Neutral
  white: string;
  border: string;
  // Text
  textPrimary: string;
  textSecondary: string;
  placeholder: string;
  // Semantic
  accent: string;
  success: string;
  error: string;
  // Cards / inputs (used by settings/profile screens)
  cardBg: string;
  inputBg: string;
  // Chat bubbles
  bubbleOut: string;
  bubbleIn: string;
  bubbleTextOut: string;
  bubbleTextIn: string;
};

export const lightColors: AppColors = {
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

export const darkColors: AppColors = {
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

// ─── Context ───────────────────────────────────────────────────────────────────

type ThemeContextValue = {
  isDark: boolean;
  colors: AppColors;
  toggleDarkMode: () => void;
  /** Increments on every theme switch — use as key/dep to force re-computation of module-level StyleSheets. */
  themeVersion: number;
};

const ThemeContext = createContext<ThemeContextValue>({
  isDark: false,
  colors: lightColors,
  toggleDarkMode: () => {},
  themeVersion: 0,
});

/**
 * Determine the initial dark-mode state:
 * 1. If the user has explicitly toggled it before → respect their choice.
 * 2. Otherwise → follow the OS colour scheme (dark / light / null=light).
 */
function resolveInitialDark(): boolean {
  if (isDarkModeExplicitlySet()) {
    return getDarkMode();
  }
  return Appearance.getColorScheme() === 'dark';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState<boolean>(resolveInitialDark);
  const [themeVersion, setThemeVersion] = useState(0);

  // Keep the mutable colorss export in sync with current theme so that
  // components reading it at render time (inline styles, useMemo) stay correct.
  useEffect(() => {
    applyThemePalette(isDark);
  }, [isDark]);

  // Follow OS colour scheme changes when the user has NOT set an explicit pref.
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      if (isDarkModeExplicitlySet()) return; // user has a saved preference — don't override
      setIsDark(colorScheme === 'dark');
      setThemeVersion(v => v + 1);
    });
    return () => sub.remove();
  }, []);

  const toggleDarkMode = useCallback(() => {
    setIsDark(prev => {
      const next = !prev;
      setDarkMode(next);
      applyThemePalette(next);
      setThemeVersion(v => v + 1);
      return next;
    });
  }, []);

  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ isDark, colors, toggleDarkMode, themeVersion }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/**
 * Returns the current theme's full color palette in the same shape as the
 * static `colorss` from src/theme/index.tsx. Use inside components to shadow
 * the static import and get reactive dark-mode colors:
 *
 *   const colorss = useColors();
 */
export function useColors(): AppColors {
  return useContext(ThemeContext).colors;
}
