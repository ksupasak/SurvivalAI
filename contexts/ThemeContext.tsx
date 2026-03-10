/**
 * ThemeContext
 *
 * Provides light / dark / system theme switching across the app.
 * Usage:
 *   const { colors, isDark, themeMode, setThemeMode } = useTheme();
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import { getSetting, setSetting } from '@/services/settings';
import { LightColors, DarkColors, type ColorScheme } from '@/constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  colors: ColorScheme;
  isDark: boolean;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ThemeContext = createContext<ThemeContextValue>({
  colors: LightColors,
  isDark: false,
  themeMode: 'system',
  setThemeMode: async () => {},
  toggleTheme: async () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');

  // Load persisted preference on mount
  useEffect(() => {
    getSetting('themeMode').then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setThemeModeState(saved as ThemeMode);
      }
    });
  }, []);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    await setSetting('themeMode', mode);
  }, []);

  const toggleTheme = useCallback(async () => {
    const next = themeMode === 'dark' ? 'light' : 'dark';
    await setThemeMode(next);
  }, [themeMode, setThemeMode]);

  const isDark =
    themeMode === 'system' ? systemScheme === 'dark' : themeMode === 'dark';

  const colors = isDark ? DarkColors : LightColors;

  return (
    <ThemeContext.Provider
      value={{ colors, isDark, themeMode, setThemeMode, toggleTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
