import { useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { pickPhotoUris } from '@/adapters/photos/pickPhotos';
import { NettleError } from '@/core/model/errors';
import type { LlmProvenance, SourceKind } from '@/core/model/source';
import type { Allergen } from '@/core/model/types';
import {
  estimateIngredients,
  estimateIngredientsFromName,
  getModelLabel,
  knownIngredientNames,
  nameEstimateText,
  scanLabel,
} from '@/core/usecases/llm';
import { currentLanguage, errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { formatElapsed } from '@/core/usecases/analysisRunner';
import { Button, Chips, Hint } from '@/ui/components';
import { GlassSurface } from '@/ui/GlassSurface';
import { Text } from '@/ui/themed';
import { color } from '@/ui/theme';
import { WaitArc } from '@/ui/WaitArc';
import { showError } from '@/ui/showError';

/** LL-12: after this long the form says the call is still working. */
export const SLOW_ESTIMATE_MS = 30_000;

/** IN-3 (meal photo), IN-15 (label scan) and IN-19 (name estimate): each produces a list of ingredient names to review. */
export type RunKind = 'photo' | 'label' | 'name';
export const SOURCE_OF: Record<RunKind, SourceKind> = { photo: 'photo_estimate', label: 'label_scan', name: 'name_estimate' };

/** What a run was started with, kept for the one-tap retry: a temporary photo, or the text of a name estimate. */
type Job =
  | { kind: 'photo' | 'label'; uri: string; knownNames: readonly string[] }
  | { kind: 'name'; description: string; knownNames: readonly string[] };

export type Run =
  | { status: 'idle' }
  | { status: 'running'; slow: boolean; kind: RunKind; startedAt: number }
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
 * LL-12, IN-3, IN-15, IN-19: one inline run of a photo or name to ingredients call. The form stays editable while it runs; after 30
 * seconds it says so and offers Cancel. Cancel, a failure, saving and leaving the form store nothing and abort the
 * request. The picked photo is a temporary file and is deleted when the run ends, is dismissed or the form closes.
 */
export function useIngredientRun() {
  const { deps } = useServices();
  const [run, setRun] = useState<Run>({ status: 'idle' });
  const ctl = useRef<AbortController | null>(null);
  const job = useRef<Job | null>(null);
  const slowTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /** Forgets the job; a photo job also deletes its temporary file. */
  const discard = () => {
    const j = job.current;
    job.current = null;
    if (j && j.kind !== 'name') deps.photos.discardTemp(j.uri).catch(() => undefined);
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

  async function execute(next: Job) {
    abort();
    const controller = new AbortController();
    ctl.current = controller;
    const prev = job.current;
    if (prev && prev.kind !== 'name' && !(next.kind !== 'name' && next.uri === prev.uri)) discard();
    job.current = next;
    const kind = next.kind;
    setRun({ status: 'running', slow: false, kind, startedAt: deps.clock.now().getTime() });
    slowTimer.current = setTimeout(() => setRun((r) => (r.status === 'running' ? { ...r, slow: true } : r)), SLOW_ESTIMATE_MS);
    try {
      const language = currentLanguage();
      let answer: Run;
      if (next.kind === 'name') {
        const r = await estimateIngredientsFromName(deps, {
          description: next.description,
          language,
          signal: controller.signal,
          knownNames: next.knownNames,
        });
        answer = {
          status: 'ready',
          kind,
          names: r.names,
          picked: new Set(),
          uncertainty: r.uncertainty,
          provenance: r.provenance,
          label: null,
        };
      } else {
        const data = await deps.photos.compress(next.uri, next.kind === 'label' ? 1600 : 1024);
        const input = { image: { mimeType: 'image/jpeg' as const, data }, language, signal: controller.signal };
        if (next.kind === 'label') {
          const r = await scanLabel(deps, input);
          const label = { textRead: r.textRead, allergens: r.allergens, traces: r.traces };
          answer = { status: 'ready', kind, names: r.ingredients, picked: new Set(), uncertainty: r.note, provenance: r.provenance, label };
        } else {
          const r = await estimateIngredients(deps, { ...input, knownNames: next.knownNames });
          answer = {
            status: 'ready',
            kind,
            names: r.names,
            picked: new Set(),
            uncertainty: r.uncertainty,
            provenance: r.provenance,
            label: null,
          };
        }
      }
      if (controller.signal.aborted) return;
      setRun(answer);
      discard(); // the answer is in memory; a photo is no longer needed
    } catch (e) {
      if (controller.signal.aborted || (e instanceof NettleError && e.code === 'llm_cancelled')) {
        // A run replaced by a newer one must not touch the newer run's photo or state.
        if (ctl.current !== controller) return;
        discard();
        return setRun({ status: 'idle' });
      }
      setRun({ status: 'failed', error: e }); // the job (photo or text) is kept for the one-tap retry
    } finally {
      if (ctl.current === controller) {
        clearTimeout(slowTimer.current);
        ctl.current = null;
      }
    }
  }

  /** LL-5: pick a photo, then confirm that it is sent before anything leaves the phone. */
  function start(kind: 'photo' | 'label') {
    const title = t(kind === 'label' ? 'meal.labelConfirmTitle' : 'meal.photoConfirmTitle');
    const send = async (source: 'camera' | 'library') => {
      try {
        const uri = (await pickPhotoUris(source))[0];
        if (!uri) return;
        // IN-3, LL-5: with "prefer my names" on, the confirmation says how many names go with the photo.
        const known = kind === 'photo' ? await knownIngredientNames(deps) : [];
        const model = await getModelLabel(deps, kind === 'label' ? 'label_scan' : 'meal_photo');
        const body = `${t(kind === 'label' ? 'meal.labelConfirmBody' : 'meal.photoConfirmBody')}${known.length > 0 ? `\n\n${t('meal.knownNamesSent', { n: known.length })}` : ''}\n\n${t('meal.confirmModel', { model })}`;
        Alert.alert(title, body, [
          { text: t('common.cancel'), style: 'cancel', onPress: () => void deps.photos.discardTemp(uri).catch(() => undefined) },
          { text: t('meal.photoSend'), onPress: () => void execute({ kind, uri, knownNames: known }) },
        ]);
      } catch (e) {
        showError(e);
      }
    };
    Alert.alert(t(kind === 'label' ? 'meal.fromLabel' : 'meal.fromPhoto'), undefined, [
      { text: t('photos.camera'), onPress: () => send('camera') },
      { text: t('photos.library'), onPress: () => send('library') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }

  /**
   * IN-19, LL-5: a name estimate sends the typed description as text only. The confirmation shows exactly that text
   * (and how many known names go with it), and the billing notice, before anything leaves the phone.
   */
  async function startName(description: string) {
    try {
      const text = nameEstimateText(description);
      const known = await knownIngredientNames(deps);
      const model = await getModelLabel(deps, 'meal_name');
      const body = `${t('meal.nameConfirmBody', { text })}${known.length > 0 ? `\n\n${t('meal.knownNamesSentName', { n: known.length })}` : ''}\n\n${t('meal.confirmModel', { model })}`;
      Alert.alert(t('meal.nameConfirmTitle'), body, [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('meal.nameSend'), onPress: () => void execute({ kind: 'name', description: text, knownNames: known }) },
      ]);
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }

  return {
    run,
    start,
    startName,
    cancel: () => {
      abort();
      discard();
      setRun({ status: 'idle' });
    },
    dismiss: () => {
      discard();
      setRun({ status: 'idle' });
    },
    retry: () => job.current && void execute(job.current),
    toggle: (id: string) =>
      setRun((r) => {
        if (r.status !== 'ready') return r;
        const picked = new Set(r.picked);
        if (!picked.delete(id)) picked.add(id);
        return { ...r, picked };
      }),
  };
}

/** LL-12: whole seconds since `startedAt`, ticking once a second while mounted. */
function useElapsed(startedAt: number): number {
  const { deps } = useServices();
  const [now, setNow] = useState(() => deps.clock.now().getTime());
  useEffect(() => {
    const timer = setInterval(() => setNow(deps.clock.now().getTime()), 1000);
    (timer as { unref?: () => void }).unref?.();
    return () => clearInterval(timer);
  }, [deps]);
  return Math.max(0, Math.floor((now - startedAt) / 1000));
}

/** LL-12, UX-12: waiting for an LLM call: the wait arc, what is being done, the elapsed time and a Cancel that is there from the start. */
function WaitCard({ run, onCancel }: { run: Extract<Run, { status: 'running' }>; onCancel: () => void }) {
  const seconds = useElapsed(run.startedAt);
  return (
    <GlassSurface style={{ borderRadius: 26, padding: 14, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <WaitArc />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '600' }}>
            {run.slow ? t('meal.estimateSlow') : t(run.kind === 'name' ? 'meal.estimatingName' : 'meal.estimating')}
          </Text>
          <Text style={{ fontSize: 13, color: color.muted }}>{formatElapsed(seconds)}</Text>
        </View>
      </View>
      <Button kind="secondary" title={t('meal.estimateCancel')} onPress={onCancel} />
    </GlassSurface>
  );
}

/**
 * The inline state of a run: waiting (with elapsed time and Cancel), the answer to add from (nothing is selected,
 * and Add selected stays disabled until an item is tapped, IN-3), or a failure that leaves the form as it was.
 */
export function IngredientRunPanel({
  hook,
  onAdd,
}: {
  hook: ReturnType<typeof useIngredientRun>;
  onAdd: (names: string[], run: Extract<Run, { status: 'ready' }>) => void;
}) {
  const { run } = hook;
  if (run.status === 'running') return <WaitCard run={run} onCancel={hook.cancel} />;
  if (run.status === 'ready') {
    return (
      <GlassSurface style={{ borderRadius: 26, padding: 14, gap: 10 }}>
        <Hint>
          {t(
            run.kind === 'label'
              ? 'meal.labelSuggested'
              : run.kind === 'name'
                ? run.names.length === 0
                  ? 'meal.nameEmpty'
                  : 'meal.nameSuggested'
                : 'meal.suggested',
          )}
        </Hint>
        {run.label && run.label.textRead !== '' && <Hint>{t('meal.labelRead', { text: run.label.textRead })}</Hint>}
        {run.uncertainty !== null && <Hint>{t(run.kind === 'label' ? 'meal.labelNote' : 'meal.unsure', { text: run.uncertainty })}</Hint>}
        <Chips items={run.names.map((n) => ({ id: n, label: n }))} selected={run.picked} onToggle={hook.toggle} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(run.kind !== 'name' || run.names.length > 0) && (
            <Button kind="outline" title={t('meal.estimateAddAll')} onPress={() => onAdd(run.names, run)} />
          )}
          {run.names.length > 0 && (
            <Button
              kind="secondary"
              title={t('meal.estimateAddPicked')}
              disabled={run.picked.size === 0}
              onPress={() => onAdd([...run.picked], run)}
            />
          )}
          <Button kind="secondary" title={t('meal.estimateDismiss')} onPress={hook.dismiss} />
        </View>
      </GlassSurface>
    );
  }
  if (run.status === 'failed') {
    return (
      <GlassSurface style={{ borderRadius: 26, padding: 14, gap: 10, borderColor: color.alertLine, backgroundColor: color.alertSoft }}>
        <Text style={{ fontSize: 14.5, color: color.alert, fontWeight: '600' }}>{errorMessage(run.error)}</Text>
        <Hint>{`${t('meal.estimateFailed')} ${t('meal.estimateUntouched')}`}</Hint>
        <Button title={t('meal.estimateRetry')} onPress={hook.retry} />
        <Button kind="secondary" title={t('meal.estimateDismiss')} onPress={hook.dismiss} />
      </GlassSurface>
    );
  }
  return null;
}
