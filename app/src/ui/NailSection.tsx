import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { NAIL_EXTENTS, NAIL_STAGES, type NailEntry, type NailExtent, type NailStage, type SkinArea } from '@/core/model/types';
import { addArea, listActiveAreas, logNailEntry } from '@/core/usecases/skin';
import { applyReminders } from '@/core/usecases/reminders';
import { areaLabel, errorMessage, reminderTexts, t } from '@/i18n';
import { useServices } from '@/services';
import { PhotoStrip } from '@/ui/PhotoStrip';
import { Button, Chips, Heading, Hint, Label, TimeField, styles } from '@/ui/components';

/** SK-10: one nail area per affected nail; an entry has a stage and a rough extent instead of scores. */
export function NailSection() {
  const { deps } = useServices();
  const [areas, setAreas] = useState<SkinArea[]>([]);
  const [recent, setRecent] = useState<NailEntry[]>([]);
  const [areaId, setAreaId] = useState<string | null>(null);
  const [stage, setStage] = useState<NailStage | null>(null);
  const [extent, setExtent] = useState<NailExtent | null>(null);
  const [newName, setNewName] = useState('');
  const [at, setAt] = useState<Date | null>(null);

  const reload = useCallback(() => {
    listActiveAreas(deps, 'nail').then((a) => {
      setAreas(a);
      setAreaId((cur) => (cur && a.some((x) => x.id === cur) ? cur : (a[0]?.id ?? null)));
    });
    deps.repo.listRecords('nailEntries').then((e) => setRecent(e.slice(0, 5)));
  }, [deps]);
  useFocusEffect(reload);

  async function addNail() {
    try {
      const area = await addArea(deps, newName, 'nail');
      setNewName('');
      setAreaId(area.id);
      reload();
      await applyReminders(deps, reminderTexts()); // the weekly nail reminder exists only while nail areas exist
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }

  async function save() {
    try {
      if (!areaId || !stage || !extent) throw new Error('incomplete'); // shown as the generic message
      await logNailEntry(deps, { areaId, stage, extent, at: at ?? undefined });
      setStage(null);
      setExtent(null);
      setAt(null);
      reload();
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }

  const labelFor = (id: string) => {
    const a = areas.find((x) => x.id === id);
    return a ? areaLabel(a) : id;
  };

  return (
    <>
      <Heading>{t('more.nailTitle')}</Heading>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput style={[styles.input, { flex: 1 }]} placeholder={t('more.nailAreaName')} value={newName} onChangeText={setNewName} />
        <Button kind="secondary" title={t('common.add')} accessibilityLabel={t('more.nailAddArea')} onPress={addNail} />
      </View>
      {areas.length === 0 ? (
        <Hint>{t('more.nailNone')}</Hint>
      ) : (
        <>
          <Chips items={areas.map((a) => ({ id: a.id, label: areaLabel(a) }))} selected={new Set(areaId ? [areaId] : [])} onToggle={setAreaId} />
          <Label>{t('more.nailStage')}</Label>
          <Chips
            items={NAIL_STAGES.map((s) => ({ id: s, label: t(`nail.stages.${s}`) }))}
            selected={new Set(stage ? [stage] : [])}
            onToggle={(id) => setStage(id as NailStage)}
          />
          <Label>{t('more.nailExtent')}</Label>
          <Chips
            items={NAIL_EXTENTS.map((s) => ({ id: s, label: t(`nail.extents.${s}`) }))}
            selected={new Set(extent ? [extent] : [])}
            onToggle={(id) => setExtent(id as NailExtent)}
          />
          <TimeField value={at ?? new Date()} onChange={setAt} />
          <Button title={t('more.nailSave')} onPress={save} />
        </>
      )}
      {recent.map((e) => (
        <View key={e.id} style={styles.row}>
          <Text style={styles.rowText}>
            {new Date(e.at.utc).toLocaleString()} · {labelFor(e.areaId)}
          </Text>
          <Hint>
            {t(`nail.stages.${e.stage}`)} · {t(`nail.extents.${e.extent}`)}
          </Hint>
          <PhotoStrip entryKind="nailEntry" entryId={e.id} />
        </View>
      ))}
    </>
  );
}
