import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import type { RecordKind } from '@/core/model/types';
import { deleteEntry, previewEntryDelete } from '@/core/usecases/entries';
import { errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { chooseAction } from '@/ui/actionSheet';

/**
 * EN-1, UX-9: the one action sheet for a single entry, shared by the day's log and the area timeline. Its title names
 * the entry, a line names what goes with it (a meal's reactions, an entry's photos), then Edit and Delete
 * (destructive); Cancel is last. Edit opens the edit form; a delete calls `onChanged` so the screen reloads.
 */
export function useEntryActions(onChanged: () => void) {
  const { deps } = useServices();
  const router = useRouter();
  return async function openEntry(kind: RecordKind, id: string, title: string) {
    try {
      const also = await previewEntryDelete(deps, kind, id);
      const list = Object.entries(also)
        .map(([k, n]) => `${n} ${t(`log.kinds.${k}`)}`)
        .join(', ');
      const choice = await chooseAction({
        title,
        message: list ? t('log.also', { list }) : undefined,
        actions: [{ label: t('log.editAction') }, { label: t('log.deleteAction'), destructive: true }],
      });
      if (choice === 0) router.push({ pathname: '/form/edit', params: { kind, id } });
      else if (choice === 1) {
        await deleteEntry(deps, kind, id);
        onChanged();
      }
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  };
}
