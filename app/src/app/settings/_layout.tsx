import { Stack } from 'expo-router';
import { t } from '@/i18n';

/**
 * UX-1, UX-6: Settings is a stack above the tabs, so the tab bar is hidden inside it and Back returns to the tab it was
 * opened from. It is a pushed screen, not a modal sheet: no Done button.
 */
export default function SettingsStack() {
  return (
    <Stack screenOptions={{ headerBackTitle: t('common.back') }}>
      <Stack.Screen name="index" options={{ title: t('nav.settings') }} />
      <Stack.Screen name="logging" options={{ title: t('nav.logging') }} />
      <Stack.Screen name="areas" options={{ title: t('nav.areas') }} />
      <Stack.Screen name="favorites" options={{ title: t('nav.favorites') }} />
      <Stack.Screen name="suggestions" options={{ title: t('nav.suggestions') }} />
      <Stack.Screen name="privacy" options={{ title: t('nav.privacy') }} />
      <Stack.Screen name="reminders" options={{ title: t('nav.reminders') }} />
      <Stack.Screen name="ai" options={{ title: t('nav.ai') }} />
      <Stack.Screen name="about" options={{ title: t('nav.about') }} />
      <Stack.Screen name="data" options={{ title: t('nav.data') }} />
    </Stack>
  );
}
