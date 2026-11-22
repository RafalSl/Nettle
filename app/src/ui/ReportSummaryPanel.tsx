import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { TextInput } from '@/ui/themed';
import { NettleError } from '@/core/model/errors';
import type { ReportSummary } from '@/core/model/types';
import { listSummaries, prepareSummary, runSummary, saveSummary, summaryDays, type SummaryDraft } from '@/core/usecases/summary';
import { errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { Button, Hint, Label, styles } from '@/ui/components';
import { showError } from '@/ui/showError';

type Phase =
  | { s: 'idle' }
  | { s: 'running'; startedAt: number }
  | { s: 'failed'; error: unknown }
  | { s: 'review'; draft: SummaryDraft; text: string }
  | { s: 'included'; summary: ReportSummary };

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/**
 * LL-14, LL-5, LL-12: the optional AI summary of the doctor report. Billing confirmation first, then a wait with
 * elapsed time and Cancel, then the text to review and edit. Only "Use in the report" stores it; Cancel, a failure,
 * Discard and leaving store nothing. The parent remounts it (a new `key`) when the period or the language changes,
 * which asks for a new summary.
 */
export function ReportSummaryPanel({
  days,
  language,
  onChange,
}: {
  days: () => Promise<{ from?: string; to?: string }>;
  language: 'en' | 'pl';
  /** The summary to put into the PDF, or null. */
  onChange: (summary: ReportSummary | null) => void;
}) {
  const { deps } = useServices();
  const [phase, setPhase] = useState<Phase>({ s: 'idle' });
  const [elapsed, setElapsed] = useState(0);
  const ctl = useRef<AbortController | null>(null);
  // LL-15: summaries imported from a chat on the user's own Claude plan, for this period and language.
  const [imported, setImported] = useState<ReportSummary[]>([]);
  useEffect(() => {
    (async () => {
      const range = await summaryDays(deps, await days());
      const all = await listSummaries(deps);
      setImported(
        range ? all.filter((s) => s.manual && s.dayFrom === range.dayFrom && s.dayTo === range.dayTo && s.language === language) : [],
      );
    })().catch(() => setImported([]));
  }, [deps, days, language]);

  useEffect(
    () => () => {
      ctl.current?.abort();
      void deactivateKeepAwake('summary').catch(() => undefined);
    },
    [],
  );
  useEffect(() => {
    if (phase.s !== 'running') return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - phase.startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [phase]);

  async function ask() {
    try {
      const range = await summaryDays(deps, await days());
      if (!range) return Alert.alert(errorMessage(new NettleError('analysis_no_data')));
      const prepared = await prepareSummary(deps, { ...range, language });
      // LL-5: exactly what will be sent.
      const lines = [
        t('analysis.confirmIntro'),
        '',
        t('analysis.range', {
          from: prepared.dayFrom,
          to: prepared.dayTo,
          days: prepared.counts.days ?? 0,
          complete: prepared.counts.completeDays ?? 0,
        }),
        ...(prepared.counts.lookbackDays ? [t('analysis.lookback', { n: prepared.counts.lookbackDays })] : []),
        t('doctor.summaryNoPhotos'),
        t('analysis.model', { model: prepared.model }),
        t('analysis.size', { n: prepared.sentCharacters }),
      ];
      Alert.alert(t('doctor.summaryConfirmTitle'), lines.join('\n'), [
        { text: t('doctor.summaryCancel'), style: 'cancel' },
        { text: t('doctor.summarySend'), onPress: () => void start(prepared) },
      ]);
    } catch (e) {
      showError(e);
    }
  }

  async function start(prepared: Awaited<ReturnType<typeof prepareSummary>>) {
    ctl.current?.abort();
    const controller = new AbortController();
    ctl.current = controller;
    setElapsed(0);
    setPhase({ s: 'running', startedAt: Date.now() });
    void activateKeepAwakeAsync('summary').catch(() => undefined);
    try {
      const draft = await runSummary(deps, prepared, controller.signal);
      if (controller.signal.aborted) return;
      setPhase({ s: 'review', draft, text: draft.text });
    } catch (e) {
      if (controller.signal.aborted || (e instanceof NettleError && e.code === 'llm_cancelled')) return setPhase({ s: 'idle' });
      setPhase({ s: 'failed', error: e });
    } finally {
      if (ctl.current === controller) ctl.current = null;
      void deactivateKeepAwake('summary').catch(() => undefined);
    }
  }

  async function keep(draft: SummaryDraft, text: string) {
    try {
      const summary = await saveSummary(deps, draft, text);
      setPhase({ s: 'included', summary });
      onChange(summary);
    } catch (e) {
      showError(e);
    }
  }

  if (phase.s === 'running') {
    return (
      <>
        <Hint>{t('doctor.summaryRunning', { time: clock(elapsed) })}</Hint>
        <Button
          kind="secondary"
          title={t('doctor.summaryCancel')}
          onPress={() => {
            ctl.current?.abort();
            setPhase({ s: 'idle' });
          }}
        />
      </>
    );
  }
  if (phase.s === 'review') {
    const { draft, text } = phase;
    return (
      <>
        <Hint>{t('doctor.summaryReview')}</Hint>
        <Label>{t('doctor.summaryField')}</Label>
        <TextInput
          style={[styles.input, { minHeight: 160, textAlignVertical: 'top' }]}
          accessibilityLabel={t('doctor.summaryField')}
          multiline
          value={text}
          onChangeText={(v) => setPhase({ s: 'review', draft, text: v })}
        />
        <Button title={t('doctor.summaryUse')} disabled={!text.trim()} onPress={() => void keep(draft, text)} />
        <Button kind="secondary" title={t('doctor.summaryDiscard')} onPress={() => setPhase({ s: 'idle' })} />
      </>
    );
  }
  if (phase.s === 'included') {
    return (
      <>
        <Hint>{t('doctor.summaryIncluded')}</Hint>
        <Hint>{phase.summary.text}</Hint>
        <Button
          kind="secondary"
          title={t('doctor.summaryRemove')}
          onPress={() => {
            onChange(null);
            setPhase({ s: 'idle' });
          }}
        />
      </>
    );
  }
  return (
    <>
      {phase.s === 'failed' && <Hint>{`${errorMessage(phase.error)} ${t('doctor.summaryFailed')}`}</Hint>}
      <Button kind="secondary" title={t('doctor.summaryButton')} onPress={() => void ask()} />
      <Hint>{t('doctor.summaryHint')}</Hint>
      {imported.map((s) => (
        <Button
          key={s.id}
          kind="secondary"
          title={t('plan.useImported', { model: s.model })}
          onPress={() => {
            setPhase({ s: 'included', summary: s });
            onChange(s);
          }}
        />
      ))}
    </>
  );
}
