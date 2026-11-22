import { useState } from 'react';
import { View } from 'react-native';
import { TextInput } from '@/ui/themed';
import type { ListItem, ListKind } from '@/core/model/types';
import { addListItem, archiveListItem, renameListItem } from '@/core/usecases/lists';
import { itemDescription, itemLabel, t } from '@/i18n';
import { useServices } from '@/services';
import { Button, Chips, Heading, Hint, Label, styles } from '@/ui/components';
import { showError } from '@/ui/showError';
import { useFocusLoad } from '@/ui/useFocusLoad';

/** IN-6, IN-11: add, rename, archive and restore the items of a user-editable list. */
export function ListSection({ kind }: { kind: ListKind }) {
  const { deps } = useServices();
  const [items, setItems] = useState<ListItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const daily = kind === 'dailyItems';

  const reload = useFocusLoad(() => deps.repo.listItems(kind), [deps, kind], setItems);

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      setName('');
      setDescription('');
      reload();
    } catch (e) {
      showError(e);
    }
  };
  const active = items.filter((i) => !i.archived);
  const archived = items.filter((i) => i.archived);
  const selectedItem = items.find((i) => i.id === selected) ?? null;

  return (
    <>
      <Heading>{t(`lists.${kind}`)}</Heading>
      <Chips
        items={active.map((i) => ({ id: i.id, label: itemLabel(i) }))}
        selected={new Set(selected ? [selected] : [])}
        onToggle={setSelected}
      />
      {daily && <Hint>{t('settings.itemsHint')}</Hint>}
      {selectedItem && itemDescription(selectedItem) && <Hint>{itemDescription(selectedItem)}</Hint>}
      <TextInput style={styles.input} placeholder={t('more.listNew')} value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder={t('settings.itemDescription')} value={description} onChangeText={setDescription} />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {daily ? (
          <>
            <Button
              kind="secondary"
              title={t('settings.itemScore')}
              onPress={() => run(() => addListItem(deps, kind, name, { valueKind: 'score', description }))}
            />
            <Button
              kind="secondary"
              title={t('settings.itemYesNo')}
              onPress={() => run(() => addListItem(deps, kind, name, { valueKind: 'yesno', description }))}
            />
          </>
        ) : (
          <Button kind="secondary" title={t('common.add')} onPress={() => run(() => addListItem(deps, kind, name, { description }))} />
        )}
        {selected && (
          <>
            <Button kind="secondary" title={t('more.rename')} onPress={() => run(() => renameListItem(deps, kind, selected, name))} />
            <Button
              kind="secondary"
              title={t('more.archive')}
              onPress={() =>
                run(async () => {
                  await archiveListItem(deps, kind, selected);
                  setSelected(null);
                })
              }
            />
          </>
        )}
      </View>
      {archived.length > 0 && (
        <>
          <Label>{t('more.archivedList')}</Label>
          <Hint>{t('more.restore')}</Hint>
          <Chips
            items={archived.map((i) => ({ id: i.id, label: itemLabel(i) }))}
            selected={new Set()}
            onToggle={(id) => run(() => archiveListItem(deps, kind, id, false))}
          />
        </>
      )}
    </>
  );
}
