import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { NettleError } from '@/core/model/errors';
import { localDateTime, localDay } from '@/core/model/time';
import { RECORD_KINDS, type Analysis, type Photo } from '@/core/model/types';
import type { Deps } from '@/core/usecases/deps';
import { listAnalyses, prepareAnalysis } from '@/core/usecases/analysis';
import { areaLabel, currentLanguage, errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { AnalysisView } from '@/ui/AnalysisView';
import { NavRow } from '@/ui/NavRow';
import { useAnalysisRun } from '@/ui/useAnalysisRun';
import { Button, Chips, Heading, Hint, Label, Screen, styles } from '@/ui/components';

/** Earlier analyses, and the photos taken in the chosen days with a label for each. */
async function loadScreenData(deps: Deps, dayFrom: string, dayTo: string) {
  const areas = new Map((await deps.repo.listAreas()).map((a) => [a.id, a]));
  const entryArea = new Map(
    [...(await deps.repo.listSkinEntries()), ...(await deps.repo.listRecords('nailEntries'))].map((e) => [e.id, e.areaId]),
  );
  const photos = (await deps.repo.listRecords('photos'))
    .filter((p) => localDay(p.at.utc, p.at.tz, deps.dayStart.get()) >= dayFrom && localDay(p.at.utc, p.at.tz, deps.dayStart.get()) <= dayTo)
    .map((photo) => {
      const area = areas.get(entryArea.get(photo.entryId) ?? '');
      return { photo, label: `${area ? areaLabel(area) : ''} ${localDateTime(photo.at.utc, photo.at.tz)}`.trim() };
    });
  return { past: await listAnalyses(deps), photos };
}

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 3600 * 1000);

/** LL-2 to LL-8: choose a date range and photos, review exactly what will be sent, then run and read the result. */
/** m:ss */
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

export default function AnalysisScreen() {
  const { deps } = useServices();
  const router = useRouter();
  const tz = deps.clock.timeZone();
  const [from, setFrom] = useState(() => daysAgo(14));
  const [to, setTo] = useState(() => new Date());
  const [photos, setPhotos] = useState<{ photo: Photo; label: string }[]>([]);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const { analysisRunner: runner } = useServices();
  const run = useAnalysisRun();
  const [elapsed, setElapsed] = useState(0);
  const [past, setPast] = useState<Analysis[]>([]);
  const [shown, setShown] = useState<Analysis | null>(null);

  const dayFrom = localDay(from.toISOString(), tz);
  const dayTo = localDay(to.toISOString(), tz);

  const reload = useCallback(() => {
    loadScreenData(deps, dayFrom, dayTo)
      .then((data) => {
        setPast(data.past);
        setPhotos(data.photos);
      })
      .catch((e) => Alert.alert(errorMessage(e)));
  }, [deps, dayFrom, dayTo, setPast, setPhotos]);
  useFocusEffect(reload);

  const toggle = (id: string) =>
    setChosen((cur) => {
      const next = new Set(cur);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  // LL-12: elapsed time while the request runs. The run itself lives in the runner, so it goes on when this screen is left.
  const startedAt = run.status === 'running' ? run.startedAt : null;
  useEffect(() => {
    if (startedAt === null) return;
    const tick = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  // A finished run shows its result here; the stored list refreshes, and leaving the screen clears the Review card.
  const finished = run.status === 'ready' ? run.analysis : null;
  useEffect(() => {
    if (finished) reload();
  }, [finished, reload]);
  useFocusEffect(useCallback(() => () => runner.dismiss(), [runner]));
  const shownNow = finished ?? shown;

  async function review() {
    try {
      const inRange = new Set(photos.map((p) => p.photo.id));
      const prepared = await prepareAnalysis(deps, {
        dayFrom,
        dayTo,
        language: currentLanguage(),
        photoIds: [...chosen].filter((id) => inRange.has(id)),
      });
      // LL-5: exactly what will be sent.
      const lines = [
        t('analysis.confirmIntro'),
        '',
        t('analysis.range', { from: prepared.dayFrom, to: prepared.dayTo, days: prepared.counts.days ?? 0, complete: prepared.counts.completeDays ?? 0 }),
        ...RECORD_KINDS.filter((k) => (prepared.counts[k] ?? 0) > 0).map((k) => `• ${t(`delete.line.${k}`, { n: prepared.counts[k] ?? 0 })}`),
        ...(prepared.counts.lookbackDays ? [t('analysis.lookback', { n: prepared.counts.lookbackDays })] : []),
        ...prepared.photos.map((p) => `• ${t(p.sensitive ? 'analysis.photoLineSensitive' : 'analysis.photoLine', { label: p.label })}`),
        t('analysis.model', { model: prepared.model }),
        t('analysis.size', { n: prepared.sentCharacters }),
      ];
      Alert.alert(t('analysis.confirmTitle'), lines.join('\n'), [
        { text: t('analysis.cancel'), style: 'cancel' },
        { text: t('analysis.send'), onPress: () => runner.start(prepared) },
      ]);
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }

  return (
    <Screen>
      <Heading>{t('analysis.title')}</Heading>
      <Hint>{t('analysis.disclaimer')}</Hint>
      <NavRow title={t('plan.link')} subtitle={t('plan.linkHint')} onPress={() => router.push('/review/pack')} />
      <View style={styles.timeRow}>
        <Label>{t('analysis.from')}</Label>
        <DateTimePicker mode="date" value={from} onValueChange={(_e, d) => setFrom(d)} />
      </View>
      <View style={styles.timeRow}>
        <Label>{t('analysis.to')}</Label>
        <DateTimePicker mode="date" value={to} onValueChange={(_e, d) => setTo(d)} />
      </View>

      <Label>{t('analysis.photos')}</Label>
      <Hint>{t('analysis.photosHint')}</Hint>
      {photos.length === 0 ? (
        <Hint>{t('analysis.photosNone')}</Hint>
      ) : (
        <Chips
          items={photos.map(({ photo, label }) => ({ id: photo.id, label: photo.sensitive ? `${label} (${t('analysis.sensitiveMark')})` : label }))}
          selected={chosen}
          onToggle={toggle}
        />
      )}

      {run.status === 'running' ? (
        <>
          <ActivityIndicator />
          <Hint>{t('analysis.running')}</Hint>
          <Hint>{t('analysis.elapsed', { time: clock(elapsed) })}</Hint>
          <Button title={t('analysis.cancelRun')} kind="secondary" onPress={() => runner.cancel()} />
        </>
      ) : (
        <>
          {run.status === 'interrupted' && <Hint>{t('analysis.interrupted')}</Hint>}
          {run.status === 'failed' && <Hint>{`${errorMessage(run.error)} ${t('analysis.failedNote')}`}</Hint>}
          {run.status === 'cancelled' && <Hint>{errorMessage(new NettleError('llm_cancelled'))}</Hint>}
          {(run.status === 'interrupted' || run.status === 'failed') && <Button title={t('analysis.retry')} onPress={() => void runner.retry()} />}
          <Button title={t('analysis.review')} onPress={review} />
        </>
      )}

      {shownNow && <AnalysisView analysis={shownNow} />}

      <Heading>{t('analysis.past')}</Heading>
      {past.length === 0 && <Hint>{t('analysis.none')}</Hint>}
      {past.map((a) => (
        <View key={a.id} style={styles.row}>
          <Hint>{`${localDateTime(a.at.utc, a.at.tz)} · ${a.dayFrom} → ${a.dayTo}`}</Hint>
          <Button kind="secondary" title={t('analysis.view')} onPress={() => setShown(a)} />
        </View>
      ))}
    </Screen>
  );
}
