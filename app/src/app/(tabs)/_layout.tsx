import { Tabs } from 'expo-router';
import { t } from '@/i18n';

/** UX-1: two tabs, never hidden or disabled. Each tab has its own stack with the headers. */
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="today" options={{ title: t('tabs.today') }} />
      <Tabs.Screen name="review" options={{ title: t('tabs.review') }} />
    </Tabs>
  );
}
