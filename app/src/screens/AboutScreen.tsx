import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { NavRow } from '@/ui/NavRow';
import { t } from '@/i18n';
import { Heading, Hint, Screen } from '@/ui/components';

/** UX-6: About. The version, where the data lives, and what the app's output is and is not. */
export default function AboutScreen() {
  const router = useRouter();
  const version = Constants.expoConfig?.version ?? '';
  return (
    <Screen>
      <Heading>{t('about.title')}</Heading>
      {version !== '' && <Hint>{t('about.version', { version })}</Hint>}
      <Hint>{t('about.local')}</Hint>
      <Hint>{t('about.ai')}</Hint>
      <Hint>{t('about.medical')}</Hint>
      <NavRow title={t('nav.guide')} subtitle={t('guide.hint')} onPress={() => router.push('/guide')} />
    </Screen>
  );
}
