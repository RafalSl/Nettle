import { Stack } from 'expo-router';
import { t } from '@/i18n';
import { GearButton } from '@/ui/GearButton';

/** UX-1: More is pushed inside the Today stack; Settings is above the tabs (see `app/settings`). */
export default function TodayStack() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: t('tabs.today'), headerRight: () => <GearButton /> }} />
      <Stack.Screen name="more" options={{ title: t('nav.more') }} />
    </Stack>
  );
}
