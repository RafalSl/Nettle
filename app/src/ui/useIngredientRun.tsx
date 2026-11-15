import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { pickPhotoUris } from '@/adapters/photos/pickPhotos';
import { NettleError } from '@/core/model/errors';
import type { LlmProvenance, SourceKind } from '@/core/model/source';
import type { Allergen } from '@/core/model/types';
import { estimateIngredients, knownIngredientNames, scanLabel } from '@/core/usecases/llm';
import { currentLanguage, errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { Button, Chips, Hint } from '@/ui/components';

/** LL-12: after this long the form says the call is still working. */
export const SLOW_ESTIMATE_MS = 30_000;

/** IN-3 (meal photo) and IN-15 (label scan): both read a photo into a list of ingredient names. */
export type RunKind = 'photo' | 'label';
export const SOURCE_OF: Record<RunKind, SourceKind> = { photo: 'photo_estimate', label: 'label_scan' };

export type Run =
  | { status: 'idle' }
  | { status: 'running'; slow: boolean }
  | {
      status: 'ready';
      kind: RunKind;
      names: string[];
      picked: Set<string>;
      /** The model's own caveat: unsure parts (photo) or unreadable parts (label). */
      uncertainty: string | null;
      provenance: LlmProvenance;
      /** Label scan only: the text as printed, and the allergen tags it only suggests (IN-10). */
      label: { textRead: string; allergens: Allergen[]; traces: Allergen[] } | null;
    }
  | { status: 'failed'; error: unknown };

/**
 * LL-12, IN-3, IN-15: one inline run of a photo to ingredients call. The form stays editable while it runs; after 30
 * seconds it says so and offers Cancel. Cancel, a failure, saving and leaving the form store nothing and abort the
 * request. The picked photo is a temporary file and is deleted when the run ends, is dismissed or the form closes.
 */
export function useIngredientRun() {
  const { deps } = useServices();
  const [run, setRun] = useState<Run>({ status: 'idle' });
  const ctl = useRef<AbortController | null>(null);
  const photo = useRef<{ uri: string; kind: RunKind; knownNames: readonly string[] } | null>(null);
  const slowTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const discard = () => {
    const p = photo.current;
    photo.current = null;
    if (p) deps.photos.discardTemp(p.uri).catch(() => undefined);
  };
  const abort = () => {
    ctl.current?.abort();
    clearTimeout(slowTimer.current);
  };
  // Leaving the form aborts a running call and deletes the temporary photo.
  useEffect(
    () => () => {
      abort();
      discard();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  async function execute(uri: string, kind: RunKind, knownNames: readonly string[] = []) {
    abort();
    const controller = new AbortController();
    ctl.current = controller;
    if (photo.current && photo.current.uri !== uri) discard();
    photo.current = { uri, kind, knownNames };
    setRun({ status: 'running', slow: false });
    slowTimer.current = setTimeout(() => setRun((r) => (r.status === 'running' ? { status: 'running', slow: true } : r)), SLOW_ESTIMATE_MS);
    try {
      const data = await deps.photos.compress(uri, kind === 'label' ? 1600 : 1024);
      const input = { image: { mimeType: 'image/jpeg' as const, data }, language: currentLanguage(), signal: controller.signal };
      let next: Run;
      if (kind === 'label') {
        const r = await scanLabel(deps, input);
        const label = { textRead: r.textRead, allergens: r.allergens, traces: r.traces };
        next = { status: 'ready', kind, names: r.ingredients, picked: new Set(), uncertainty: r.note, provenance: r.provenance, label };
      } else {
        const r = await estimateIngredients(deps, { ...input, knownNames });
        next = { status: 'ready', kind, names: r.names, picked: new Set(), uncertainty: r.uncertainty, provenance: r.provenance, label: null };
      }
      if (controller.signal.aborted) return;
      setRun(next);
      discard(); // the answer is in memory; the photo is no longer needed
    } catch (e) {
      if (controller.signal.aborted || (e instanceof NettleError && e.code === 'llm_cancelled')) {
        // A run replaced by a newer one must not touch the newer run's photo or state.
        if (ctl.current !== controller) return;
        discard();
        return setRun({ status: 'idle' });
      }
      setRun({ status: 'failed', error: e }); // the photo is kept for the one-tap retry
    } finally {
      if (ctl.current === controller) {
        clearTimeout(slowTimer.current);
        ctl.current = null;
      }
    }
  }

  /** LL-5: pick a photo, then confirm that it is sent before anything leaves the phone. */
  function start(kind: RunKind) {
    const title = t(kind === 'label' ? 'meal.labelConfirmTitle' : 'meal.photoConfirmTitle');
    const send = async (source: 'camera' | 'library') => {
      try {
        const uri = (await pickPhotoUris(source))[0];
        if (!uri) return;
        // IN-3, LL-5: with "prefer my names" on, the confirmation says how many names go with the photo.
        const known = kind === 'photo' ? await knownIngredientNames(deps) : [];
        const body = `${t(kind === 'label' ? 'meal.labelConfirmBody' : 'meal.photoConfirmBody')}${known.length > 0 ? `\n\n${t('meal.knownNamesSent', { n: known.length })}` : ''}`;
        Alert.alert(title, body, [
          { text: t('common.cancel'), style: 'cancel', onPress: () => void deps.photos.discardTemp(uri).catch(() => undefined) },
          { text: t('meal.photoSend'), onPress: () => void execute(uri, kind, known) },
        ]);
      } catch (e) {
        Alert.alert(errorMessage(e));
      }
    };
    Alert.alert(t(kind === 'label' ? 'meal.fromLabel' : 'meal.fromPhoto'), undefined, [
      { text: t('photos.camera'), onPress: () => send('camera') },
      { text: t('photos.library'), onPress: () => send('library') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }

  return {
    run,
    start,
    cancel: () => {
      abort();
      discard();
      setRun({ status: 'idle' });
    },
    dismiss: () => {
      discard();
      setRun({ status: 'idle' });
    },
    retry: () => photo.current && void execute(photo.current.uri, photo.current.kind, photo.current.knownNames),
    toggle: (id: string) =>
      setRun((r) => {
        if (r.status !== 'ready') return r;
        const picked = new Set(r.picked);
        if (!picked.delete(id)) picked.add(id);
        return { ...r, picked };
      }),
  };
}

/** The inline state of a run: waiting, the answer to add from, or a failure with a retry. */
export function IngredientRunPanel({
  hook,
  onAdd,
}: {
  hook: ReturnType<typeof useIngredientRun>;
  onAdd: (names: string[], run: Extract<Run, { status: 'ready' }>) => void;
}) {
  const { run } = hook;
  if (run.status === 'running') {
    return (
      <>
        <Hint>{run.slow ? t('meal.estimateSlow') : t('meal.estimating')}</Hint>
        {run.slow && <Button kind="secondary" title={t('meal.estimateCancel')} onPress={hook.cancel} />}
      </>
    );
  }
  if (run.status === 'ready') {
    return (
      <>
        <Hint>{run.kind === 'label' ? t('meal.labelSuggested') : t('meal.suggested')}</Hint>
        {run.label && run.label.textRead !== '' && <Hint>{t('meal.labelRead', { text: run.label.textRead })}</Hint>}
        {run.uncertainty !== null && <Hint>{t(run.kind === 'label' ? 'meal.labelNote' : 'meal.unsure', { text: run.uncertainty })}</Hint>}
        <Chips items={run.names.map((n) => ({ id: n, label: n }))} selected={run.picked} onToggle={hook.toggle} />
        <Button title={t('meal.estimateAddAll')} onPress={() => onAdd(run.names, run)} />
        {run.picked.size > 0 && <Button kind="secondary" title={t('meal.estimateAddPicked')} onPress={() => onAdd([...run.picked], run)} />}
        <Button kind="secondary" title={t('meal.estimateDismiss')} onPress={hook.dismiss} />
      </>
    );
  }
  if (run.status === 'failed') {
    return (
      <>
        <Hint>{`${errorMessage(run.error)} ${t('meal.estimateFailed')}`}</Hint>
        <Button title={t('meal.estimateRetry')} onPress={hook.retry} />
        <Button kind="secondary" title={t('meal.estimateDismiss')} onPress={hook.dismiss} />
      </>
    );
  }
  return null;
}
