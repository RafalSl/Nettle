import { editStool } from '@/core/usecases/entries';
import { BristolChips } from '@/forms/stool/StoolFields';
import { useServices } from '@/services';
import { FormModal, useField, useForm } from '@/ui/FormModal';
import { EditCommonFields, useEditCommon } from '@/forms/editCommon';
import type { EditProps } from '@/forms/editProps';

/** EN-1, SK-7: edit a stool entry (Bristol type, time, note). */
export function EditStool({ r }: EditProps<'stoolEntries'>) {
  const { deps } = useServices();
  const f = useForm();
  const c = useEditCommon(r.note, f.touch);
  const [type, setType] = useField(String(r.bristol), f.touch);
  return (
    <FormModal
      dirty={f.dirty}
      missing={null}
      onSave={async () => void (await editStool(deps, r.id, { bristol: Number(type), note: c.note, at: c.atForSave }))}
    >
      <BristolChips value={type} onChange={setType} />
      <EditCommonFields c={c} original={r.at.utc} />
    </FormModal>
  );
}
