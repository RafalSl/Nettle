import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, TextInput, View } from 'react-native';
import { NAIL_EXTENTS, NAIL_STAGES, type NailExtent, type NailStage, type SkinArea } from '@/core/model/types';
import { addArea, listActiveAreas, logNailEntry, repeatNailEntry } from '@/core/usecases/skin';
import { applyReminders } from '@/core/usecases/reminders';
import { areaLabel, errorMessage, reminderTexts, t } from '@/i18n';
import { useServices } from '@/services';
import { FormModal, useField, useForm } from '@/ui/FormModal';
import { useFormTime } from '@/ui/useFormTime';
import { Button, Chips, Hint, Label, TimeField, styles } from '@/ui/components';

/**
 * SK-10, SK-3: one nail area per affected nail; an entry has a stage and a rough extent instead of scores.
 * "No change" repeats the area's last stage and extent in one tap. Photos are added from the entry in the day's log.
 */
export function NailSection() {
  const { deps } = useServices();
  const router = useRouter();
  const f = useForm();
  const [areas, setAreas] = useState<SkinArea[]>([]);
  const [areaId, setAreaId] = useField<string | null>(null, f.touch);
  const [stage, setStage] = useField<NailStage | null>(null, f.touch);
  const [extent, setExtent] = useField<NailExtent | null>(null, f.touch);
  const [newName, setNewName] = useState('');
  const time = useFormTime(f.touch);

  const reload = useCallback(() => {
    listActiveAreas(deps, 'nail').then(setAreas);
  }, [deps]);
  useFocusEffect(reload);
  const selected = areaId && areas.some((a) => a.id === areaId) ? areaId : (areas[0]?.id ?? null);

  async function addNail() {
    try {
      const area = await addArea(deps, newName, 'nail'); // adding a nail is its own action, not part of the entry
      setNewName('');
      setAreaId(area.id);
      reload();
      await applyReminders(deps, reminderTexts()); // the weekly nail reminder exists only while nail areas exist
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }

  async function noChange() {
    try {
      if (!selected) return;
      await repeatNailEntry(deps, selected, time.atForSave);
      router.back();
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }

  const missing = !selected ? t('edit.areas') : !stage ? t('edit.stage') : !extent ? t('edit.extent') : null;
  return (
    <FormModal
      dirty={f.dirty}
      missing={missing}
      onSave={async () => {
        await logNailEntry(deps, { areaId: selected!, stage: stage!, extent: extent!, at: time.atForSave });
      }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput style={[styles.input, { flex: 1 }]} placeholder={t('more.nailAreaName')} value={newName} onChangeText={setNewName} />
        <Button kind="secondary" title={t('common.add')} accessibilityLabel={t('more.nailAddArea')} onPress={addNail} />
      </View>
      {areas.length === 0 ? (
        <Hint>{t('more.nailNone')}</Hint>
      ) : (
        <>
          <Chips items={areas.map((a) => ({ id: a.id, label: areaLabel(a) }))} selected={new Set(selected ? [selected] : [])} onToggle={setAreaId} />
          <Button kind="secondary" title={t('skin.noChange')} onPress={noChange} />
          <Label>{t('more.nailStage')}</Label>
          <Chips items={NAIL_STAGES.map((s) => ({ id: s, label: t(`nail.stages.${s}`) }))} selected={new Set(stage ? [stage] : [])} onToggle={(id) => setStage(id as NailStage)} />
          <Label>{t('more.nailExtent')}</Label>
          <Chips items={NAIL_EXTENTS.map((s) => ({ id: s, label: t(`nail.extents.${s}`) }))} selected={new Set(extent ? [extent] : [])} onToggle={(id) => setExtent(id as NailExtent)} />
          <TimeField value={time.value} onChange={time.set} />
        </>
      )}
    </FormModal>
  );
}
