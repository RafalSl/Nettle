import { ALLERGENS } from '@/core/model/types';
import { t } from '@/i18n';
import { Chips } from '@/ui/components';
import { toggled } from '@/ui/sets';

/** IN-10: the 14 allergen tags as chips; a tap adds or removes one. */
export function AllergenChips<T extends string>({ selected, onChange }: { selected: ReadonlySet<T>; onChange: (next: Set<T>) => void }) {
  return (
    <Chips
      items={ALLERGENS.map((a) => ({ id: a, label: t(`allergens.${a}`) }))}
      selected={selected}
      onToggle={(id) => onChange(toggled(selected, id as T))}
    />
  );
}
