import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import type { RecordKind } from '@/core/model/types';
import { deleteEntry, previewEntryDelete } from '@/core/usecases/entries';
import { errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { chooseAction } from '@/ui/actionSheet';
import { rescheduleReminders } from '@/ui/rescheduleReminders';

/** What else goes with an entry, as one line (a meal's reactions, an entry's photos), or undefined. */
async function alsoLine(deps: Parameters<typeof previewEntryDelete>[0], kind: RecordKind, id: string): Promise<string | undefined> {
  const also = await previewEntryDelete(deps, kind, id);
  const list = Object.entries(also)
    .map(([k, n]) => `${n} ${t(`log.kinds.${k}`)}`)
    .join(', ');
  return list ? t('log.also', { list }) : undefined;
}

/**
 * UX-2, UX-9: delete one entry after a confirmation that names what goes with it. This is the path of the swipe on a
 * log row; the tap path is `useEntryActions`.
 */
export function useEntryDelete(onChanged: () => void) {
  const { deps } = useServices();
  return async function remove(kind: RecordKind, id: string, title: string) {
    try {
      const choice = await chooseAction({ title, message: await alsoLine(deps, kind, id), actions: [{ label: t('log.deleteAction'), destructive: true }] });
      if (choice === 0) {
        await deleteEntry(deps, kind, id);
        if (kind === 'checkIns') await rescheduleReminders(deps); // SK-9: a day without its record gets its reminder back
        onChanged();
      }
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  };
}

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
      const choice = await chooseAction({
        title,
        message: await alsoLine(deps, kind, id),
        actions: [{ label: t('log.editAction') }, { label: t('log.deleteAction'), destructive: true }],
      });
      if (choice === 0) router.push({ pathname: '/form/edit', params: { kind, id } });
      else if (choice === 1) {
        await deleteEntry(deps, kind, id);
        if (kind === 'checkIns') await rescheduleReminders(deps); // SK-9: a day without its record gets its reminder back
        onChanged();
      }
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  };
}
