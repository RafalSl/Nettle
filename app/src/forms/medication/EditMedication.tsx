import type { MedicationCategory } from '@/core/model/types';
import { editMedication } from '@/core/usecases/entries';
import { t } from '@/i18n';
import { MedicationFields } from '@/forms/medication/MedicationFields';
import { useServices } from '@/services';
import { FormModal, useField, useForm } from '@/ui/FormModal';
import { EditCommonFields, useEditCommon } from '@/forms/editCommon';
import type { EditProps } from '@/forms/editProps';

/** EN-1, IN-5: edit a medication or supplement entry. */
export function EditMedication({ r }: EditProps<'medicationEntries'>) {
  const { deps } = useServices();
  const f = useForm();
  const c = useEditCommon(r.note, f.touch);
  const [category, setCategory] = useField<MedicationCategory>(r.category, f.touch);
  const [name, setName] = useField(r.name, f.touch);
  const [dose, setDose] = useField(r.dose ?? '', f.touch);
  return (
    <FormModal
      dirty={f.dirty}
      missing={name.trim() ? null : t('edit.name')}
      onSave={async () => void (await editMedication(deps, r.id, { category, name, dose, note: c.note, at: c.atForSave }))}
    >
      <MedicationFields category={category} onCategory={setCategory} name={name} onName={setName} dose={dose} onDose={setDose} />
      <EditCommonFields c={c} original={r.at.utc} />
    </FormModal>
  );
}
