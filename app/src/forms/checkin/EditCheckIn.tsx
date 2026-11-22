import type { ListItem } from '@/core/model/types';
import { editCheckIn } from '@/core/usecases/entries';
import { DailyHealthFields, type DailyValues } from '@/forms/checkin/DailyHealthFields';
import { rescheduleReminders } from '@/ui/rescheduleReminders';
import { useServices } from '@/services';
import { FormModal, useField, useForm } from '@/ui/FormModal';
import { EditCommonFields, useEditCommon } from '@/forms/editCommon';
import type { EditProps } from '@/forms/editProps';

/** EN-1, SK-7: edit a Daily health record (values, time, note). */
export function EditCheckIn({ r, items }: EditProps<'checkIns'> & { items: ListItem[] }) {
  const { deps } = useServices();
  const f = useForm();
  const c = useEditCommon(r.note, f.touch);
  const [values, setValues] = useField<DailyValues>({ ...r.values }, f.touch);
  return (
    <FormModal
      dirty={f.dirty}
      missing={null}
      onSave={async () => {
        await editCheckIn(deps, r.id, { values, note: c.note, at: c.atForSave });
        await rescheduleReminders(deps); // SK-9: a record moved to another day changes which day is skipped
      }}
    >
      <DailyHealthFields items={items} values={values} onChange={setValues} />
      <EditCommonFields c={c} original={r.at.utc} />
    </FormModal>
  );
}
