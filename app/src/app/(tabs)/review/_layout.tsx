import { Stack } from 'expo-router';
import { t } from '@/i18n';
import { SCREEN_OPTIONS } from '@/ui/navTheme';
import { GearButton } from '@/ui/GearButton';

export default function ReviewStack() {
  return (
    <Stack screenOptions={SCREEN_OPTIONS}>
      <Stack.Screen name="index" options={{ title: t('tabs.review'), headerRight: () => <GearButton /> }} />
      <Stack.Screen name="day" options={{ title: t('nav.day') }} />
      <Stack.Screen name="area" options={{ title: t('nav.timeline') }} />
      <Stack.Screen name="health" options={{ title: t('nav.health') }} />
      <Stack.Screen name="report" options={{ title: t('nav.report') }} />
      <Stack.Screen name="analysis" options={{ title: t('nav.analysis') }} />
      <Stack.Screen name="pack" options={{ title: t('nav.pack') }} />
    </Stack>
  );
}
