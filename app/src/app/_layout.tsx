import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, Text } from 'react-native';
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

/** UX-3: Cancel on the leading edge of every form. Save stays in the form until the forms are unified. */
function CancelButton() {
  const router = useRouter();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t('common.cancel')} onPress={() => router.back()} hitSlop={8}>
      <Text style={{ color: '#208AEF', fontSize: 17 }}>{t('common.cancel')}</Text>
    </Pressable>
  );
}

const form = (title: string) => ({ title, presentation: 'modal' as const, headerLeft: () => <CancelButton /> });

/** UX-1, UX-3: the tabs sit in the root stack, and every entry form is a modal above them, one at a time. */
export default function RootLayout() {
  return (
    <ServicesProvider>
      <ReminderSync />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="form/meal" options={form(t('nav.meal'))} />
        <Stack.Screen name="form/skin" options={form(t('nav.skin'))} />
        <Stack.Screen name="form/checkin" options={form(t('nav.checkin'))} />
        <Stack.Screen name="form/intake" options={form(t('nav.intake'))} />
        <Stack.Screen name="form/treatment" options={form(t('nav.treatment'))} />
        <Stack.Screen name="form/nails" options={form(t('nav.nails'))} />
        <Stack.Screen name="form/reaction" options={form(t('nav.reaction'))} />
        <Stack.Screen name="form/change" options={form(t('nav.change'))} />
      </Stack>
    </ServicesProvider>
  );
}
