import { Stack } from 'expo-router';
import { t } from '@/i18n';

export default function ReviewStack() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: t('tabs.review') }} />
      <Stack.Screen name="analysis" options={{ title: t('nav.analysis') }} />
    </Stack>
  );
}
