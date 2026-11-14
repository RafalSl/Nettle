import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { areaTimeline, type TimelineDay } from '@/core/usecases/timeline';
import { SCORE_KEYS } from '@/core/model/types';
import { localDateTime } from '@/core/model/time';
import { areaLabel, errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { PhotoThumbs } from '@/ui/PhotoThumbs';
import { Heading, Hint, Screen, styles } from '@/ui/components';

/** SK-8: one area across dates: the scores or nail stage of each entry with its photos beside them, newest day first. */
export default function AreaTimelineScreen() {
  const { deps } = useServices();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [days, setDays] = useState<TimelineDay[] | null>(null);
  const [name, setName] = useState('');
  const load = useCallback(() => {
    (async () => {
      const area = (await deps.repo.listAreas()).find((a) => a.id === id);
      setName(area ? areaLabel(area) : '');
      setDays(await areaTimeline(deps, id));
    })().catch((e) => Alert.alert(errorMessage(e)));
  }, [deps, id]);
  useFocusEffect(load);

  return (
    <Screen>
      <Heading>{name}</Heading>
      {days !== null && days.length === 0 && <Hint>{t('review.timelineEmpty')}</Hint>}
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
              <PhotoThumbs photos={e.photos} />
            </View>
          ))}
        </View>
      ))}
    </Screen>
  );
}
