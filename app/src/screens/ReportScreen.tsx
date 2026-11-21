import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { addDays, localDateTime, localDay } from '@/core/model/time';
import type { Photo, ReportSummary } from '@/core/model/types';
import { markExported, presetOptions, reportPhotos, reportPreview, sinceLastExport, type ReportPreview } from '@/core/usecases/backup';
import { exportBundle } from '@/core/usecases/exchange';
import { areaLabel, areaLabelIn, currentLanguage, errorMessage, itemLabelIn, t, tIn } from '@/i18n';
import { useServices } from '@/services';
import { DayRangePickers, pickedDay } from '@/ui/DayRangePickers';
import { ReportSummaryPanel } from '@/ui/ReportSummaryPanel';
import { Chips, Hint, Label, Screen } from '@/ui/components';
import { FloatingAction } from '@/ui/FloatingSave';
import { PhotoGrid } from '@/ui/PhotoGrid';
import { SwitchRow } from '@/ui/SwitchRow';

type Period = 'since' | 'last30' | 'last90' | 'all' | 'custom';

/**
 * EX-14, UX-1: the Doctor report preset. A period (default: since the last export), the counts, sensitive photos
 * off by default (EX-7), a report language that defaults to the app language (EX-3), then the share sheet.
 * With nothing in the period the button is disabled and the screen says why.
 */
export default function ReportScreen() {
  const { deps, fileShare } = useServices();
  const [available, setAvailable] = useState<Period[]>(['last30', 'last90', 'all', 'custom']);
  const [from, setFrom] = useState(() => new Date(Date.now() - 29 * 86_400_000));
  const [to, setTo] = useState(() => new Date());
  const [period, setPeriod] = useState<Period>('last30');
  const [language, setLanguage] = useState<'en' | 'pl'>(currentLanguage());
  const [sensitive, setSensitive] = useState(false);
  // EX-4, EX-7: photos picked one by one (off: all non-sensitive photos of the period, or all with the switch above).
  const [oneByOne, setOneByOne] = useState(false);
  const [periodPhotos, setPeriodPhotos] = useState<{ photo: Photo; areaId: string | null }[]>([]);
  const [pickedPhotos, setPickedPhotos] = useState<Set<string>>(new Set());
  const [areas, setAreas] = useState<Map<string, string>>(new Map());
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  // LL-14: the reviewed AI summary to open the PDF with; it belongs to one period and language (the panel is keyed by both).
  const [summary, setSummary] = useState<ReportSummary | null>(null);

  const today = localDay(deps.clock.now().toISOString(), deps.clock.timeZone(), deps.dayStart.get());
  const daysFor = async (p: Period): Promise<{ from?: string; to?: string }> => {
    if (p === 'since') return (await sinceLastExport(deps)) ?? {};
    if (p === 'last30') return { from: addDays(today, -29) ?? today, to: today };
    if (p === 'last90') return { from: addDays(today, -89) ?? today, to: today };
    if (p === 'custom') return { from: pickedDay(from, deps.clock.timeZone()), to: pickedDay(to, deps.clock.timeZone()) };
    return {};
  };

  useEffect(() => {
    (async () => {
      if (await sinceLastExport(deps)) {
        setAvailable(['since', 'last30', 'last90', 'all', 'custom']);
        setPeriod('since'); // the default once there has been an export
      }
    })().catch(() => undefined);
  }, [deps]);

  useEffect(() => {
    // A custom range with the first day after the last is shown as a hint by the pickers, not as an error alert.
    if (period === 'custom' && pickedDay(from, deps.clock.timeZone()) > pickedDay(to, deps.clock.timeZone())) return;
    (async () => {
      const days = await daysFor(period);
      setPreview(await reportPreview(deps, days));
      setPeriodPhotos(await reportPhotos(deps, days));
      setAreas(new Map((await deps.repo.listAreas()).map((a) => [a.id, areaLabel(a)])));
    })().catch((e) => Alert.alert(errorMessage(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps, period, from, to]);

  async function create() {
    try {
      const options = presetOptions({
        kind: 'doctor',
        days: await daysFor(period),
        photos: oneByOne ? { mode: 'custom', ids: [...pickedPhotos] } : { mode: sensitive ? 'all' : 'non_sensitive' },
        ...(summary ? { summaryId: summary.id } : {}),
        report: {
          language,
          text: (key, vars) => tIn(language, key, vars),
          areaName: (a) => areaLabelIn(language, a),
          itemName: (i) => itemLabelIn(language, i),
        },
      });
      const bytes = await exportBundle(deps, options);
      await fileShare.saveAndShare(`nettle-report-${deps.clock.now().toISOString().slice(0, 10)}.zip`, bytes, 'application/zip');
      await markExported(deps);
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }

  const empty = preview !== null && preview.entries === 0;
  const pickable = periodPhotos.map(({ photo, areaId }) => ({ id: photo.id, file: photo.file, sensitive: photo.sensitive, label: `${areaId ? (areas.get(areaId) ?? '') : ''} ${localDateTime(photo.at.utc, photo.at.tz)}`.trim() }));
  return (
    <Screen floating={<FloatingAction title={t('doctor.button')} icon="report" disabled={preview === null || empty} onPress={create} />}>
      <Hint>{t('doctor.hint')}</Hint>
      <Label>{t('doctor.range')}</Label>
      <Chips items={available.map((p) => ({ id: p, label: t(`doctor.${p}`) }))} selected={new Set([period])} onToggle={(id) => setPeriod(id as Period)} />
      {period === 'custom' && <DayRangePickers from={from} to={to} onFrom={setFrom} onTo={setTo} />}
      {preview && !empty && <Hint>{t('doctor.counts', { entries: preview.entries, photos: preview.photos })}</Hint>}
      {empty && <Hint>{t('doctor.empty')}</Hint>}
      {preview && preview.sensitivePhotos > 0 && !oneByOne && <SwitchRow title={t('doctor.sensitive', { n: preview.sensitivePhotos })} hint={t('doctor.sensitiveHint')} value={sensitive} onChange={setSensitive} />}
      {preview && preview.photos > 0 && <SwitchRow title={t('doctor.pickPhotos')} hint={oneByOne ? t('doctor.pickPhotosHint') : undefined} value={oneByOne} onChange={setOneByOne} />}
      {oneByOne && (
        <PhotoGrid
          items={pickable}
          selected={pickedPhotos}
          onToggle={(id) => setPickedPhotos((cur) => (cur.has(id) ? new Set([...cur].filter((x) => x !== id)) : new Set(cur).add(id)))}
          onAll={() => setPickedPhotos(new Set(pickable.filter((p) => !p.sensitive).map((p) => p.id)))}
          onNone={() => setPickedPhotos(new Set())}
        />
      )}
      <Label>{t('doctor.language')}</Label>
      <Chips
        items={[
          { id: 'en', label: t('export.english') },
          { id: 'pl', label: t('export.polish') },
        ]}
        selected={new Set([language])}
        onToggle={(id) => setLanguage(id as 'en' | 'pl')}
      />
      {!empty && preview !== null && (
        <ReportSummaryPanel key={`${period}|${period === 'custom' ? `${pickedDay(from, deps.clock.timeZone())}|${pickedDay(to, deps.clock.timeZone())}` : ''}|${language}`} days={() => daysFor(period)} language={language} onChange={setSummary} />
      )}
    </Screen>
  );
}
