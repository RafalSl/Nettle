import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, Pressable, type ScrollViewInstance, View } from 'react-native';
import { Text } from '@/ui/themed';
import { sinceCaption } from '@/core/model/derived';
import {
  areaTimeline,
  DEFAULT_TREND_RANGE,
  limitTrend,
  resolveJumpDay,
  trendPoints,
  type JumpTarget,
  type TimelineDay,
  type TimelineEntry,
  type TrendKey,
  type TrendRange,
} from '@/core/usecases/timeline';
import { SCORE_KEYS, type Photo, type SkinArea } from '@/core/model/types';
import { localDateTime, localDay } from '@/core/model/time';
import { areaLabel, errorMessage, itemLabel, t } from '@/i18n';
import { useServices } from '@/services';
import { useNow } from '@/ui/useNow';
import { PhotoCompare } from '@/ui/PhotoCompare';
import { PhotoThumbs } from '@/ui/PhotoThumbs';
import { TrendChart } from '@/ui/TrendChart';
import { Button, Chips, Heading, Hint, Screen, styles } from '@/ui/components';
import { describeRow, skinExtras } from '@/ui/logRow';
import { useEntryActions } from '@/ui/useEntryActions';
import { color } from '@/ui/theme';

/**
 * SK-8, EN-1: one area across dates: the scores or nail stage of each entry with its photos beside them, newest day
 * first. "Go to date" scrolls to a day (navigation, not a filter); a tap on an entry opens the day log's Edit and Delete sheet.
 */
