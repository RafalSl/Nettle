import { Stack } from 'expo-router';
import { t } from '@/i18n';
import { SCREEN_OPTIONS } from '@/ui/navTheme';
import { BackButton } from '@/ui/BackButton';

/**
 * UX-1, UX-6: Settings is a stack above the tabs, so the tab bar is hidden inside it and Back returns to the tab it was
 * opened from. It is a pushed screen, not a modal sheet: no Done button.
 */
export default function SettingsStack() {
  return (
    <Stack screenOptions={{ ...SCREEN_OPTIONS, headerBackTitle: t('common.back') }}>
      <Stack.Screen
        name="index"
        options={{
          title: t('nav.settings'),
          unstable_headerLeftItems: () => [{ type: 'custom' as const, hidesSharedBackground: true, element: <BackButton /> }],
        }}
      />
      <Stack.Screen name="logging" options={{ title: t('nav.logging') }} />
      <Stack.Screen name="areas" options={{ title: t('nav.areas') }} />
      <Stack.Screen name="favorites" options={{ title: t('nav.favorites') }} />
      <Stack.Screen name="suggestions" options={{ title: t('nav.suggestions') }} />
      <Stack.Screen name="privacy" options={{ title: t('nav.privacy') }} />
      <Stack.Screen name="reminders" options={{ title: t('nav.reminders') }} />
      <Stack.Screen name="regular" options={{ title: t('nav.regular') }} />
      <Stack.Screen name="regular-item" options={{ title: t('nav.regularItem') }} />
      <Stack.Screen name="ai" options={{ title: t('nav.ai') }} />
      <Stack.Screen name="language" options={{ title: t('nav.language') }} />
      <Stack.Screen name="about" options={{ title: t('nav.about') }} />
      <Stack.Screen name="data" options={{ title: t('nav.data') }} />
    </Stack>
  );
}
