import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '@/constants/theme';
import { initLocale } from '@/services/i18n';

export default function RootLayout() {
  useEffect(() => {
    initLocale();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="profile" options={{ headerShown: false, presentation: 'modal' }} />
      </Stack>
    </>
  );
}
