import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import type { EntryType } from '@/core/model/preferences';
import { getPreferences, unpinnedEntryTypes } from '@/core/usecases/preferences';
import { errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { ENTRY_ROUTE, entrySubtitle, entryTitle } from '@/ui/entryTypes';
import { NavRow } from '@/ui/NavRow';
import { Hint, Screen } from '@/ui/components';

/** UX-2, UX-11: every entry type that is not pinned to Today, each with a one-line subtitle; each opens its modal form. */
export default function MoreScreen() {
  const router = useRouter();
  const { deps } = useServices();
  const [rows, setRows] = useState<EntryType[]>([]);
  useFocusEffect(
    useCallback(() => {
      getPreferences(deps).then((p) => setRows(unpinnedEntryTypes(p)), (e) => Alert.alert(errorMessage(e)));
    }, [deps]),
  );
  return (
    <Screen>
      {rows.length === 0 && <Hint>{t('home.moreEmpty')}</Hint>}
      {rows.map((id) => (
        <NavRow key={id} title={entryTitle(id)} subtitle={entrySubtitle(id)} onPress={() => router.push(ENTRY_ROUTE[id])} />
      ))}
      <NavRow title={t('nav.guide')} subtitle={t('guide.hint')} onPress={() => router.push('/guide')} />
    </Screen>
  );
}
