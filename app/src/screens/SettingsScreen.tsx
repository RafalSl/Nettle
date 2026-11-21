import { useRouter } from 'expo-router';
import { t } from '@/i18n';
import { NavGroup } from '@/ui/NavGroup';
import { NavRow } from '@/ui/NavRow';
import { Screen } from '@/ui/components';

/** UX-6: five groups. Data and backup is next to last and About last; Delete data sits at the end of Data and backup. */
export default function SettingsScreen() {
  const router = useRouter();
  return (
    <Screen>
      <NavGroup>
        <NavRow icon="list" title={t('nav.logging')} subtitle={t('settings.loggingHint')} onPress={() => router.push('/settings/logging')} />
        <NavRow icon="bell" title={t('nav.remindersPrivacy')} subtitle={t('settings.remindersPrivacyHint')} onPress={() => router.push('/settings/reminders')} />
        <NavRow icon="sparkle" title={t('nav.ai')} subtitle={t('settings.aiHint')} onPress={() => router.push('/settings/ai')} />
        <NavRow icon="box" title={t('nav.data')} subtitle={t('settings.dataHint')} onPress={() => router.push('/settings/data')} />
        <NavRow icon="info" title={t('nav.about')} onPress={() => router.push('/settings/about')} />
      </NavGroup>
    </Screen>
  );
}
