import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, TextInput } from 'react-native';
import { NettleError } from '@/core/model/errors';
import { addDays, atOnDay, localDay } from '@/core/model/time';
import type { ListItem } from '@/core/model/types';
import { askableValues, getCheckIn, saveCheckIn } from '@/core/usecases/checkin';
import { listActiveItems } from '@/core/usecases/lists';
import { errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { chooseAction } from '@/ui/actionSheet';
import { FormModal, useForm } from '@/ui/FormModal';
import { DailyHealthFields, type DailyValues } from '@/ui/DailyHealthFields';
import { Button, Hint, Label, TimeField, styles } from '@/ui/components';

/**
 * SK-7, SK-11: the Daily health form, one record per local day. Nothing is filled in silently: "Same as
 * yesterday" is an explicit button. Saving logs the day; a day with no meals asks first.
 */
export default function CheckInForm() {
  const { deps } = useServices();
  const f = useForm();
  const { day: dayParam } = useLocalSearchParams<{ day?: string }>();
  // SK-9: a tap on a late reminder opens the form of the day it was delivered, not of today.
  const [at, setAt] = useState<Date | null>(() =>
    typeof dayParam === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dayParam) ? atOnDay(dayParam, deps.clock.now(), deps.clock.timeZone(), deps.dayStart.get()) : null,
  );
  const [values, setValues] = useState<DailyValues>({});
  const [note, setNote] = useState('');
  const [items, setItems] = useState<ListItem[]>([]);
  const day = localDay((at ?? deps.clock.now()).toISOString(), deps.clock.timeZone(), deps.dayStart.get());

  const load = useCallback(() => {
    (async () => {
      setItems(await listActiveItems(deps, 'dailyItems'));
      const existing = await getCheckIn(deps, day);
      setValues(existing ? { ...existing.values } : {});
      setNote(existing?.note ?? '');
    })().catch((e) => Alert.alert(errorMessage(e)));
  }, [deps, day]);
  useFocusEffect(load);

  /** SK-7: copies yesterday's values into the form for all items still asked; the note and the time stay as they are. */
  async function sameAsYesterday() {
    try {
      const before = await getCheckIn(deps, addDays(day, -1) ?? day);
      if (!before) return void Alert.alert(t('today.noYesterday'));
      f.touch();
      setValues(askableValues(items, before));
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }

  async function save(): Promise<void | false> {
    const input = { values, note, at: at ?? undefined };
    try {
      await saveCheckIn(deps, input);
    } catch (e) {
      // SK-11: a day with no meals logged is saved only after the user confirms.
      if (e instanceof NettleError && e.code === 'day_has_no_meals') {
        const choice = await chooseAction({ title: errorMessage(e), actions: [{ label: t('today.closeAnyway') }] });
        if (choice !== 0) return false;
        await saveCheckIn(deps, { ...input, confirmEmptyDay: true });
      } else throw e;
    }
  }

  return (
    <FormModal dirty={f.dirty} missing={null} onSave={save}>
      <Hint>
        {t('today.day')}: {day}
      </Hint>
      <TimeField value={at ?? deps.clock.now()} onChange={(d) => (f.touch(), setAt(d))} />
      <Button kind="secondary" title={t('today.sameAsYesterday')} onPress={() => void sameAsYesterday()} />
      <Hint>{t('today.hint')}</Hint>
      <DailyHealthFields items={items} values={values} onChange={(v) => (f.touch(), setValues(v))} />
      <Label>{t('common.note')}</Label>
      <TextInput style={styles.input} accessibilityLabel={t('common.note')} value={note} onChangeText={(v) => (f.touch(), setNote(v))} />
    </FormModal>
  );
}
