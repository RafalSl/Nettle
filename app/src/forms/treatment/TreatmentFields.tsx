import type { ListItem, SkinArea } from '@/core/model/types';
import { areaLabel, itemDescription, itemLabel, t } from '@/i18n';
import { Chips, Hint, Label } from '@/ui/components';
import { one, toggled } from '@/ui/sets';

/** IN-11: which treatment and on which areas; shared by the new-entry form and the edit form. */
export function TreatmentFields(p: {
  treatments: ListItem[];
  treatmentId: string | null;
  onTreatment: (id: string) => void;
  areas: SkinArea[];
  areaIds: ReadonlySet<string>;
  onAreaIds: (next: Set<string>) => void;
}) {
  const chosen = p.treatments.find((x) => x.id === p.treatmentId);
  return (
    <>
      <Chips items={p.treatments.map((i) => ({ id: i.id, label: itemLabel(i) }))} selected={one(p.treatmentId)} onToggle={p.onTreatment} />
      {chosen && itemDescription(chosen) ? <Hint>{itemDescription(chosen)}</Hint> : null}
      <Label>{t('more.treatmentAreas')}</Label>
      <Chips
        items={p.areas.map((a) => ({ id: a.id, label: areaLabel(a) }))}
        selected={p.areaIds}
        onToggle={(id) => p.onAreaIds(toggled(p.areaIds, id))}
      />
    </>
  );
}
