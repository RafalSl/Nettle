import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { defaultPreferences, type Preferences } from '@/core/model/preferences';
import { type Suggestion } from '@/core/model/suggestions';
import { getPreferences } from '@/core/usecases/preferences';
import { useServices } from '@/services';
import { showError } from '@/ui/showError';

export const rowText = (s: Suggestion<unknown>) => `${s.favorite ? '★ ' : ''}${s.label}${s.count >= 2 ? ` ×${s.count}` : ''}`;

/** IN-14, UX-5: suggestions of an intake form. A tap fills the form, or with "save on tap" saves at once and closes. */
export function useSuggestions<P>(load: (deps: ReturnType<typeof useServices>['deps'], p: Preferences) => Promise<Suggestion<P>[]>) {
  const { deps } = useServices();
  const [prefs, setPrefs] = useState<Preferences>(defaultPreferences());
  const [list, setList] = useState<Suggestion<P>[]>([]);
  const refresh = useCallback(() => {
    (async () => {
      const p = await getPreferences(deps);
      setPrefs(p);
      setList(await load(deps, p));
    })().catch((e) => showError(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps]);
  useFocusEffect(refresh);
  return { list, saveOnTap: prefs.suggestions.saveOnTap, prefs, refresh };
}
