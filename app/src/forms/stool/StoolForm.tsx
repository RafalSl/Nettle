import { TextInput } from '@/ui/themed';
import { logStool } from '@/core/usecases/checkin';
import { t } from '@/i18n';
import { useServices } from '@/services';
import { FormModal, useField, useForm } from '@/ui/FormModal';
import { useFormTime } from '@/forms/useFormTime';
import { Hint, TimeField, styles } from '@/ui/components';
import { BristolChips } from '@/forms/stool/StoolFields';

/** SK-7: the full stool form behind "Earlier…" on the quick sheet: Bristol type 1 to 7, a time and a note. */
export default function StoolForm() {
  const { deps } = useServices();
  const f = useForm();
  const [type, setType] = useField<string | null>(null, f.touch);
  const [note, setNote] = useField('', f.touch);
  const time = useFormTime(f.touch);
  return (
    <FormModal
      dirty={f.dirty}
      missing={type ? null : t('edit.type')}
      onSave={async () => void (await logStool(deps, { bristol: Number(type), note, at: time.atForSave }))}
    >
      <Hint>{t('today.stoolHint')}</Hint>
      <BristolChips value={type} onChange={setType} />
      <TimeField value={time.value} onChange={time.set} />
      <TextInput
        style={styles.input}
        accessibilityLabel={t('common.note')}
        placeholder={t('common.note')}
        value={note}
        onChangeText={setNote}
      />
    </FormModal>
  );
}
