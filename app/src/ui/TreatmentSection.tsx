import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, TextInput, View } from 'react-native';
import type { ListItem, SkinArea } from '@/core/model/types';
import { applyTreatment } from '@/core/usecases/events';
import { addListItem, listActiveItems } from '@/core/usecases/lists';
import { listActiveAreas } from '@/core/usecases/skin';
import { areaLabel, errorMessage, itemLabel, t } from '@/i18n';
import { useServices } from '@/services';
import { Button, Chips, Heading, Hint, Label, styles } from '@/ui/components';

/** IN-11: a saved list of treatments; applying one to one or more areas is a single tap, timestamped now. */
export function TreatmentSection() {
  const { deps } = useServices();
  const [treatments, setTreatments] = useState<ListItem[]>([]);
  const [areas, setAreas] = useState<SkinArea[]>([]);
  const [treatmentId, setTreatmentId] = useState<string | null>(null);
  const [areaIds, setAreaIds] = useState<Set<string>>(new Set());
  const [newName, setNewName] = useState('');

  const reload = useCallback(() => {
    listActiveItems(deps, 'treatments').then((l) => {
      setTreatments(l);
      setTreatmentId((cur) => (cur && l.some((x) => x.id === cur) ? cur : (l[0]?.id ?? null)));
    });
    listActiveAreas(deps).then(setAreas);
  }, [deps]);
  useFocusEffect(reload);

  async function addTreatment() {
    try {
      const item = await addListItem(deps, 'treatments', newName);
      setNewName('');
      setTreatmentId(item.id);
      reload();
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }

  const toggleArea = (id: string) =>
    setAreaIds((cur) => {
      const next = new Set(cur);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  async function apply() {
    try {
      if (!treatmentId) return;
      await applyTreatment(deps, { treatmentId, areaIds: [...areaIds] });
      setAreaIds(new Set());
      Alert.alert(t('more.applied'));
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }

  return (
    <>
      <Heading>{t('more.treatmentTitle')}</Heading>
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
            selected={new Set(treatmentId ? [treatmentId] : [])}
            onToggle={setTreatmentId}
          />
          <Label>{t('more.treatmentAreas')}</Label>
          <Chips items={areas.map((a) => ({ id: a.id, label: areaLabel(a) }))} selected={areaIds} onToggle={toggleArea} />
          <Button title={t('more.treatmentApply')} onPress={apply} />
        </>
      )}
    </>
  );
}
