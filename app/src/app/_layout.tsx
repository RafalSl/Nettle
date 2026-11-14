import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { applyReminders } from '@/core/usecases/reminders';
import { reminderTexts, t } from '@/i18n';
import { ServicesProvider, useServices } from '@/services';

/** SK-9: after start-up, make the scheduled reminders match the settings, the nail areas and the app language. */
function ReminderSync() {
  const { deps } = useServices();
  useEffect(() => {
    applyReminders(deps, reminderTexts()).catch(() => undefined); // reminders are a convenience; never block the app
  }, [deps]);
  return null;
}

export default function RootLayout() {
  return (
    <ServicesProvider>
      <ReminderSync />
      <Tabs>
        <Tabs.Screen name="index" options={{ title: t('tabs.meal') }} />
        <Tabs.Screen name="today" options={{ title: t('tabs.today') }} />
        <Tabs.Screen name="skin" options={{ title: t('tabs.skin') }} />
        <Tabs.Screen name="more" options={{ title: t('tabs.more') }} />
        <Tabs.Screen name="data" options={{ title: t('tabs.data') }} />
        <Tabs.Screen name="analysis" options={{ title: t('tabs.analysis'), href: null }} />
      </Tabs>
    </ServicesProvider>
  );
}
