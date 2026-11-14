import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { NettleError } from '@/core/model/errors';
import { atOnDay, localDay } from '@/core/model/time';
import type { ListItem, OptionalScore, StoolEntry } from '@/core/model/types';
import { getCheckIn, logStool, saveCheckIn, setDayComplete } from '@/core/usecases/checkin';
import { listActiveItems } from '@/core/usecases/lists';
import { errorMessage, itemLabel, t } from '@/i18n';
import { useServices } from '@/services';
import {
  Button,
  Chips,
  Heading,
  Hint,
  Label,
  OptionalScoreStepper,
  Screen,
  TimeField,
  styles,
} from '@/ui/components';

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
const BRISTOL = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ id: String(n), label: String(n) }));

/** SK-7, SK-11, IN-6: the daily check-in, with stool entries. One screen, one record per local day. */
export default function TodayScreen() {
  const { deps } = useServices();
  const { day: dayParam } = useLocalSearchParams<{ day?: string }>();
  // SK-9: a tap on a late reminder opens the check-in of the day it was delivered, not of today.
  const [at, setAt] = useState<Date | null>(() =>
    typeof dayParam === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dayParam) ? atOnDay(dayParam, deps.clock.now(), deps.clock.timeZone()) : null,
  );
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [tagList, setTagList] = useState<ListItem[]>([]);
  const [completed, setCompleted] = useState(false);
  const [stool, setStool] = useState<StoolEntry[]>([]);
  const [bristol, setBristol] = useState<string | null>(null);

  const day = localDay((at ?? new Date()).toISOString(), deps.clock.timeZone());

  const load = useCallback(() => {
    (async () => {
      setTagList(await listActiveItems(deps, 'dailyTags'));
      const existing = await getCheckIn(deps, day);
      setFields(
        existing
          ? { ...existing, tags: new Set(existing.tags), note: existing.note ?? '' }
          : EMPTY,
      );
      setCompleted(!!existing?.completedAt);
      setStool((await deps.repo.listRecords('stoolEntries')).slice(0, 5));
    })().catch((e) => Alert.alert(errorMessage(e)));
  }, [deps, day]);
  useFocusEffect(load);

  const set = <K extends keyof Fields>(key: K, value: Fields[K]) => setFields((f) => ({ ...f, [key]: value }));
  const toggleTag = (id: string) => {
    const next = new Set(fields.tags);
    if (!next.delete(id)) next.add(id);
    set('tags', next);
  };

  async function save(complete?: boolean, confirmEmptyDay?: boolean) {
    try {
      await saveCheckIn(deps, { ...fields, tags: [...fields.tags], at: at ?? undefined, complete, confirmEmptyDay });
      load();
    } catch (e) {
      // SK-11: a day with no meals logged is closed only after the user confirms.
      if (e instanceof NettleError && e.code === 'day_has_no_meals') {
        Alert.alert(errorMessage(e), undefined, [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('today.closeAnyway'), onPress: () => void save(complete, true) },
        ]);
      } else Alert.alert(errorMessage(e));
    }
  }

  async function reopen() {
    try {
      await setDayComplete(deps, day, false);
      load();
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }

  async function addStool() {
    try {
      if (!bristol) return;
      await logStool(deps, { bristol: Number(bristol) });
      setBristol(null);
      load();
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }

  return (
    <Screen>
      <Heading>{t('today.title')}</Heading>
      <Hint>
        {t('today.day')}: {day}
      </Hint>
      <TimeField value={at ?? new Date()} onChange={setAt} />
      <Hint>{t('today.hint')}</Hint>
      <OptionalScoreStepper label={t('today.wellbeing')} value={fields.wellbeing} onChange={(v) => set('wellbeing', v)} />
      <OptionalScoreStepper label={t('today.stress')} value={fields.stress} onChange={(v) => set('stress', v)} />
      <OptionalScoreStepper label={t('today.sleep')} value={fields.sleep} onChange={(v) => set('sleep', v)} />
      <OptionalScoreStepper
        label={t('today.abdominalPain')}
        value={fields.abdominalPain}
        onChange={(v) => set('abdominalPain', v)}
      />
      <View style={styles.timeRow}>
        <Label>{t('today.bloating')}</Label>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: fields.bloating }}
          onPress={() => set('bloating', !fields.bloating)}
          style={[styles.chip, fields.bloating && styles.chipOn]}>
          <Text style={{ color: fields.bloating ? '#fff' : '#111' }}>
            {fields.bloating ? t('common.yes') : t('common.no')}
          </Text>
        </Pressable>
      </View>

      <Label>{t('today.tags')}</Label>
      <Chips
        items={tagList.map((i) => ({ id: i.id, label: itemLabel(i) }))}
        selected={fields.tags}
        onToggle={toggleTag}
      />

      <Label>{t('common.note')}</Label>
      <TextInput style={styles.input} value={fields.note} onChangeText={(v) => set('note', v)} />

      <Button kind="secondary" title={t('common.save')} onPress={() => save()} />
      {completed ? (
        <>
          <Hint>{t('today.dayComplete')}</Hint>
          <Button kind="secondary" title={t('today.reopen')} onPress={reopen} />
        </>
      ) : (
        <Button title={t('today.saveClose')} onPress={() => save(true)} />
      )}

      <Heading>{t('today.stoolTitle')}</Heading>
      <Hint>{t('today.stoolHint')}</Hint>
      <Chips items={BRISTOL} selected={new Set(bristol ? [bristol] : [])} onToggle={(id) => setBristol(id === bristol ? null : id)} />
      <Button title={t('today.stoolAdd')} onPress={addStool} />
      {stool.map((s) => (
        <View key={s.id} style={styles.row}>
          <Text style={styles.rowText}>
            {new Date(s.at.utc).toLocaleString()} · {s.bristol}
          </Text>
        </View>
      ))}
    </Screen>
  );
}
