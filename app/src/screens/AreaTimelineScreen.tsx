import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { areaTimeline, trendPoints, type TimelineDay, type TrendKey } from '@/core/usecases/timeline';
import { SCORE_KEYS, type Photo } from '@/core/model/types';
import { localDateTime } from '@/core/model/time';
import { areaLabel, errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { PhotoCompare } from '@/ui/PhotoCompare';
import { PhotoThumbs } from '@/ui/PhotoThumbs';
import { TrendChart } from '@/ui/TrendChart';
import { Button, Chips, Heading, Hint, Screen, styles } from '@/ui/components';

/** SK-8: one area across dates: the scores or nail stage of each entry with its photos beside them, newest day first. */
export default function AreaTimelineScreen() {
  const { deps } = useServices();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [days, setDays] = useState<TimelineDay[] | null>(null);
  const [name, setName] = useState('');
  const [trend, setTrend] = useState<TrendKey>('severity');
  const [comparing, setComparing] = useState(false);
  const [picked, setPicked] = useState<Photo[]>([]);
  const load = useCallback(() => {
    (async () => {
      const area = (await deps.repo.listAreas()).find((a) => a.id === id);
      setName(area ? areaLabel(area) : '');
      setDays(await areaTimeline(deps, id));
    })().catch((e) => Alert.alert(errorMessage(e)));
  }, [deps, id]);
  useFocusEffect(load);

  const isNail = days?.some((d) => d.entries.some((e) => e.kind === 'nail')) ?? false;
  const keys: TrendKey[] = isNail ? ['extent'] : [...SCORE_KEYS];
  const key = keys.includes(trend) ? trend : keys[0]!;
  const allPhotos = days?.flatMap((d) => d.entries.flatMap((e) => e.photos)) ?? [];
  /** What was logged with a photo, for the comparison captions. */
  const captionOf = (photo: Photo) => {
    for (const d of days ?? []) {
      for (const e of d.entries) {
        if (e.photos.some((p) => p.id === photo.id)) {
          return e.kind === 'skin' ? SCORE_KEYS.map((k) => `${t(`skin.scores.${k}`)} ${e.entry.scores[k]}`).join(', ') : `${t(`nail.stages.${e.entry.stage}`)}, ${t(`nail.extents.${e.entry.extent}`)}`;
        }
      }
    }
    return '';
  };
  const pick = (photo: Photo) =>
    setPicked((cur) => (cur.some((p) => p.id === photo.id) ? cur.filter((p) => p.id !== photo.id) : [...cur, photo].slice(-2))); // a third pick replaces the oldest

  return (
    <Screen>
      <Heading>{name}</Heading>
      {days !== null && days.length === 0 && <Hint>{t('review.timelineEmpty')}</Hint>}
      {days !== null && days.length > 0 && (
        <>
          <Heading>{t('review.trend')}</Heading>
          {!isNail && <Chips items={SCORE_KEYS.map((k) => ({ id: k, label: t(`skin.scores.${k}`) }))} selected={new Set([key])} onToggle={(id) => setTrend(id as TrendKey)} />}
          <TrendChart points={trendPoints(days, key)} max={key === 'extent' ? 3 : 10} label={key === 'extent' ? t('review.extent') : t(`skin.scores.${key}`)} />
        </>
      )}
      {allPhotos.length >= 2 && (
        <>
          <Button kind="secondary" title={comparing ? t('review.compareDone') : t('review.compare')} onPress={() => (setComparing((c) => !c), setPicked([]))} />
          {comparing && picked.length < 2 && <Hint>{t('review.comparePick')}</Hint>}
          {comparing && picked.length === 2 && <PhotoCompare photos={picked.map((photo) => ({ photo, caption: captionOf(photo) }))} />}
        </>
      )}
      {days?.map((d) => (
        <View key={d.day} style={{ gap: 6 }}>
          <Text style={styles.label}>{d.day}</Text>
          {d.flares.map((f) => (
            <Hint key={f.id}>{`${localDateTime(f.at.utc, f.at.tz).slice(11)}  ${t(f.kind === 'start' ? 'review.flareStart' : 'review.flareEnd')}`}</Hint>
          ))}
          {d.entries.map((e) => (
            <View key={e.entry.id} style={{ gap: 4 }}>
              <Text style={styles.rowText}>
                {`${localDateTime(e.entry.at.utc, e.entry.at.tz).slice(11)}  ${
                  e.kind === 'skin'
                    ? SCORE_KEYS.map((k) => `${t(`skin.scores.${k}`)} ${e.entry.scores[k]}`).join(', ')
                    : `${t(`nail.stages.${e.entry.stage}`)}, ${t(`nail.extents.${e.entry.extent}`)}`
                }`}
              </Text>
              {e.entry.note ? <Hint>{e.entry.note}</Hint> : null}
              <PhotoThumbs photos={e.photos} {...(comparing ? { onPick: pick, picked: new Set(picked.map((p) => p.id)) } : {})} />
            </View>
          ))}
        </View>
      ))}
    </Screen>
  );
}
