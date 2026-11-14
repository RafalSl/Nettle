import { useRouter } from 'expo-router';
import { t } from '@/i18n';
import { NavRow } from '@/ui/NavRow';
import { Screen } from '@/ui/components';

/** UX-6: a grouped list with chevron rows. Data and backup is last because it holds Delete data. */
export default function SettingsScreen() {
  const router = useRouter();
  return (
    <Screen>
      <NavRow title={t('nav.logging')} onPress={() => router.push('/today/settings/logging')} />
      <NavRow title={t('nav.suggestions')} onPress={() => router.push('/today/settings/suggestions')} />
      <NavRow title={t('nav.reminders')} onPress={() => router.push('/today/settings/reminders')} />
      <NavRow title={t('nav.privacy')} onPress={() => router.push('/today/settings/privacy')} />
      <NavRow title={t('nav.ai')} onPress={() => router.push('/today/settings/ai')} />
      <NavRow title={t('nav.data')} onPress={() => router.push('/today/settings/data')} />
    </Screen>
  );
}
