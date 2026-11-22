import { useState } from 'react';
import type { SkinArea } from '@/core/model/types';
import { editSkinEntry } from '@/core/usecases/entries';
import { areaLabel, t } from '@/i18n';
import { parseSizeText, sizeToSave } from '@/forms/skin/SkinExtraFields';
import { SkinScoreFields } from '@/forms/skin/SkinScoreFields';
import { Chips, Label } from '@/ui/components';
import { PhotoStrip } from '@/ui/PhotoStrip';
import { one } from '@/ui/sets';
import { useServices } from '@/services';
import { FormModal, useField, useForm } from '@/ui/FormModal';
import { EditCommonFields, useEditCommon } from '@/forms/editCommon';
import type { EditProps } from '@/forms/editProps';

/** EN-1, SK-3: edit a skin entry: its area, scores, cracks, size, time, note and photos. */
export function EditSkin({ r, areas }: EditProps<'skinEntries'> & { areas: SkinArea[] }) {
  const { deps } = useServices();
  const f = useForm();
  const c = useEditCommon(r.note, f.touch);
  const [areaId, setAreaId] = useField(r.areaId, f.touch);
  const [scores, setScores] = useField({ ...r.scores }, f.touch);
  const [cracks, setCracks] = useField(r.cracks, f.touch);
  const [sizeText, setSizeText] = useField(r.sizeMm === null ? '' : String(r.sizeMm), f.touch);
  const [detailsOpen, setDetailsOpen] = useState(r.sizeMm !== null);
  return (
    <FormModal
      dirty={f.dirty}
      missing={parseSizeText(sizeText).ok ? null : t('skin.sizeMissing')}
      onSave={async () =>
        void (await editSkinEntry(deps, r.id, { areaId, scores, cracks, sizeMm: sizeToSave(sizeText), note: c.note, at: c.atForSave }))
      }
    >
      <Chips
        items={areas.filter((a) => a.kind === 'skin').map((a) => ({ id: a.id, label: areaLabel(a) }))}
        selected={one(areaId)}
        onToggle={setAreaId}
      />
      <Label>{t('edit.scores')}</Label>
      <SkinScoreFields
        scores={scores}
        onScores={setScores}
        cracks={cracks}
        onCracks={setCracks}
        sizeText={sizeText}
        onSizeText={setSizeText}
        detailsOpen={detailsOpen}
        onToggleDetails={() => setDetailsOpen((o) => !o)}
      />
      <EditCommonFields c={c} original={r.at.utc} />
      <Label>{t('edit.photos')}</Label>
      <PhotoStrip entryKind="skinEntry" entryId={r.id} />
    </FormModal>
  );
}
