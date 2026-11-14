import { useRouter } from 'expo-router';
import { t } from '@/i18n';
import { NavRow } from '@/ui/NavRow';
import { Hint, Screen } from '@/ui/components';

/** UX-1: the second tab. Doctor report, days list and timelines follow; for now it opens the analysis and the export. */
export default function ReviewScreen() {
  const router = useRouter();
  return (
    <Screen>
      <NavRow title={t('review.analysis')} onPress={() => router.push('/review/analysis')} />
      <NavRow title={t('review.export')} onPress={() => router.push('/today/settings/data')} />
      <Hint>{t('review.empty')}</Hint>
    </Screen>
  );
}
