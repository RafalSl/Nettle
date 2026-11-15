import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Switch, Text, TextInput, View } from 'react-native';
import { NettleError } from '@/core/model/errors';
import { addDays, atOnDay, localDay } from '@/core/model/time';
import type { ListItem, OptionalScore } from '@/core/model/types';
import { getCheckIn, saveCheckIn } from '@/core/usecases/checkin';
import { listActiveItems } from '@/core/usecases/lists';
import { errorMessage, itemLabel, t } from '@/i18n';
import { useServices } from '@/services';
import { chooseAction } from '@/ui/actionSheet';
import { FormModal, useForm } from '@/ui/FormModal';
import { useCheckInScores } from '@/ui/useCheckInScores';
import { Button, Chips, Hint, Label, ScoreInput, TimeField, styles } from '@/ui/components';

interface Fields {
  wellbeing: OptionalScore;
  stress: OptionalScore;
  sleep: OptionalScore;
  abdominalPain: OptionalScore;
  bloating: boolean;
  tags: Set<string>;
  note: string;
}
const EMPTY: Fields = { wellbeing: null, stress: null, sleep: null, abdominalPain: null, bloating: false, tags: new Set(), note: '' };

/**
 * SK-7, SK-11, IN-6: the daily check-in, one record per local day. Nothing is filled in silently: "Same as
 * yesterday" is an explicit button. Closing the day is a separate switch; closing a day with no meals asks first.
 */
export default function CheckInForm() {
  const { deps } = useServices();
  const f = useForm();
  const { day: dayParam } = useLocalSearchParams<{ day?: string }>();
  // SK-9: a tap on a late reminder opens the check-in of the day it was delivered, not of today.
  const [at, setAt] = useState<Date | null>(() =>
    typeof dayParam === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dayParam) ? atOnDay(dayParam, deps.clock.now(), deps.clock.timeZone(), deps.dayStart.get()) : null,
  );
  const scoresOn = useCheckInScores(); // SK-7: a score switched off in Settings is not asked
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [tagList, setTagList] = useState<ListItem[]>([]);
  const [complete, setComplete] = useState(false);
  const day = localDay((at ?? deps.clock.now()).toISOString(), deps.clock.timeZone(), deps.dayStart.get());

  const load = useCallback(() => {
    (async () => {
      setTagList(await listActiveItems(deps, 'dailyTags'));
      const existing = await getCheckIn(deps, day);
      setFields(existing ? { ...existing, tags: new Set(existing.tags), note: existing.note ?? '' } : EMPTY);
      setComplete(!!existing?.completedAt);
    })().catch((e) => Alert.alert(errorMessage(e)));
  }, [deps, day]);
  useFocusEffect(load);

  const set = <K extends keyof Fields>(key: K, value: Fields[K]) => {
    f.touch();
    setFields((cur) => ({ ...cur, [key]: value }));
  };
  const toggleTag = (id: string) => {
    const next = new Set(fields.tags);
    if (!next.delete(id)) next.add(id);
    set('tags', next);
  };

  /** SK-7: copies yesterday's scores, bloating and tags into the form; the note and the time stay as they are. */
  async function sameAsYesterday() {
    try {
      const before = await getCheckIn(deps, addDays(day, -1) ?? day);
      if (!before) return void Alert.alert(t('today.noYesterday'));
      f.touch();
      setFields((cur) => ({ ...cur, wellbeing: before.wellbeing, stress: before.stress, sleep: before.sleep, abdominalPain: before.abdominalPain, bloating: before.bloating, tags: new Set(before.tags) }));
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }

  async function save(): Promise<void | false> {
    const input = { ...fields, tags: [...fields.tags], at: at ?? undefined, complete };
    try {
      await saveCheckIn(deps, input);
    } catch (e) {
      // SK-11: a day with no meals logged is closed only after the user confirms.
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
      {(['wellbeing', 'stress', 'sleep', 'abdominalPain'] as const).filter((k) => scoresOn[k]).map((k) => (
        <ScoreInput optional key={k} label={t(`today.${k}`)} value={fields[k]} onChange={(v) => set(k, v)} />
      ))}
      <View style={styles.timeRow}>
        <Label>{t('today.bloating')}</Label>
        <Switch value={fields.bloating} onValueChange={(v) => set('bloating', v)} accessibilityLabel={t('today.bloating')} />
      </View>
      <Label>{t('today.tags')}</Label>
      <Chips items={tagList.map((i) => ({ id: i.id, label: itemLabel(i) }))} selected={fields.tags} onToggle={toggleTag} />
      <Label>{t('common.note')}</Label>
      <TextInput style={styles.input} accessibilityLabel={t('common.note')} value={fields.note} onChangeText={(v) => set('note', v)} />
      <View style={styles.timeRow}>
        <Text style={styles.rowText}>{t('today.markComplete')}</Text>
        <Switch value={complete} onValueChange={(v) => (f.touch(), setComplete(v))} accessibilityLabel={t('today.markComplete')} />
      </View>
    </FormModal>
  );
}
