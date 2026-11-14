import DateTimePicker from '@react-native-community/datetimepicker';
import { View } from 'react-native';
import { localDay } from '@/core/model/time';
import { t } from '@/i18n';
import { useServices } from '@/services';
import { Hint, Label, styles } from '@/ui/components';

/** The calendar day ("YYYY-MM-DD") a date picker shows. A picked date is a calendar day, not an instant. */
export const pickedDay = (d: Date, tz: string) => localDay(d.toISOString(), tz);

/**
 * EX-1, EX-14: a "from" and a "to" day. Both are calendar days; the core turns them into the diary's days with the
 * day start (NF-7). `from` after `to` is refused with a line saying so.
 */
export function DayRangePickers({ from, to, onFrom, onTo }: { from: Date; to: Date; onFrom: (d: Date) => void; onTo: (d: Date) => void }) {
  const { deps } = useServices();
  const tz = deps.clock.timeZone();
  const invalid = pickedDay(from, tz) > pickedDay(to, tz);
  return (
    <>
      <View style={styles.timeRow}>
        <Label>{t('range.from')}</Label>
        <DateTimePicker mode="date" value={from} maximumDate={to} onValueChange={(_e, d) => onFrom(d)} />
      </View>
      <View style={styles.timeRow}>
        <Label>{t('range.to')}</Label>
        <DateTimePicker mode="date" value={to} maximumDate={new Date()} onValueChange={(_e, d) => onTo(d)} />
      </View>
      {invalid && <Hint>{t('range.invalid')}</Hint>}
    </>
  );
}
