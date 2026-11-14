import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { TextInput } from 'react-native';
import type { SkinArea } from '@/core/model/types';
import { markFlare, openFlareAreas } from '@/core/usecases/flares';
import { listActiveAreas } from '@/core/usecases/skin';
import { areaLabel, t } from '@/i18n';
import { useServices } from '@/services';
import { FormModal, useField, useForm } from '@/ui/FormModal';
import { useFormTime } from '@/ui/useFormTime';
import { Chips, Hint, Label, TimeField, styles } from '@/ui/components';

/**
 * SK-6: mark the start or the end of a flare of one skin area. The kind follows the area: a start when no flare is
 * open there, an end when one is. Scores are separate and stay as they are. Lives in More (UX-2).
 */
export function FlareSection() {
  const { deps } = useServices();
  const f = useForm();
  const [areas, setAreas] = useState<SkinArea[]>([]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [areaId, setAreaId] = useField<string | null>(null, f.touch);
  const [note, setNote] = useField('', f.touch);
  const time = useFormTime(f.touch);

  const reload = useCallback(() => {
    listActiveAreas(deps, 'skin').then(setAreas);
    openFlareAreas(deps).then(setOpen);
  }, [deps]);
  useFocusEffect(reload);
  const selected = areaId && areas.some((a) => a.id === areaId) ? areaId : (areas[0]?.id ?? null);
  const ending = selected !== null && open.has(selected);

  return (
    <FormModal
      dirty={f.dirty}
      missing={selected ? null : t('edit.area')}
      onSave={async () => void (await markFlare(deps, { areaId: selected!, kind: ending ? 'end' : 'start', at: time.atForSave, note }))}>
      <Label>{t('skin.area')}</Label>
      <Chips items={areas.map((a) => ({ id: a.id, label: `${areaLabel(a)}${open.has(a.id) ? ` · ${t('more.flareOpenMark')}` : ''}` }))} selected={new Set(selected ? [selected] : [])} onToggle={setAreaId} />
      {selected && <Hint>{t(ending ? 'more.flareWillEnd' : 'more.flareWillStart')}</Hint>}
      <TimeField value={time.value} onChange={time.set} />
      <Label>{t('common.note')}</Label>
      <TextInput style={styles.input} accessibilityLabel={t('common.note')} value={note} onChangeText={setNote} />
    </FormModal>
  );
}
