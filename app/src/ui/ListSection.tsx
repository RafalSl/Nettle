import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, TextInput, View } from 'react-native';
import type { ListItem, ListKind } from '@/core/model/types';
import { addListItem, archiveListItem, renameListItem } from '@/core/usecases/lists';
import { errorMessage, itemLabel, t } from '@/i18n';
import { useServices } from '@/services';
import { Button, Chips, Heading, Hint, Label, styles } from '@/ui/components';

/** IN-6, IN-11: add, rename, archive and restore the items of a user-editable list. */
export function ListSection({ kind }: { kind: ListKind }) {
  const { deps } = useServices();
  const [items, setItems] = useState<ListItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState('');

  const reload = useCallback(() => {
    deps.repo.listItems(kind).then(setItems);
  }, [deps, kind]);
  useFocusEffect(reload);

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      setName('');
      reload();
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  };
  const active = items.filter((i) => !i.archived);
  const archived = items.filter((i) => i.archived);

  return (
    <>
      <Heading>{t(`lists.${kind}`)}</Heading>
      <Chips items={active.map((i) => ({ id: i.id, label: itemLabel(i) }))} selected={new Set(selected ? [selected] : [])} onToggle={setSelected} />
      <TextInput style={styles.input} placeholder={t('more.listNew')} value={name} onChangeText={setName} />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Button kind="secondary" title={t('common.add')} onPress={() => run(() => addListItem(deps, kind, name))} />
        {selected && (
          <>
            <Button kind="secondary" title={t('more.rename')} onPress={() => run(() => renameListItem(deps, kind, selected, name))} />
            <Button
              kind="secondary"
              title={t('more.archive')}
              onPress={() => run(async () => {
                await archiveListItem(deps, kind, selected);
                setSelected(null);
              })}
            />
          </>
        )}
      </View>
      {archived.length > 0 && (
        <>
          <Label>{t('more.archivedList')}</Label>
          <Hint>{t('more.restore')}</Hint>
          <Chips items={archived.map((i) => ({ id: i.id, label: itemLabel(i) }))} selected={new Set()} onToggle={(id) => run(() => archiveListItem(deps, kind, id, false))} />
        </>
      )}
    </>
  );
}
