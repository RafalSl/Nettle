import type { NailExtent, NailStage, SkinArea } from '@/core/model/types';
import { editNailEntry } from '@/core/usecases/entries';
import { areaLabel, t } from '@/i18n';
import { NailFields } from '@/forms/nails/NailFields';
import { Chips, Label } from '@/ui/components';
import { PhotoStrip } from '@/ui/PhotoStrip';
import { one } from '@/ui/sets';
import { useServices } from '@/services';
import { FormModal, useField, useForm } from '@/ui/FormModal';
import { EditCommonFields, useEditCommon } from '@/forms/editCommon';
import type { EditProps } from '@/forms/editProps';

/** EN-1, SK-10: edit a nail entry: its nail, stage, extent, time, note and photos. */
export function EditNail({ r, areas }: EditProps<'nailEntries'> & { areas: SkinArea[] }) {
  const { deps } = useServices();
  const f = useForm();
  const c = useEditCommon(r.note, f.touch);
  const [areaId, setAreaId] = useField(r.areaId, f.touch);
  const [stage, setStage] = useField<NailStage>(r.stage, f.touch);
  const [extent, setExtent] = useField<NailExtent>(r.extent, f.touch);
  return (
    <FormModal
      dirty={f.dirty}
      missing={null}
      onSave={async () => void (await editNailEntry(deps, r.id, { areaId, stage, extent, note: c.note, at: c.atForSave }))}
    >
      <Chips
        items={areas.filter((a) => a.kind === 'nail').map((a) => ({ id: a.id, label: areaLabel(a) }))}
        selected={one(areaId)}
        onToggle={setAreaId}
      />
      <NailFields stage={stage} onStage={setStage} extent={extent} onExtent={setExtent} />
      <EditCommonFields c={c} original={r.at.utc} />
      <Label>{t('edit.photos')}</Label>
      <PhotoStrip entryKind="nailEntry" entryId={r.id} />
    </FormModal>
  );
}
