import type { LocalDay, MedicalKind } from '@/core/model/types';
import { editMedicalEvent } from '@/core/usecases/entries';
import { t } from '@/i18n';
import { MedicalFields } from '@/forms/medical/MedicalFields';
import { useServices } from '@/services';
import { FormModal, useField, useForm } from '@/ui/FormModal';
import { EditCommonFields, useEditCommon } from '@/forms/editCommon';
import type { EditProps } from '@/forms/editProps';

/** EN-1, IN-18: edit a medical event (kind, title, end date of an illness, time, note). */
export function EditMedical({ r }: EditProps<'medicalEvents'>) {
  const { deps } = useServices();
  const f = useForm();
  const c = useEditCommon(r.note, f.touch);
  const [kind, setKind] = useField<MedicalKind>(r.kind, f.touch);
  const [title, setTitle] = useField(r.title, f.touch);
  const [endDay, setEndDay] = useField<LocalDay | null>(r.endDay, f.touch);
  return (
    <FormModal
      dirty={f.dirty}
      missing={title.trim() ? null : t('edit.titleMissing')}
      onSave={async () =>
        void (await editMedicalEvent(deps, r.id, { kind, title, ...(kind === 'illness' ? { endDay } : {}), note: c.note, at: c.atForSave }))
      }
    >
      <MedicalFields kind={kind} onKind={setKind} title={title} onTitle={setTitle} endDay={endDay} onEndDay={setEndDay} />
      <EditCommonFields c={c} original={r.at.utc} />
    </FormModal>
  );
}
