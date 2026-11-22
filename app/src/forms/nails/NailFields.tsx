import { NAIL_EXTENTS, NAIL_STAGES, type NailExtent, type NailStage } from '@/core/model/types';
import { t } from '@/i18n';
import { Chips, Label } from '@/ui/components';
import { one } from '@/ui/sets';

/** SK-10: a nail entry's stage and rough extent; shared by the new-entry form and the edit form. */
export function NailFields(p: {
  stage: NailStage | null;
  onStage: (s: NailStage) => void;
  extent: NailExtent | null;
  onExtent: (e: NailExtent) => void;
}) {
  return (
    <>
      <Label>{t('more.nailStage')}</Label>
      <Chips
        items={NAIL_STAGES.map((s) => ({ id: s, label: t(`nail.stages.${s}`) }))}
        selected={one(p.stage)}
        onToggle={(id) => p.onStage(id as NailStage)}
      />
      <Label>{t('more.nailExtent')}</Label>
      <Chips
        items={NAIL_EXTENTS.map((s) => ({ id: s, label: t(`nail.extents.${s}`) }))}
        selected={one(p.extent)}
        onToggle={(id) => p.onExtent(id as NailExtent)}
      />
    </>
  );
}
