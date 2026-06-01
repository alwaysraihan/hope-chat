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

// ─── Color palettes ────────────────────────────────────────────────────────────
// Both palettes mirror the full shape of the static `colorss` export in
// src/theme/index.tsx so that components can shadow `colorss` with useColors()
// without any TypeScript errors.

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
  accent: '#1877f2',
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
  background: '#0F0F0F',
  surface: '#1A1A1A',
  backgroundDeep: '#080808',
  darkBg: '#000000',
  white: '#1A1A1A',
  border: '#2C2C2C',
  textPrimary: '#F2F2F2',
  textSecondary: '#9A9A9A',
  placeholder: '#555555',
  accent: '#4A9EF1',
  success: '#22C55E',
  error: '#EF4444',
  cardBg: '#1E1E1E',
  inputBg: '#242424',
  bubbleOut: '#CC3E70',
  bubbleIn: '#2A2A2A',
  bubbleTextOut: '#FFFFFF',
  bubbleTextIn: '#F2F2F2',
};

// ─── Context ───────────────────────────────────────────────────────────────────

type ThemeContextValue = {
  isDark: boolean;
  colors: AppColors;
  toggleDarkMode: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  isDark: false,
  colors: lightColors,
  toggleDarkMode: () => {},
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

  // Follow OS colour scheme changes when the user has NOT set an explicit pref.
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      if (isDarkModeExplicitlySet()) return; // user has a saved preference — don't override
      setIsDark(colorScheme === 'dark');
    });
    return () => sub.remove();
  }, []);

  const toggleDarkMode = useCallback(() => {
    setIsDark(prev => {
      const next = !prev;
      setDarkMode(next);
      return next;
    });
  }, []);

  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ isDark, colors, toggleDarkMode }}>
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
