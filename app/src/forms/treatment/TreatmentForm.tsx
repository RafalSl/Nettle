import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { TextInput } from '@/ui/themed';
import type { ListItem, SkinArea } from '@/core/model/types';
import { applyTreatment } from '@/core/usecases/events';
import { addListItem, listActiveItems } from '@/core/usecases/lists';
import { addRegularTreatment } from '@/core/usecases/regular';
import { listActiveAreas } from '@/core/usecases/skin';
import { areaLabel, itemDescription, itemLabel, t } from '@/i18n';
import { useServices } from '@/services';
import { FormModal, useField, useForm } from '@/ui/FormModal';
import { useFormTime } from '@/forms/useFormTime';
import { Button, Chips, Hint, Label, TimeField, styles } from '@/ui/components';
import { SwitchRow } from '@/ui/SwitchRow';
import { showError } from '@/ui/showError';
import { toggled } from '@/ui/sets';

/** IN-11: a saved list of treatments; applying one to one or more areas is timestamped (now, or the chosen day). */
export default function TreatmentForm() {
  const { deps } = useServices();
  const f = useForm();
  const [treatments, setTreatments] = useState<ListItem[]>([]);
  const [areas, setAreas] = useState<SkinArea[]>([]);
  const [treatmentId, setTreatmentId] = useField<string | null>(null, f.touch);
  const [areaIds, setAreaIds] = useField<Set<string>>(new Set(), f.touch);
  const [newName, setNewName] = useState('');
  const [regular, setRegular] = useField(false, f.touch);
  const time = useFormTime(f.touch);

  const reload = useCallback(() => {
    listActiveItems(deps, 'treatments').then(setTreatments);
    listActiveAreas(deps).then(setAreas);
  }, [deps]);
  useFocusEffect(reload);
  const selected = treatmentId && treatments.some((x) => x.id === treatmentId) ? treatmentId : (treatments[0]?.id ?? null);
  const chosen = treatments.find((x) => x.id === selected);

  async function addTreatment() {
    try {
      const item = await addListItem(deps, 'treatments', newName); // adding to the list is its own action
      setNewName('');
      setTreatmentId(item.id);
      reload();
    } catch (e) {
      showError(e);
    }
  }

  const missing = !selected ? t('edit.treatment') : areaIds.size === 0 ? t('edit.areas') : null;
  return (
    <FormModal
      dirty={f.dirty}
      missing={missing}
      onSave={async () => {
        await applyTreatment(deps, { treatmentId: selected!, areaIds: [...areaIds], at: time.atForSave });
        if (regular) await addRegularTreatment(deps, { treatmentId: selected!, areaIds: [...areaIds] }); // IN-17
      }}
    >
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput style={[styles.input, { flex: 1 }]} placeholder={t('more.treatmentNew')} value={newName} onChangeText={setNewName} />
        <Button kind="secondary" title={t('common.add')} accessibilityLabel={t('more.treatmentAdd')} onPress={addTreatment} />
      </View>
      {treatments.length === 0 ? (
        <Hint>{t('more.treatmentNone')}</Hint>
      ) : (
        <>
          <Chips
            items={treatments.map((i) => ({ id: i.id, label: itemLabel(i) }))}
            selected={new Set(selected ? [selected] : [])}
            onToggle={setTreatmentId}
          />
          {chosen && itemDescription(chosen) ? <Hint>{itemDescription(chosen)}</Hint> : null}
          <Label>{t('more.treatmentAreas')}</Label>
          <Chips
            items={areas.map((a) => ({ id: a.id, label: areaLabel(a) }))}
            selected={areaIds}
            onToggle={(id) => setAreaIds(toggled(areaIds, id))}
          />
          <SwitchRow
            title={t('regular.switch')}
            hint={regular ? t('regular.switchHint') : undefined}
            value={regular}
            onChange={setRegular}
          />
          <TimeField value={time.value} onChange={time.set} />
        </>
      )}
    </FormModal>
  );
}
