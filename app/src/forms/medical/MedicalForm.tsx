import { TextInput } from '@/ui/themed';
import { type LocalDay, type MedicalKind } from '@/core/model/types';
import { logMedicalEvent } from '@/core/usecases/events';
import { t } from '@/i18n';
import { useServices } from '@/services';
import { FormModal, useField, useForm } from '@/ui/FormModal';
import { useFormTime } from '@/forms/useFormTime';
import { Label, TimeField, styles } from '@/ui/components';
import { MedicalFields } from '@/forms/medical/MedicalFields';

/** IN-18: log a visit, test result, diagnosis, illness or other medical event. Nothing leaves the phone. */
export default function MedicalForm() {
  const { deps } = useServices();
  const f = useForm();
  const [kind, setKind] = useField<MedicalKind>('visit', f.touch);
  const [title, setTitle] = useField('', f.touch);
  const [endDay, setEndDay] = useField<LocalDay | null>(null, f.touch);
  const [note, setNote] = useField('', f.touch);
  const time = useFormTime(f.touch);
  return (
    <FormModal
      dirty={f.dirty}
      missing={title.trim() ? null : t('edit.titleMissing')}
      onSave={async () =>
        void (await logMedicalEvent(deps, { kind, title, ...(kind === 'illness' ? { endDay } : {}), note, at: time.atForSave }))
      }
    >
      <MedicalFields kind={kind} onKind={setKind} title={title} onTitle={setTitle} endDay={endDay} onEndDay={setEndDay} />
      <TimeField value={time.value} onChange={time.set} />
      <Label>{t('common.note')}</Label>
      <TextInput style={styles.input} accessibilityLabel={t('common.note')} value={note} onChangeText={setNote} />
    </FormModal>
  );
}
