import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import { Text } from '@/ui/themed';
import { listRegular } from '@/core/usecases/regular';
import { NavRow } from '@/ui/NavRow';
import {
  DEFAULT_REMINDERS,
  loadReminderSettings,
  reminderStatus,
  saveReminderSettings,
  sendTestReminder,
  type ReminderSettings,
} from '@/core/usecases/reminders';
import { errorMessage, reminderTexts, t } from '@/i18n';
import { useServices } from '@/services';
import type { ReminderStatus } from '@/core/ports/notifier';
import { Button, Chips, Heading, Hint, Label, styles } from '@/ui/components';
import { SwitchRow } from '@/ui/SwitchRow';
import { color } from '@/ui/theme';

const at = (hour: number, minute: number) => {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
};
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];
const MONTH_DAYS = [1, 5, 10, 15, 20, 25, 28];

/** SK-9: daily check-in, weekly nail photo and monthly export reminders, as local notifications. */
export function RemindersSection() {
  const { deps } = useServices();
  const [s, setS] = useState<ReminderSettings>(DEFAULT_REMINDERS);
  const router = useRouter();
  const [regular, setRegular] = useState({ n: 0, withReminders: 0 });
  const [denied, setDenied] = useState(false);
  const [status, setStatus] = useState<ReminderStatus | null>(null);

  const load = useCallback(() => {
    loadReminderSettings(deps).then(setS).catch(() => undefined);
    reminderStatus(deps).then(setStatus, () => setStatus(null));
    listRegular(deps).then((r) => setRegular({ n: r.length, withReminders: r.filter((x) => x.times.length > 0).length }), () => undefined);
  }, [deps]);
  useFocusEffect(load);

  /** Shows the new value only after it was saved, so a refused permission leaves the switch off. */
  async function change(next: ReminderSettings) {
    try {
      await saveReminderSettings(deps, next, reminderTexts());
      setS(next);
      setDenied(false);
      reminderStatus(deps).then(setStatus, () => undefined);
    } catch (e) {
      setDenied(e instanceof Error && 'code' in e && (e as { code: string }).code === 'notifications_denied');
      Alert.alert(errorMessage(e));
    }
  }

  async function sendTest() {
    try {
      await sendTestReminder(deps, t('reminders.test.title'), t('reminders.test.body'));
      Alert.alert(t('reminders.test.sent'));
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
    reminderStatus(deps).then(setStatus, () => undefined);
  }

  // NO-3: with notifications blocked in iOS Settings the switches are off and disabled, and a coral banner says why.
  const blocked = status?.permission === 'denied';
  const row = (label: string, value: boolean, onChange: (v: boolean) => void) => <SwitchRow title={label} value={value && !blocked} onChange={onChange} disabled={blocked} />;
  const time = (hour: number, minute: number, onChange: (h: number, m: number) => void) => (
    <View style={styles.timeRow}>
      <Label>{t('reminders.time')}</Label>
      <DateTimePicker mode="time" value={at(hour, minute)} onValueChange={(_e, d) => onChange(d.getHours(), d.getMinutes())} />
    </View>
  );

  return (
    <>
      <Heading>{t('reminders.title')}</Heading>
      <Hint>{t('reminders.hint')}</Hint>
      {(denied || blocked) && (
        <View style={{ padding: 14, borderRadius: 22, gap: 10, backgroundColor: color.alertSoft, borderWidth: 1, borderColor: color.alertLine }}>
          <Text style={{ color: color.alert, fontWeight: '600', fontSize: 14.5 }}>{t('regular.denied')}</Text>
          <Button kind="secondary" title={t('regular.openSystem')} onPress={() => void Linking.openSettings()} />
        </View>
      )}
      {status && <Hint>{t(`reminders.status.${status.permission}`, { n: status.scheduled })}</Hint>}
      <Button kind="secondary" title={t('reminders.test.button')} onPress={() => void sendTest()} />
      <NavRow title={t('regular.title')} subtitle={t('regular.summary', { n: regular.n, m: regular.withReminders })} onPress={() => router.push('/settings/regular')} />

      {row(t('reminders.checkIn'), s.checkIn.enabled, (enabled) => change({ ...s, checkIn: { ...s.checkIn, enabled } }))}
      {s.checkIn.enabled && time(s.checkIn.hour, s.checkIn.minute, (hour, minute) => change({ ...s, checkIn: { ...s.checkIn, hour, minute } }))}

      {row(t('reminders.nails'), s.nails.enabled, (enabled) => change({ ...s, nails: { ...s.nails, enabled } }))}
      {s.nails.enabled && (
        <>
          <Hint>{t('reminders.weekday')}</Hint>
          <Chips
            items={WEEKDAYS.map((d) => ({ id: String(d), label: t(`reminders.weekdays.${d}`) }))}
            selected={new Set([String(s.nails.weekday)])}
            onToggle={(id) => change({ ...s, nails: { ...s.nails, weekday: Number(id) } })}
          />
          {time(s.nails.hour, s.nails.minute, (hour, minute) => change({ ...s, nails: { ...s.nails, hour, minute } }))}
        </>
      )}

      {row(t('reminders.backup'), s.backup.enabled, (enabled) => change({ ...s, backup: { ...s.backup, enabled } }))}
      {s.backup.enabled && (
        <>
          <Hint>{t('reminders.dayOfMonth')}</Hint>
          <Chips
            items={MONTH_DAYS.map((d) => ({ id: String(d), label: String(d) }))}
            selected={new Set([String(s.backup.day)])}
            onToggle={(id) => change({ ...s, backup: { ...s.backup, day: Number(id) } })}
          />
        </>
      )}
    </>
  );
}
