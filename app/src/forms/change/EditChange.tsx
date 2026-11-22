import type { ChangeAction, ListItem } from '@/core/model/types';
import { editChangeEvent } from '@/core/usecases/entries';
import { t } from '@/i18n';
import { ChangeFields } from '@/forms/change/ChangeFields';
import { useServices } from '@/services';
import { FormModal, useField, useForm } from '@/ui/FormModal';
import { EditCommonFields, useEditCommon } from '@/forms/editCommon';
import type { EditProps } from '@/forms/editProps';

/** EN-1, IN-12: edit a routine change. */
export function EditChange({ r, categories }: EditProps<'changeEvents'> & { categories: ListItem[] }) {
  const { deps } = useServices();
  const f = useForm();
  const c = useEditCommon(r.note, f.touch);
  const [action, setAction] = useField<ChangeAction>(r.action, f.touch);
  const [category, setCategory] = useField<string>(r.category, f.touch);
  const [name, setName] = useField(r.name, f.touch);
  const [unknown, setUnknown] = useField(r.dateUnknown, f.touch);
  return (
    <FormModal
      dirty={f.dirty}
      missing={name.trim() ? null : t('edit.name')}
      onSave={async () =>
        void (await editChangeEvent(deps, r.id, {
          action,
          category,
          name,
          dateUnknown: unknown && action === 'started',
          note: c.note,
          at: c.atForSave,
        }))
      }
    >
      <ChangeFields
        action={action}
        onAction={setAction}
        categories={categories}
        category={category}
        onCategory={setCategory}
        name={name}
        onName={setName}
        dateUnknown={unknown}
        onDateUnknown={setUnknown}
      />
      <EditCommonFields c={c} original={r.at.utc} />
    </FormModal>
  );
}
