import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import { Text } from '@/ui/themed';
import type { RegularItem, ReminderTime } from '@/core/model/preferences';
import type { ListItem, SkinArea } from '@/core/model/types';
import { listRegular } from '@/core/usecases/regular';
import { saveRegularHideName, saveRegularReminders, stopRegularAndRemind } from '@/core/usecases/regularReminders';
import { areaLabel, errorMessage, itemLabel, reminderTexts, t } from '@/i18n';
import { useServices } from '@/services';
import { confirmDestructive } from '@/ui/actionSheet';
import { NavRow } from '@/ui/NavRow';
import { Button, Heading, Hint, Label, Screen, styles } from '@/ui/components';
import { SwitchRow } from '@/ui/SwitchRow';
import { EmptyState } from '@/ui/EmptyState';

/** The name of a regular item for lists: a medication's name and dose, or a treatment with its areas. */
export function regularName(r: RegularItem, treatments: ListItem[], areas: SkinArea[]): string {
  if (r.kind === 'medication') return r.dose ? `${r.name} ${r.dose}` : (r.name ?? '');
  const tr = treatments.find((x) => x.id === r.treatmentId);
  const names = r.areaIds.map((id) => {
    const a = areas.find((x) => x.id === id);
    return a ? areaLabel(a) : id;
  });
  return `${tr ? itemLabel(tr) : r.treatmentId}: ${names.join(', ')}`;
}

function useRegular() {
  const { deps } = useServices();
  const [state, setState] = useState<{ items: RegularItem[]; treatments: ListItem[]; areas: SkinArea[] }>({
    items: [],
    treatments: [],
    areas: [],
  });
  const reload = useCallback(() => {
    (async () =>
      setState({
        items: await listRegular(deps),
        treatments: await deps.repo.listItems('treatments'),
        areas: await deps.repo.listAreas(),
      }))().catch((e) => Alert.alert(errorMessage(e)));
  }, [deps]);
  useFocusEffect(reload);
  return { ...state, reload };
}

/** IN-17, UX-6: Settings, Logging, "Regular items": every regular medication and treatment, each opening its own screen. */
export default function RegularItemsScreen() {
  const router = useRouter();
  const { items, treatments, areas } = useRegular();
  return (
    <Screen>
      <Heading>{t('regular.title')}</Heading>
      {items.length === 0 && <EmptyState title={t('regular.noneTitle')} body={t('regular.none')} />}
      {items.map((r) => (
        <NavRow
          key={r.id}
          title={regularName(r, treatments, areas)}
          subtitle={`${t(r.kind === 'medication' ? 'regular.kindMedication' : 'regular.kindTreatment')} · ${r.times.length > 0 ? r.times.map(timeText).join(', ') : t('regular.noTimes')}`}
          onPress={() => router.push({ pathname: '/settings/regular-item', params: { id: r.id } })}
        />
      ))}
    </Screen>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');
const timeText = (x: ReminderTime) => `${pad(x.hour)}:${pad(x.minute)}`;
const at = (x: ReminderTime) => {
  const d = new Date();
  d.setHours(x.hour, x.minute, 0, 0);
  return d;
};

/** IN-17: one regular item: reminder times, the hide-name switch and Stop. */
export function RegularItemScreen() {
  const { deps } = useServices();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { items, treatments, areas, reload } = useRegular();
  const [draft, setDraft] = useState<Date>(() => at({ hour: 8, minute: 0 }));
  const [denied, setDenied] = useState(false);
  const item = items.find((r) => r.id === id);
  if (!item)
    return (
      <Screen>
        <Hint>{t('regular.none')}</Hint>
      </Screen>
    );

  async function run(fn: () => Promise<unknown>) {
    try {
      await fn();
      setDenied(false);
      reload();
    } catch (e) {
      if (e instanceof Error && 'code' in e && (e as { code: string }).code === 'notifications_denied') setDenied(true);
      Alert.alert(errorMessage(e));
    }
  }
  const setTimes = (times: ReminderTime[]) => run(() => saveRegularReminders(deps, item!.id, times, reminderTexts()));

  return (
    <Screen>
      <Heading>{regularName(item, treatments, areas)}</Heading>
      <Hint>{t(item.kind === 'medication' ? 'regular.kindMedication' : 'regular.kindTreatment')}</Hint>

      <Label>{t('regular.reminders')}</Label>
      {item.times.length === 0 && <Hint>{t('regular.noTimes')}</Hint>}
      {item.times.map((x) => (
        <View key={timeText(x)} style={styles.timeRow}>
          <Text style={styles.rowText}>{timeText(x)}</Text>
          <Button
            kind="secondary"
            title={t('common.remove')}
            accessibilityLabel={t('regular.removeTime', { time: timeText(x) })}
            onPress={() => void setTimes(item.times.filter((y) => y !== x))}
          />
        </View>
      ))}
      <View style={styles.timeRow}>
        <DateTimePicker mode="time" value={draft} onValueChange={(_e, d) => setDraft(d)} />
        <Button
          kind="secondary"
          title={t('regular.addTime')}
          onPress={() => void setTimes([...item.times, { hour: draft.getHours(), minute: draft.getMinutes() }])}
        />
      </View>
      {denied && (
        <>
          <Hint>{t('regular.denied')}</Hint>
          <Button kind="secondary" title={t('regular.openSystem')} onPress={() => void Linking.openSettings()} />
        </>
      )}

      <SwitchRow
        title={t('regular.hideName')}
        hint={t('regular.hideNameHint')}
        value={item.hideName}
        onChange={(v) => void run(() => saveRegularHideName(deps, item.id, v, reminderTexts()))}
      />

      <Button
        kind="secondary"
        title={t('regular.stop')}
        onPress={() =>
          void confirmDestructive({ title: t('regular.stopTitle'), message: t('regular.stopBody'), action: t('regular.stop') }).then(
            async (ok) => {
              if (!ok) return;
              await run(() => stopRegularAndRemind(deps, item.id, reminderTexts()));
              router.back();
            },
          )
        }
      />
    </Screen>
  );
}
