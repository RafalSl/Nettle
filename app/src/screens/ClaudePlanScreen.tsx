import { useState } from 'react';
import { Alert } from 'react-native';
import { localDateTime, localDay } from '@/core/model/time';
import { RECORD_KINDS, type Photo } from '@/core/model/types';
import {
  buildPack,
  importResult,
  markedEntries,
  preparePack,
  previewResult,
  type MarkedEntry,
  type ResultPreview,
} from '@/core/usecases/aiPack';
import { areaLabel, currentLanguage, t } from '@/i18n';
import { useServices } from '@/services';
import { DayRangePickers, pickedDay } from '@/ui/DayRangePickers';
import { Button, Heading, Hint, Label, Screen } from '@/ui/components';
import { FloatingAction } from '@/ui/FloatingSave';
import { PhotoGrid } from '@/ui/PhotoGrid';
import { showError } from '@/ui/showError';
import { toggled } from '@/ui/sets';
import { useFocusLoad } from '@/ui/useFocusLoad';

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 3600 * 1000);

/**
 * LL-15, IN-20: use the user's own Claude plan instead of the paid API. "Prepare a pack" writes one ZIP through the
 * share sheet, and "Import a result" reads the `result.json` that came back. The app sends nothing itself and bills
 * nothing; the ZIP leaves the phone only by the person's own act.
 */
export default function ClaudePlanScreen() {
  const { deps, fileShare } = useServices();
  const tz = deps.clock.timeZone();
  const [from, setFrom] = useState(() => daysAgo(14));
  const [to, setTo] = useState(() => new Date());
  const [photos, setPhotos] = useState<{ photo: Photo; label: string }[]>([]);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [marked, setMarked] = useState<MarkedEntry[]>([]);
  const dayFrom = pickedDay(from, tz);
  const dayTo = pickedDay(to, tz);

  useFocusLoad(
    async () => {
      const areas = new Map((await deps.repo.listAreas()).map((a) => [a.id, a]));
      const entryArea = new Map(
        [...(await deps.repo.listRecords('skinEntries')), ...(await deps.repo.listRecords('nailEntries'))].map((e) => [e.id, e.areaId]),
      );
      const inRange = (p: { at: { utc: string; tz: string } }) => {
        const d = localDay(p.at.utc, p.at.tz, deps.dayStart.get());
        return d >= dayFrom && d <= dayTo;
      };
      const photos = (await deps.repo.listRecords('photos')).filter(inRange).map((photo) => {
        const area = areas.get(entryArea.get(photo.entryId) ?? '');
        return { photo, label: `${area ? areaLabel(area) : ''} ${localDateTime(photo.at.utc, photo.at.tz)}`.trim() };
      });
      return { photos, marked: await markedEntries(deps) };
    },
    [deps, dayFrom, dayTo],
    (r) => {
      setPhotos(r.photos);
      setMarked(r.marked);
    },
  );

  const toggle = (id: string) => setChosen((cur) => toggled(cur, id));

  /** LL-5-style confirmation: exactly what the pack holds and the three things the person must know. */
  async function prepare() {
    try {
      const inRange = new Set(photos.map((p) => p.photo.id));
      const sel = { dayFrom, dayTo, language: currentLanguage(), photoIds: [...chosen].filter((id) => inRange.has(id)) };
      const prepared = await preparePack(deps, sel);
      const lines = [
        t('plan.confirmIntro'),
        '',
        t('analysis.range', {
          from: prepared.dayFrom,
          to: prepared.dayTo,
          days: prepared.counts.days ?? 0,
          complete: prepared.counts.completeDays ?? 0,
        }),
        ...RECORD_KINDS.filter((k) => (prepared.counts[k] ?? 0) > 0).map(
          (k) => `• ${t(`delete.line.${k}`, { n: prepared.counts[k] ?? 0 })}`,
        ),
        ...(prepared.counts.lookbackDays ? [t('analysis.lookback', { n: prepared.counts.lookbackDays })] : []),
        ...prepared.marked.map((m) => `• ${t('plan.markedLine', { text: m.text })}`),
        ...prepared.photos.map((p) => `• ${t(p.sensitive ? 'analysis.photoLineSensitive' : 'analysis.photoLine', { label: p.label })}`),
        '',
        t('plan.noteLeaves'),
        t('plan.noteTerms'),
        t('plan.noteBilling'),
      ];
      Alert.alert(t('plan.confirmTitle'), lines.join('\n'), [
        { text: t('analysis.cancel'), style: 'cancel' },
        {
          text: t('plan.prepare'),
          onPress: () => {
            (async () => {
              const pack = await buildPack(deps, sel);
              await fileShare.saveAndShare(pack.fileName, pack.bytes, 'application/zip');
            })().catch((e) => showError(e));
          },
        },
      ]);
    } catch (e) {
      showError(e);
    }
  }

  const previewLines = (p: ResultPreview) => [
    t('plan.previewModel', { model: p.model }),
    t('plan.previewRange', { from: p.dayFrom, to: p.dayTo }),
    ...(p.hasAnalysis ? [`• ${t('plan.previewAnalysis')}`] : []),
    ...(p.hasSummary ? [`• ${t('plan.previewSummary')}`] : []),
    ...(p.fillsAccepted + p.fillsSkipped > 0 ? [`• ${t('plan.previewFills', { n: p.fillsAccepted, skipped: p.fillsSkipped })}`] : []),
    '',
    t('plan.previewNoChange'),
  ];

  /** LL-15: pick `result.json`, show what it would do, and import only after a confirmation. Importing twice does nothing. */
  async function importFile() {
    try {
      const bytes = await fileShare.pickFile('json');
      if (!bytes) return;
      const p = await previewResult(deps, bytes);
      if (p.alreadyImported) return Alert.alert(t('plan.alreadyTitle'), t('plan.alreadyBody', { id: p.packId }));
      Alert.alert(t('plan.previewTitle'), previewLines(p).join('\n'), [
        { text: t('analysis.cancel'), style: 'cancel' },
        {
          text: t('plan.import'),
          onPress: () => {
            importResult(deps, bytes).then(
              () => Alert.alert(t('plan.importedTitle'), t('plan.importedBody')),
              (e) => showError(e),
            );
          },
        },
      ]);
    } catch (e) {
      showError(e);
    }
  }

  return (
    <Screen floating={<FloatingAction title={t('plan.prepare')} icon="box" onPress={() => void prepare()} />}>
      <Heading>{t('plan.title')}</Heading>
      <Hint>{t('plan.intro')}</Hint>
      <Hint>{t('analysis.disclaimer')}</Hint>

      <Heading>{t('plan.prepareTitle')}</Heading>
      <DayRangePickers from={from} to={to} onFrom={setFrom} onTo={setTo} />
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
      <Hint>{t('plan.markedCount', { n: marked.length })}</Hint>
      <Hint>{t('plan.prepareHint')}</Hint>

      <Heading>{t('plan.importTitle')}</Heading>
      <Hint>{t('plan.importHint')}</Hint>
      <Button kind="secondary" title={t('plan.import')} onPress={() => void importFile()} />
    </Screen>
  );
}
