import Constants from 'expo-constants';
import { t } from '@/i18n';
import { Heading, Hint, Screen } from '@/ui/components';

/** UX-6: About. The version, where the data lives, and what the app's output is and is not. */
export default function AboutScreen() {
  const version = Constants.expoConfig?.version ?? '';
  return (
    <Screen>
      <Heading>{t('about.title')}</Heading>
      {version !== '' && <Hint>{t('about.version', { version })}</Hint>}
      <Hint>{t('about.local')}</Hint>
      <Hint>{t('about.ai')}</Hint>
      <Hint>{t('about.medical')}</Hint>
    </Screen>
  );
}
