import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { getDarkMode, setDarkMode } from '../services/chatPrefs';

// ─── Color palettes ────────────────────────────────────────────────────────────

export type AppColors = {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  background: string;
  surface: string;
  backgroundDeep: string;
  white: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  placeholder: string;
  accent: string;
  success: string;
  error: string;
  cardBg: string;
  inputBg: string;
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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(() => getDarkMode());

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
