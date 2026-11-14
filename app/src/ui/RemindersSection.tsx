import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import {
  DEFAULT_REMINDERS,
  loadReminderSettings,
  saveReminderSettings,
  type ReminderSettings,
} from '@/core/usecases/reminders';
import { errorMessage, reminderTexts, t } from '@/i18n';
import { useServices } from '@/services';
import { Chips, Heading, Hint, Label, styles } from '@/ui/components';

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

  const load = useCallback(() => {
    loadReminderSettings(deps).then(setS).catch(() => undefined);
  }, [deps]);
  useFocusEffect(load);

  /** Shows the new value only after it was saved, so a refused permission leaves the switch off. */
  async function change(next: ReminderSettings) {
    try {
      await saveReminderSettings(deps, next, reminderTexts());
      setS(next);
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }

  const row = (label: string, value: boolean, onChange: (v: boolean) => void) => (
    <View style={styles.timeRow}>
      <Text style={styles.rowText}>{label}</Text>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} />
    </View>
  );
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
