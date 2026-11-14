import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { NettleError } from '@/core/model/errors';
import type { Allergen } from '@/core/model/types';
import { MAX_ALLERGEN_INGREDIENTS, suggestAllergensWithAi } from '@/core/usecases/llm';
import { currentLanguage, errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { Button, Hint } from '@/ui/components';

type State = { s: 'idle' } | { s: 'running' } | { s: 'failed'; error: unknown };

/**
 * IN-10, LL-5, LL-12: ask the model which allergens an ingredient list contains. The confirmation names the
 * ingredients that are sent (text only, no photo); the answer only suggests tags, which the form leaves unselected
 * until the user selects them. Cancel, a failure and leaving the form store nothing.
 */
export function useAllergenAi(onSuggested: (tags: Allergen[], note: string | null) => void) {
  const { deps } = useServices();
  const [state, setState] = useState<State>({ s: 'idle' });
  const ctl = useRef<AbortController | null>(null);
  useEffect(() => () => ctl.current?.abort(), []);

  async function run(ingredients: string[]) {
    ctl.current?.abort();
    const controller = new AbortController();
    ctl.current = controller;
    setState({ s: 'running' });
    try {
      const r = await suggestAllergensWithAi(deps, { ingredients, language: currentLanguage(), signal: controller.signal });
      if (controller.signal.aborted) return;
      setState({ s: 'idle' });
      onSuggested(r.allergens, r.note);
    } catch (e) {
      if (controller.signal.aborted || (e instanceof NettleError && e.code === 'llm_cancelled')) return setState({ s: 'idle' });
      setState({ s: 'failed', error: e });
    } finally {
      if (ctl.current === controller) ctl.current = null;
    }
  }

  function start(ingredients: string[]) {
    const names = [...new Set(ingredients.map((i) => i.trim()).filter(Boolean))].slice(0, MAX_ALLERGEN_INGREDIENTS);
    if (names.length === 0) return Alert.alert(errorMessage(new NettleError('no_ingredients')));
    Alert.alert(t('meal.aiAllergensConfirmTitle'), `${t('meal.aiAllergensConfirmBody')}\n\n${names.map((n) => `• ${n}`).join('\n')}`, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('meal.aiAllergensSend'), onPress: () => void run(names) },
    ]);
  }

  return {
    state,
    start,
    cancel: () => {
      ctl.current?.abort();
      setState({ s: 'idle' });
    },
    dismiss: () => setState({ s: 'idle' }),
    retry: (ingredients: string[]) => void run(ingredients),
  };
}

/** The button and the wait/failure lines of `useAllergenAi`. */
export function AllergenAiControls({ hook, ingredients }: { hook: ReturnType<typeof useAllergenAi>; ingredients: string[] }) {
  const { state } = hook;
  if (state.s === 'running') {
    return (
      <>
        <Hint>{t('meal.aiAllergensRunning')}</Hint>
        <Button kind="secondary" title={t('meal.estimateCancel')} onPress={hook.cancel} />
      </>
    );
  }
  return (
    <>
      {state.s === 'failed' && (
        <>
          <Hint>{`${errorMessage(state.error)} ${t('meal.aiAllergensFailed')}`}</Hint>
          <Button title={t('meal.estimateRetry')} onPress={() => hook.retry(ingredients)} />
        </>
      )}
      <Button kind="secondary" title={t('meal.aiAllergens')} onPress={() => hook.start(ingredients)} />
    </>
  );
}
