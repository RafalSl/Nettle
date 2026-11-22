import type { Symptom } from '@/core/model/types';
import { editReaction } from '@/core/usecases/entries';
import { t } from '@/i18n';
import { SymptomChips } from '@/forms/reaction/SymptomChips';
import { Hint } from '@/ui/components';
import { useServices } from '@/services';
import { FormModal, useField, useForm } from '@/ui/FormModal';
import { EditCommonFields, useEditCommon } from '@/forms/editCommon';
import type { EditProps } from '@/forms/editProps';

/** EN-1, IN-13: edit a reaction's symptoms, onset and note; the urgent-care advice stays visible. */
export function EditReaction({ r }: EditProps<'reactions'>) {
  const { deps } = useServices();
  const f = useForm();
  const c = useEditCommon(r.note, f.touch);
  const [symptoms, setSymptoms] = useField<Set<Symptom>>(new Set(r.symptoms), f.touch);
  return (
    <FormModal
      dirty={f.dirty}
      missing={symptoms.size === 0 ? t('edit.symptoms') : null}
      onSave={async () =>
        void (await editReaction(deps, r.id, { mealId: r.mealId, symptoms: [...symptoms], note: c.note, at: c.atForSave }))
      }
    >
      <Hint>{t('more.reactionUrgent')}</Hint>
      <SymptomChips selected={symptoms} onChange={setSymptoms} />
      <EditCommonFields c={c} original={r.at.utc} />
    </FormModal>
  );
}
