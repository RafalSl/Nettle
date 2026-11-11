import { Tabs } from 'expo-router';
import { ServicesProvider } from '@/services';
import { t } from '@/i18n';

export default function RootLayout() {
  return (
    <ServicesProvider>
      <Tabs>
        <Tabs.Screen name="index" options={{ title: t('tabs.meal') }} />
        <Tabs.Screen name="skin" options={{ title: t('tabs.skin') }} />
        <Tabs.Screen name="data" options={{ title: t('tabs.data') }} />
      </Tabs>
    </ServicesProvider>
  );
}
