import { TREATMENT_REACTIONS, type ListItem, type SkinArea, type TreatmentReaction } from '@/core/model/types';
import { editTreatmentApplication } from '@/core/usecases/entries';
import { t } from '@/i18n';
import { TreatmentFields } from '@/forms/treatment/TreatmentFields';
import { Hint, Label, Segmented } from '@/ui/components';
import { useServices } from '@/services';
import { FormModal, useField, useForm } from '@/ui/FormModal';
import { EditCommonFields, useEditCommon } from '@/forms/editCommon';
import type { EditProps } from '@/forms/editProps';

/** EN-1, IN-11: edit a treatment application, including what the skin did afterwards. */
export function EditTreatment({
  r,
  areas,
  treatments,
}: EditProps<'treatmentApplications'> & { areas: SkinArea[]; treatments: ListItem[] }) {
  const { deps } = useServices();
  const f = useForm();
  const c = useEditCommon(r.note, f.touch);
  const [treatmentId, setTreatmentId] = useField(r.treatmentId, f.touch);
  const [areaIds, setAreaIds] = useField<Set<string>>(new Set(r.areaIds), f.touch);
  const [reaction, setReaction] = useField<TreatmentReaction | null>(r.reaction, f.touch);
  return (
    <FormModal
      dirty={f.dirty}
      missing={areaIds.size === 0 ? t('edit.areas') : null}
      onSave={async () =>
        void (await editTreatmentApplication(deps, r.id, { treatmentId, areaIds: [...areaIds], reaction, note: c.note, at: c.atForSave }))
      }
    >
      <TreatmentFields
        treatments={treatments}
        treatmentId={treatmentId}
        onTreatment={setTreatmentId}
        areas={areas}
        areaIds={areaIds}
        onAreaIds={setAreaIds}
      />
      {/* IN-11: what the skin did after applying; a tap on the chosen one clears it, because empty means not recorded. */}
      <Label>{t('treatmentReaction.title')}</Label>
      <Segmented
        items={TREATMENT_REACTIONS.map((x) => ({ id: x, label: t(`treatmentReaction.${x}`) }))}
        value={reaction ?? ''}
        onChange={(id) => setReaction(id === reaction ? null : (id as TreatmentReaction))}
      />
      <Hint>{t('treatmentReaction.hint')}</Hint>
      <EditCommonFields c={c} original={r.at.utc} />
    </FormModal>
  );
}
