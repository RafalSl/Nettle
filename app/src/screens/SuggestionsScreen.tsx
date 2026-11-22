import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import type { Drink, Meal } from '@/core/model/types';
import { listSuggestions, type Suggestion } from '@/core/usecases/aiPack';
import { t } from '@/i18n';
import { useServices } from '@/services';
import { NavRow } from '@/ui/NavRow';
import { Hint, Screen } from '@/ui/components';
import { showError } from '@/ui/showError';

type Row = Suggestion & { entry: Meal | Drink };
const text = (s: Row) => ('description' in s.entry ? s.entry.description : s.entry.name);

/**
 * IN-20: the fills that came back from a pack and wait to be looked at. A row opens the entry's edit screen with the
 * suggestion in the same panel as a photo estimate. Nothing here changes an entry.
 */
export default function SuggestionsScreen() {
  const { deps } = useServices();
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  useFocusEffect(
    useCallback(() => {
      listSuggestions(deps).then(setRows, (e) => showError(e));
    }, [deps]),
  );
  return (
    <Screen>
      <Hint>{t('aiSuggestions.intro')}</Hint>
      {rows !== null && rows.length === 0 && <Hint>{t('aiSuggestions.none')}</Hint>}
      {rows?.map((s) => (
        <NavRow
          key={s.id}
          title={text(s)}
          subtitle={t('aiSuggestions.row', { n: s.ingredients.length, model: s.model })}
          onPress={() =>
            router.push({
              pathname: '/form/edit',
              params: { kind: s.kind === 'meal' ? 'meals' : 'drinks', id: s.entryId, suggestion: s.id },
            })
          }
        />
      ))}
    </Screen>
  );
}