export default function AreaTimelineScreen() {
  const { deps } = useServices();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [days, setDays] = useState<TimelineDay[] | null>(null);
  const [range, setRange] = useState<TrendRange>(DEFAULT_TREND_RANGE);
  const [name, setName] = useState('');
  const [areas, setAreas] = useState<SkinArea[]>([]);
  const [treatmentNames, setTreatmentNames] = useState<Record<string, string>>({});
  const [trend, setTrend] = useState<TrendKey>('severity');
  const [comparing, setComparing] = useState(false);
  const [picked, setPicked] = useState<Photo[]>([]);
  const [picking, setPicking] = useState(false);
  const now = useNow(deps);
  const [pickerMax, setPickerMax] = useState(() => deps.clock.now());
  const [jump, setJump] = useState<{ target: JumpTarget; picked: string } | null>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const dayY = useRef<Record<string, number>>({});
  const load = useCallback(() => {
    (async () => {
      const all = await deps.repo.listAreas();
      const area = all.find((a) => a.id === id);
      setAreas(all);
      setTreatmentNames(Object.fromEntries((await deps.repo.listItems('treatments')).map((x) => [x.id, itemLabel(x)])));
      setName(area ? areaLabel(area) : '');
      setDays(await areaTimeline(deps, id));
    })().catch((e) => Alert.alert(errorMessage(e)));
  }, [deps, id]);
  useFocusEffect(load);
  const openEntry = useEntryActions(load);

  /** SK-8: the picked calendar day leads to that day, or the nearest earlier one; the list and chart stay complete. */
  function jumpTo(picked: string) {
    setPicking(false);
    const target = resolveJumpDay(days ?? [], picked);
    setJump(target ? { target, picked } : null);
    const y = target ? dayY.current[target.day] : undefined;
    if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
  }
  const jumpNotice =
    jump && jump.target.how !== 'exact'
      ? t(jump.target.how === 'earlier' ? 'review.jumpEarlier' : 'review.jumpOldest', { picked: jump.picked, shown: jump.target.day })
      : null;

  const isNail = days?.some((d) => d.entries.some((e) => e.kind === 'nail')) ?? false;
  const hasSize = days?.some((d) => d.entries.some((e) => e.kind === 'skin' && e.entry.sizeMm !== null)) ?? false; // SK-3: the size is charted only where one is logged
  const keys: TrendKey[] = isNail ? ['extent'] : [...SCORE_KEYS, ...(hasSize ? (['size'] as const) : [])];
  const key = keys.includes(trend) ? trend : keys[0]!;
  const allPhotos = days?.flatMap((d) => d.entries.flatMap((e) => e.photos)) ?? [];
  /** What was logged with a photo, for the comparison captions. */
  const captionOf = (photo: Photo) => {
    for (const d of days ?? []) {
      for (const e of d.entries) {
        if (e.photos.some((p) => p.id === photo.id)) {
          return e.kind === 'skin'
            ? [...SCORE_KEYS.map((k) => `${t(`skin.scores.${k}`)} ${e.entry.scores[k]}`), ...skinExtras(e.entry)].join(', ')
            : `${t(`nail.stages.${e.entry.stage}`)}, ${t(`nail.extents.${e.entry.extent}`)}`;
        }
      }
    }
    return '';
  };
  /** The sheet's title, the same words as the day's log. */
  const entryTitle = (e: TimelineEntry) =>
    describeRow(
      e.kind === 'skin'
        ? { kind: 'skinEntries', id: e.entry.id, at: e.entry.at, record: e.entry }
        : { kind: 'nailEntries', id: e.entry.id, at: e.entry.at, record: e.entry },
      { areas, treatments: [], categories: [] },
    ).title;
  const pick = (photo: Photo) =>
    setPicked((cur) => (cur.some((p) => p.id === photo.id) ? cur.filter((p) => p.id !== photo.id) : [...cur, photo].slice(-2))); // a third pick replaces the oldest

  return (
    <Screen scrollRef={scrollRef}>
      <Heading>{name}</Heading>
      {days !== null && days.length > 0 && (
        <>
          <Button kind="secondary" title={t('review.goToDate')} onPress={() => (setPickerMax(deps.clock.now()), setPicking((p) => !p))} />
          {picking && (
            <DateTimePicker
              mode="date"
              display="inline"
              value={new Date(`${jump?.target.day ?? days[0]!.day}T12:00:00`)}
              maximumDate={pickerMax}
              onValueChange={(_e, d) => jumpTo(localDay(d.toISOString(), deps.clock.timeZone()))}
            />
          )}
          {jumpNotice && <Hint>{jumpNotice}</Hint>}
        </>
      )}
      {days !== null && days.length === 0 && <Hint>{t('review.timelineEmpty')}</Hint>}
      {days !== null && days.length > 0 && (
        <>
          <Heading>{t('review.trend')}</Heading>
          {!isNail && (
            <Chips
              items={keys.map((k) => ({ id: k, label: k === 'size' ? t('review.sizeChip') : t(`skin.scores.${k}`) }))}
              selected={new Set([key])}
              onToggle={(id) => setTrend(id as TrendKey)}
            />
          )}
          <TrendChart
            points={limitTrend(trendPoints(days, key), range, localDay(now.toISOString(), deps.clock.timeZone(), deps.dayStart.get()))}
            max={key === 'extent' ? 3 : key === 'size' ? Math.max(1, ...trendPoints(days, 'size').map((p) => p.value)) : 10}
            range={range}
            onRange={setRange}
            label={key === 'extent' ? t('review.extent') : key === 'size' ? t('review.sizeChip') : t(`skin.scores.${key}`)}
          />
        </>
      )}
      {allPhotos.length >= 2 && (
        <>
          <Button
            kind="secondary"
            title={comparing ? t('review.compareDone') : t('review.compare')}
            onPress={() => (setComparing((c) => !c), setPicked([]))}
          />
          {comparing && picked.length < 2 && <Hint>{t('review.comparePick')}</Hint>}
          {comparing && picked.length === 2 && <PhotoCompare photos={picked.map((photo) => ({ photo, caption: captionOf(photo) }))} />}
        </>
      )}
      {days?.map((d) => (
        <View key={d.day} style={{ gap: 6 }} onLayout={(e) => void (dayY.current[d.day] = e.nativeEvent.layout.y)}>
          <Text style={[styles.label, jump?.target.day === d.day && { backgroundColor: color.accentSoft, borderRadius: 6 }]}>{d.day}</Text>
          {d.medical.map((m) => (
            <Hint
              key={`${m.event.id}-${m.edge}`}
            >{`${t(m.edge === 'start' ? 'review.medicalStart' : 'review.medicalEnd', { kind: t(`medical.kinds.${m.event.kind}`), title: m.event.title })}`}</Hint>
          ))}
          {d.flares.map((f) => (
            <Hint
              key={f.id}
            >{`${localDateTime(f.at.utc, f.at.tz).slice(11)}  ${t(f.kind === 'start' ? 'review.flareStart' : 'review.flareEnd')}`}</Hint>
          ))}
          {d.entries.map((e) => (
            <View key={e.entry.id} style={{ gap: 4 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${localDateTime(e.entry.at.utc, e.entry.at.tz).slice(11)} ${entryTitle(e)}`}
                accessibilityHint={t('review.entryHint')}
                disabled={comparing} // while comparing, taps pick photos (UX-10)
                onPress={() => void openEntry(e.kind === 'skin' ? 'skinEntries' : 'nailEntries', e.entry.id, entryTitle(e))}
                style={({ pressed }) => pressed && { opacity: 0.6 }}
              >
                <Text style={styles.rowText}>
                  {`${localDateTime(e.entry.at.utc, e.entry.at.tz).slice(11)}  ${
                    e.kind === 'skin'
                      ? [...SCORE_KEYS.map((k) => `${t(`skin.scores.${k}`)} ${e.entry.scores[k]}`), ...skinExtras(e.entry)].join(', ')
                      : `${t(`nail.stages.${e.entry.stage}`)}, ${t(`nail.extents.${e.entry.extent}`)}`
                  }`}
                </Text>
              </Pressable>
              {e.entry.note ? <Hint>{e.entry.note}</Hint> : null}
              <PhotoThumbs photos={e.photos} {...(comparing ? { onPick: pick, picked: new Set(picked.map((p) => p.id)) } : {})} />
              {/* SK-4: how long after the last treatment on this area each photo was taken; computed from the timestamps. */}
              {[...new Set(e.photos.map((p) => sinceCaption(e.sinceTreatment[p.id] ?? null, (id) => treatmentNames[id] ?? id, t)))].map(
                (c) => (
                  <Hint key={c}>{c}</Hint>
                ),
              )}
            </View>
          ))}
        </View>
      ))}
    </Screen>
  );
}
