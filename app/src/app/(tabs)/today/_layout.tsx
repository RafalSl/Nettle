import { Stack, useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { t } from '@/i18n';

function GearButton() {
  const router = useRouter();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t('nav.gear')} onPress={() => router.push('/today/settings')} hitSlop={8}>
      <Text style={{ fontSize: 22 }}>⚙︎</Text>
    </Pressable>
  );
}

/** UX-1: Settings and More are pushed inside the Today stack, so the tab bar stays visible. */
export default function TodayStack() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: t('tabs.today'), headerRight: () => <GearButton /> }} />
      <Stack.Screen name="more" options={{ title: t('nav.more') }} />
      <Stack.Screen name="settings/index" options={{ title: t('nav.settings') }} />
      <Stack.Screen name="settings/logging" options={{ title: t('nav.logging') }} />
      <Stack.Screen name="settings/areas" options={{ title: t('nav.areas') }} />
      <Stack.Screen name="settings/favorites" options={{ title: t('nav.favorites') }} />
      <Stack.Screen name="settings/suggestions" options={{ title: t('nav.suggestions') }} />
      <Stack.Screen name="settings/privacy" options={{ title: t('nav.privacy') }} />
      <Stack.Screen name="settings/reminders" options={{ title: t('nav.reminders') }} />
      <Stack.Screen name="settings/ai" options={{ title: t('nav.ai') }} />
      <Stack.Screen name="settings/about" options={{ title: t('nav.about') }} />
      <Stack.Screen name="settings/data" options={{ title: t('nav.data') }} />
    </Stack>
  );
}
