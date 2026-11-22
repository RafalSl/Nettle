import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import type { Allergen } from '@/core/model/types';
import { dismissSuggestion, getSuggestion, type Suggestion } from '@/core/usecases/aiPack';
import { errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { Button, Chips, Hint } from '@/ui/components';

/**
 * IN-20: a fill that came back from a pack, in the same editable panel as a photo estimate (IN-3). Add all of it or
 * pick names; they become ordinary rows of the entry's list. Allergen tags stay unselected until the person selects
 * them (IN-10). Nothing changes on the entry until it is saved; Dismiss removes the suggestion and keeps the mark.
 */
export function SuggestionPanel({
  suggestionId,
  onAdd,
  onSelectTags,
  onDismissed,
}: {
  suggestionId: string;
  onAdd: (names: string[]) => void;
  onSelectTags: (tags: Allergen[]) => void;
  onDismissed: () => void;
}) {
  const { deps } = useServices();
  const [s, setS] = useState<Suggestion | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState(false);
  const [tagsDone, setTagsDone] = useState(false);
  useEffect(() => {
    getSuggestion(deps, suggestionId).then(setS, (e) => Alert.alert(errorMessage(e)));
  }, [deps, suggestionId]);
  if (!s) return null;
  const add = (names: string[]) => {
    onAdd(names);
    setAdded(true);
  };
  return (
    <>
      <Hint>{t('fillLater.panelIntro', { model: s.model })}</Hint>
      {s.note ? <Hint>{t('meal.unsure', { text: s.note })}</Hint> : null}
      {!added && (
        <>
          {s.ingredients.length === 0 ? (
            <Hint>{t('fillLater.panelEmpty')}</Hint>
          ) : (
            <>
              <Chips
                items={s.ingredients.map((n) => ({ id: n, label: n }))}
                selected={picked}
                onToggle={(id) =>
                  setPicked((cur) => {
                    const next = new Set(cur);
                    if (!next.delete(id)) next.add(id);
                    return next;
                  })
                }
              />
              <Button title={t('meal.estimateAddAll')} onPress={() => add(s.ingredients)} />
              {picked.size > 0 && <Button kind="secondary" title={t('meal.estimateAddPicked')} onPress={() => add([...picked])} />}
            </>
          )}
        </>
      )}
      {s.allergens.length > 0 && !tagsDone && (
        <>
          <Hint>{t('fillLater.panelTags', { list: s.allergens.map((a) => t(`allergens.${a}`)).join(', ') })}</Hint>
          <Button
            kind="secondary"
            title={t('meal.scanSelectTags')}
            onPress={() => {
              onSelectTags(s.allergens);
              setTagsDone(true);
            }}
          />
        </>
      )}
      <Button
        kind="secondary"
        title={t('fillLater.dismiss')}
        onPress={() => {
          dismissSuggestion(deps, suggestionId).then(
            () => {
              setS(null);
              onDismissed();
            },
            (e) => Alert.alert(errorMessage(e)),
          );
        }}
      />
    </>
  );
}
