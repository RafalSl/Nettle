import { MEDICATION_CATEGORIES, type MedicationCategory } from '@/core/model/types';
import { t } from '@/i18n';
import { Chips, styles } from '@/ui/components';
import { one } from '@/ui/sets';
import { TextInput } from '@/ui/themed';

/** IN-5: medication or supplement, the name and an optional dose; shared by the new-entry form and the edit form. */
export function MedicationFields(p: {
  category: MedicationCategory;
  onCategory: (c: MedicationCategory) => void;
  name: string;
  onName: (v: string) => void;
  dose: string;
  onDose: (v: string) => void;
}) {
  return (
    <>
      <Chips
        items={MEDICATION_CATEGORIES.map((k) => ({
          id: k,
          label: t(k === 'medication' ? 'more.medKindMedication' : 'more.medKindSupplement'),
        }))}
        selected={one(p.category)}
        onToggle={(id) => p.onCategory(id as MedicationCategory)}
      />
      <TextInput
        style={styles.input}
        accessibilityLabel={t('more.medName')}
        placeholder={t('more.medName')}
        value={p.name}
        onChangeText={p.onName}
      />
      <TextInput
        style={styles.input}
        accessibilityLabel={t('more.medDose')}
        placeholder={t('more.medDose')}
        value={p.dose}
        onChangeText={p.onDose}
      />
    </>
  );
}
