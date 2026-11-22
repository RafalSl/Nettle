import { Chips } from '@/ui/components';
import { one } from '@/ui/sets';

/** SK-7: the Bristol type 1 to 7 as chips; shared by the new-entry form and the edit form. */
export function BristolChips({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  return (
    <Chips items={[1, 2, 3, 4, 5, 6, 7].map((n) => ({ id: String(n), label: String(n) }))} selected={one(value)} onToggle={onChange} />
  );
}
