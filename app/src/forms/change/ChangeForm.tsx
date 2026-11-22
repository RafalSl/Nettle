import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { type ChangeAction, type ListItem } from '@/core/model/types';
import { itemsInUse, logChangeEvent, type InUseItem } from '@/core/usecases/events';
import { listActiveItems } from '@/core/usecases/lists';
import { itemDescription, itemLabel, t } from '@/i18n';
import { useServices } from '@/services';
import { FormModal, useField, useForm } from '@/ui/FormModal';
import { useFormTime } from '@/forms/useFormTime';
import { Hint, Label, TimeField } from '@/ui/components';
import { RadioRow } from '@/ui/RadioRow';
import { showError } from '@/ui/showError';
import { ChangeFields } from '@/forms/change/ChangeFields';

/**
 * IN-12: a routine change: a product or diet started or stopped, on a date. "Stopped" offers what is in use now;
 * "Started" can say "already using, date unknown" for things begun before the diary.
 */
export default function ChangeForm() {
  const { deps } = useServices();
  const f = useForm();
  const [action, setAction] = useField<ChangeAction>('started', f.touch);
  const [categories, setCategories] = useState<ListItem[]>([]);
  const [category, setCategory] = useField<string>('cat-product', f.touch);
  const [name, setName] = useField('', f.touch);
  const [unknown, setUnknown] = useField(false, f.touch);
  const [inUse, setInUse] = useState<InUseItem[]>([]);
  const time = useFormTime(f.touch);
  useFocusEffect(
    useCallback(() => {
      (async () => {
        setCategories(await listActiveItems(deps, 'changeCategories'));
        setInUse(await itemsInUse(deps));
      })().catch((e) => showError(e));
    }, [deps]),
  );
  const selected = categories.find((c) => c.id === category);
  const description = selected ? itemDescription(selected) : null;
  const known = unknown && action === 'started';
  return (
    <FormModal
      dirty={f.dirty}
      missing={name.trim() ? null : t('edit.name')}
      onSave={async () => {
        await logChangeEvent(deps, { action, category, name, ...(known ? { dateUnknown: true } : { at: time.atForSave }) });
      }}
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
      >
        {description ? <Hint>{description}</Hint> : null}
        {action === 'stopped' && (
          <>
            <Label>{t('change.inUse')}</Label>
            {inUse.length === 0 ? (
              <Hint>{t('change.inUseNone')}</Hint>
            ) : (
              <View style={{ gap: 8 }}>
                {inUse.map((i) => (
                  <RadioRow
                    key={`${i.category}|${i.name}`}
                    icon="change"
                    title={i.name}
                    detail={
                      categories.find((c) => c.id === i.category) ? itemLabel(categories.find((c) => c.id === i.category)!) : undefined
                    }
                    selected={i.name === name && i.category === category}
                    onPress={() => {
                      setName(i.name);
                      setCategory(i.category);
                    }}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ChangeFields>
      {!known && <TimeField value={time.value} onChange={time.set} />}
      {known && <Hint>{t('change.dateUnknownHint')}</Hint>}
    </FormModal>
  );
}
