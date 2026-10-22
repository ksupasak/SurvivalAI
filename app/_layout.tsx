import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { initLocale } from '@/services/i18n';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';

// Nothing in the app hid the splash screen; iOS dismissed it on its own but
// Android sat on it forever. Hold it deliberately, then hide once the first
// screen is mounted.
SplashScreen.preventAutoHideAsync().catch(() => {
  /* already hidden, or unavailable on this platform */
});

function RootLayoutInner() {
  const { isDark } = useTheme();

  useEffect(() => {
    initLocale().finally(() => {
      SplashScreen.hideAsync().catch(() => {
        /* already hidden */
      });
    });
  }, []);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="profile" options={{ headerShown: false, presentation: 'modal' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutInner />
    </ThemeProvider>
  );
}
