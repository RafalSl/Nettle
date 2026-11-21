import { Stack, useRootNavigationState, useRouter } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect } from 'react';
import { AppState, Pressable, Text } from 'react-native';
import { applyReminders, resolveReminderTap } from '@/core/usecases/reminders';
import { reminderTexts, t } from '@/i18n';
import { ServicesProvider, useServices } from '@/services';
import { unsavedForm } from '@/ui/formState';
import { LockOverlay } from '@/ui/LockOverlay';
import { useAnalysisRun } from '@/ui/useAnalysisRun';

/** SK-9: after start-up, make the scheduled reminders match the settings, the nail areas and the app language. */
function ReminderSync() {
  const { deps } = useServices();
  useEffect(() => {
    applyReminders(deps, reminderTexts()).catch((e: unknown) => console.warn('Reminders could not be scheduled:', e instanceof Error ? e.message : 'unknown error')); // a convenience: never block the app, but do not hide the failure
  }, [deps]);
  return null;
}

/**
 * LL-12: the screen stays awake while an analysis runs, and the runner is told when the app is left, so a request
 * that did not survive shows "interrupted" with a one-tap retry instead of a vague failure.
 */
function AnalysisWatcher() {
  const { analysisRunner } = useServices();
  const running = useAnalysisRun().status === 'running';
  useEffect(() => {
    if (!running) return;
    void activateKeepAwakeAsync('analysis').catch(() => undefined);
    const sub = AppState.addEventListener('change', (state) => state !== 'active' && analysisRunner.markBackgrounded());
    return () => {
      sub.remove();
      void deactivateKeepAwake('analysis').catch(() => undefined);
    };
  }, [running, analysisRunner]);
  return null;
}

/**
 * SK-9: a tap on a reminder opens its target. It starts listening only once the database is open (this sits
 * inside the services provider) and the root navigator is ready, so a cold start from a notification works.
 */
function ReminderTaps() {
  const { deps, appLock } = useServices();
  const router = useRouter();
  const ready = !!useRootNavigationState()?.key;
  useEffect(() => {
    if (!ready) return;
    return deps.notifier.onTap(async (tap) => {
      await appLock.whenUnlocked(); // SE-8: a tap waits for the unlock
      const action = await resolveReminderTap(deps, tap, { hasUnsavedForm: unsavedForm.current });
      if (!action) return;
      if (action.viaToday) {
        router.navigate('/today');
        router.push(action.route as never);
      } else router.navigate(action.route as never);
    });
  }, [deps, appLock, ready, router]);
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
      <ReminderTaps />
      <AnalysisWatcher />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="spike" options={{ headerShown: false }} />
        <Stack.Screen name="guide" options={{ title: t('nav.guide'), headerBackTitle: t('common.back') }} />
        <Stack.Screen name="form/meal" options={form(t('nav.meal'))} />
        <Stack.Screen name="form/skin" options={form(t('nav.skin'))} />
        <Stack.Screen name="form/checkin" options={form(t('nav.checkin'))} />
        <Stack.Screen name="form/drink" options={form(t('nav.drink'))} />
        <Stack.Screen name="form/medication" options={form(t('nav.medication'))} />
        <Stack.Screen name="form/stool" options={form(t('nav.stool'))} />
        <Stack.Screen name="form/treatment" options={form(t('nav.treatment'))} />
        <Stack.Screen name="form/nails" options={form(t('nav.nails'))} />
        <Stack.Screen name="form/reaction" options={form(t('nav.reaction'))} />
        <Stack.Screen name="form/change" options={form(t('nav.change'))} />
        <Stack.Screen name="form/medical" options={form(t('nav.medical'))} />
        <Stack.Screen name="form/edit" options={form(t('edit.title'))} />
      </Stack>
      <LockOverlay />
    </ServicesProvider>
  );
}
