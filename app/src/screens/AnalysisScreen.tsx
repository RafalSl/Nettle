import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { NettleError } from '@/core/model/errors';
import { localDateTime, localDay } from '@/core/model/time';
import { RECORD_KINDS, type Analysis, type Photo } from '@/core/model/types';
import type { Deps } from '@/core/usecases/deps';
import type { PreparedAnalysis } from '@/core/usecases/analysis';
import { listAnalyses, prepareAnalysis } from '@/core/usecases/analysis';
import { areaLabel, currentLanguage, errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { AnalysisView } from '@/ui/AnalysisView';
import { NavRow } from '@/ui/NavRow';
import { useAnalysisRun } from '@/ui/useAnalysisRun';
import { Button, Heading, Hint, Label, Screen, styles } from '@/ui/components';
import { FloatingAction } from '@/ui/FloatingSave';
import { GlassSurface } from '@/ui/GlassSurface';
import { PhotoGrid } from '@/ui/PhotoGrid';
import { WaitArc } from '@/ui/WaitArc';
import { Text } from '@/ui/themed';
import { color } from '@/ui/theme';
import { formatElapsed } from '@/core/usecases/analysisRunner';
import { showError } from '@/ui/showError';
import { toggled } from '@/ui/sets';

/** Earlier analyses, and the photos taken in the chosen days with a label for each. */
async function loadScreenData(deps: Deps, dayFrom: string, dayTo: string) {
  const areas = new Map((await deps.repo.listAreas()).map((a) => [a.id, a]));
  const entryArea = new Map(
    [...(await deps.repo.listRecords('skinEntries')), ...(await deps.repo.listRecords('nailEntries'))].map((e) => [e.id, e.areaId]),
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
const clock = formatElapsed;

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
      .catch((e) => showError(e));
  }, [deps, dayFrom, dayTo, setPast, setPhotos]);
  useFocusEffect(reload);

  const toggle = (id: string) => setChosen((cur) => toggled(cur, id));

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

  /** LL-5: exactly what will be sent, then a confirmation; used for a new run and for "Review and try again". */
  function confirm(prepared: PreparedAnalysis, onSend: () => void) {
    const lines = [
      t('analysis.confirmIntro'),
      '',
      t('analysis.range', {
        from: prepared.dayFrom,
        to: prepared.dayTo,
        days: prepared.counts.days ?? 0,
        complete: prepared.counts.completeDays ?? 0,
      }),
      ...RECORD_KINDS.filter((k) => (prepared.counts[k] ?? 0) > 0).map((k) => `• ${t(`delete.line.${k}`, { n: prepared.counts[k] ?? 0 })}`),
      ...(prepared.counts.lookbackDays ? [t('analysis.lookback', { n: prepared.counts.lookbackDays })] : []),
      ...prepared.photos.map((p) => `• ${t(p.sensitive ? 'analysis.photoLineSensitive' : 'analysis.photoLine', { label: p.label })}`),
      t('analysis.model', { model: prepared.model }),
      t('analysis.size', { n: prepared.sentCharacters }),
    ];
    Alert.alert(t('analysis.confirmTitle'), lines.join('\n'), [
      { text: t('analysis.cancel'), style: 'cancel' },
      { text: t('analysis.send'), onPress: onSend },
    ]);
  }

  async function review() {
    try {
      const inRange = new Set(photos.map((p) => p.photo.id));
      const prepared = await prepareAnalysis(deps, {
        dayFrom,
        dayTo,
        language: currentLanguage(),
        photoIds: [...chosen].filter((id) => inRange.has(id)),
      });
      confirm(prepared, () => runner.start(prepared));
    } catch (e) {
      showError(e);
    }
  }

  return (
    <Screen
      floating={
        run.status === 'running' ? undefined : run.status === 'interrupted' || run.status === 'failed' ? (
          <FloatingAction title={t('analysis.retry')} icon="sparkle" onPress={() => confirm(run.prepared, () => void runner.retry())} />
        ) : (
          <FloatingAction title={t('analysis.review')} icon="sparkle" onPress={review} />
        )
      }
    >
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
        <PhotoGrid
          items={photos.map(({ photo, label }) => ({
            id: photo.id,
            file: photo.file,
            sensitive: photo.sensitive,
            label: photo.sensitive ? `${label} (${t('analysis.sensitiveMark')})` : label,
          }))}
          selected={chosen}
          onToggle={toggle}
          onAll={() => setChosen(new Set(photos.filter((p) => !p.photo.sensitive).map((p) => p.photo.id)))}
          onNone={() => setChosen(new Set())}
        />
      )}

      {run.status === 'running' ? (
        <GlassSurface style={{ borderRadius: 26, padding: 14, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <WaitArc />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '600' }}>{t('analysis.running')}</Text>
              <Text style={{ fontSize: 13, color: color.muted }}>{t('analysis.elapsed', { time: clock(elapsed) })}</Text>
            </View>
          </View>
          <Button title={t('analysis.cancelRun')} kind="secondary" onPress={() => runner.cancel()} />
        </GlassSurface>
      ) : (
        <>
          {run.status === 'interrupted' && <Hint>{t('analysis.interrupted')}</Hint>}
          {run.status === 'failed' && (
            <View
              style={{
                padding: 14,
                borderRadius: 22,
                gap: 2,
                backgroundColor: color.alertSoft,
                borderWidth: 1,
                borderColor: color.alertLine,
              }}
            >
              <Text style={{ color: color.alert, fontWeight: '700', fontSize: 14.5 }}>{errorMessage(run.error)}</Text>
              <Text style={{ color: color.soft, fontSize: 13.5 }}>{t('analysis.failedNote')}</Text>
            </View>
          )}
          {run.status === 'cancelled' && <Hint>{errorMessage(new NettleError('llm_cancelled'))}</Hint>}
          {(run.status === 'interrupted' || run.status === 'failed') && <Hint>{t('analysis.retryHint')}</Hint>}
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
