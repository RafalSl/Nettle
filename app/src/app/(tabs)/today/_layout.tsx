import { Stack } from 'expo-router';
import { t } from '@/i18n';
import { SCREEN_OPTIONS } from '@/ui/navTheme';

/** UX-1: More is pushed inside the Today stack; Settings is above the tabs (see `app/settings`). */
export default function TodayStack() {
  return (
    <Stack screenOptions={SCREEN_OPTIONS}>
      <Stack.Screen name="index" options={{ title: t('tabs.today'), headerShown: false }} />
      <Stack.Screen name="more" options={{ title: t('nav.more') }} />
      <Stack.Screen name="suggestions" options={{ title: t('nav.aiSuggestions') }} />
    </Stack>
  );
}
