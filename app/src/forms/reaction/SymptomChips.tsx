import { SYMPTOMS, type Symptom } from '@/core/model/types';
import { t } from '@/i18n';
import { Chips } from '@/ui/components';
import { toggled } from '@/ui/sets';

/** IN-13: the symptoms of a reaction; shared by the new-entry form and the edit form. */
export function SymptomChips({ selected, onChange }: { selected: ReadonlySet<Symptom>; onChange: (next: Set<Symptom>) => void }) {
  return (
    <Chips
      items={SYMPTOMS.map((s) => ({ id: s, label: t(`symptoms.${s}`) }))}
      selected={selected}
      onToggle={(id) => onChange(toggled(selected, id as Symptom))}
    />
  );
}
