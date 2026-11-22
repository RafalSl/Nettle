import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { deviceLanguage, t } from '@/i18n';
import type { LanguagePreference } from '@/core/model/language';
import { getPreferences } from '@/core/usecases/preferences';
import { useServices } from '@/services';
import { languageName } from '@/screens/LanguageScreen';
import { NavGroup } from '@/ui/NavGroup';
import { NavRow } from '@/ui/NavRow';
import { Screen } from '@/ui/components';

/** UX-6: five groups. Data and backup is next to last and About last; Delete data sits at the end of Data and backup. */
export default function SettingsScreen() {
  const router = useRouter();
  const { deps } = useServices();
  const [language, setLanguage] = useState<LanguagePreference>('system');
  useFocusEffect(
    useCallback(
      () =>
        void getPreferences(deps).then(
          (p) => setLanguage(p.language),
          () => undefined,
        ),
      [deps],
    ),
  );
  const languageValue =
    language === 'system' ? t('settings.languageValueDevice', { language: languageName(deviceLanguage()) }) : languageName(language);
  return (
    <Screen>
      <NavGroup>
        <NavRow
          icon="list"
          title={t('nav.logging')}
          subtitle={t('settings.loggingHint')}
          onPress={() => router.push('/settings/logging')}
        />
        <NavRow
          icon="bell"
          title={t('nav.remindersPrivacy')}
          subtitle={t('settings.remindersPrivacyHint')}
          onPress={() => router.push('/settings/reminders')}
        />
        <NavRow icon="sparkle" title={t('nav.ai')} subtitle={t('settings.aiHint')} onPress={() => router.push('/settings/ai')} />
        <NavRow icon="box" title={t('nav.data')} subtitle={t('settings.dataHint')} onPress={() => router.push('/settings/data')} />
      </NavGroup>
      {/* UX-6, UX-7: the About group: Language first. */}
      <NavGroup>
        <NavRow icon="label" title={t('nav.language')} value={languageValue} onPress={() => router.push('/settings/language')} />
        <NavRow icon="info" title={t('nav.about')} onPress={() => router.push('/settings/about')} />
      </NavGroup>
    </Screen>
  );
}
