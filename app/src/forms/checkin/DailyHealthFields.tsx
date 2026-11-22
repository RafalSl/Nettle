import type { ListItem } from '@/core/model/types';
import { itemDescription, itemLabel } from '@/i18n';
import { Chips, Hint, ScoreInput } from '@/ui/components';

export type DailyValues = Record<string, number | boolean>;

/**
 * SK-7: the Daily health items as inputs, shared by the create form and the edit screen. Scores use the score
 * input (optional, so "not recorded" is possible); yes/no items are chips that record only a yes.
 */
export function DailyHealthFields({
  items,
  values,
  onChange,
}: {
  items: ListItem[];
  values: DailyValues;
  onChange: (next: DailyValues) => void;
}) {
  const set = (id: string, v: number | boolean | null) => {
    const next = { ...values };
    if (v === null || v === false) delete next[id];
    else next[id] = v;
    onChange(next);
  };
  const yesNo = items.filter((i) => i.valueKind === 'yesno');
  return (
    <>
      {items
        .filter((i) => i.valueKind === 'score')
        .map((i) => (
          <ScoreInput
            optional
            key={i.id}
            label={itemLabel(i)}
            hint={itemDescription(i)}
            value={typeof values[i.id] === 'number' ? (values[i.id] as number) : null}
            onChange={(v) => set(i.id, v)}
          />
        ))}
      {yesNo.length > 0 && (
        <Chips
          items={yesNo.map((i) => ({ id: i.id, label: itemLabel(i) }))}
          selected={new Set(yesNo.filter((i) => values[i.id] === true).map((i) => i.id))}
          onToggle={(id) => set(id, values[id] === true ? false : true)}
        />
      )}
      {yesNo.some((i) => itemDescription(i)) && (
        <Hint>
          {yesNo
            .filter((i) => values[i.id] === true)
            .map((i) => itemDescription(i))
            .filter(Boolean)
            .join(' ')}
        </Hint>
      )}
    </>
  );
}
