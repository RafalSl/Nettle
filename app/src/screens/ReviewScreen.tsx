import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Heading, Hint, Screen } from '@/ui/components';
import { daysWithEntries, type DaySummary } from '@/core/usecases/dayLog';
import { t } from '@/i18n';
import { useServices } from '@/services';
import { NavRow } from '@/ui/NavRow';

/** UX-1: the second tab: the Doctor report, the AI analysis and the days list, which opens a day on Today. */
export default function ReviewScreen() {
  const { deps } = useServices();
  const router = useRouter();
  const [days, setDays] = useState<DaySummary[] | null>(null);
  const load = useCallback(() => {
    daysWithEntries(deps).then(setDays).catch(() => setDays([]));
  }, [deps]);
  useFocusEffect(load);
  return (
    <Screen>
      <NavRow title={t('review.report')} onPress={() => router.push('/review/report')} />
      <NavRow title={t('review.analysis')} onPress={() => router.push('/review/analysis')} />
      <Heading>{t('review.days')}</Heading>
      {days !== null && days.length === 0 && <Hint>{`${t('review.noDays')} ${t('review.empty')}`}</Hint>}
      {days?.map((d) => (
        <NavRow
          key={d.day}
          title={`${t('review.dayRow', { day: d.day, n: d.entries })}${d.complete ? `, ${t('review.dayComplete')}` : ''}`}
          onPress={() => router.navigate({ pathname: '/today', params: { day: d.day } })}
        />
      ))}
    </Screen>
  );
}
