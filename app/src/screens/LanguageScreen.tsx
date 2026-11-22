import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { LANGUAGE_PREFERENCES, type LanguagePreference } from '@/core/model/language';
import { applyReminders } from '@/core/usecases/reminders';
import { getPreferences, setLanguage as saveLanguage } from '@/core/usecases/preferences';
import { deviceLanguage, reminderTexts, setLanguage, t } from '@/i18n';
import { useServices } from '@/services';
import { Hint, Label, Screen } from '@/ui/components';
import { GlassSurface } from '@/ui/GlassSurface';
import { Icon } from '@/ui/Icon';
import { RadioRow } from '@/ui/RadioRow';
import { Text } from '@/ui/themed';
import { showError } from '@/ui/showError';

/** The name of a language in its own words ("English", "Polski"), for the Language row and the page. */
export const languageName = (code: 'en' | 'pl'): string => t(code === 'pl' ? 'settings.languageNamePl' : 'settings.languageNameEn');

/** UX-7: Settings, Language: Device language (default), English or Polski. A choice applies at once and is saved with the preferences. */
export default function LanguageScreen() {
  const { deps } = useServices();
  const [choice, setChoice] = useState<LanguagePreference | null>(null);
  useEffect(() => {
    getPreferences(deps).then(
      (p) => setChoice(p.language),
      () => setChoice('system'),
    );
  }, [deps]);

  async function pick(next: LanguagePreference) {
    try {
      await saveLanguage(deps, next);
      setChoice(next);
      setLanguage(next); // the text of the whole app follows at once
      await applyReminders(deps, reminderTexts()); // SK-9: scheduled reminders keep their old text until they are scheduled again
    } catch (e) {
      showError(e);
    }
  }

  const detail: Record<LanguagePreference, string> = {
    system: t('settings.languageDeviceDetail', { language: languageName(deviceLanguage()) }),
    en: t('settings.languageEnglishDetail'),
    pl: t('settings.languagePolishDetail'),
  };
  const title: Record<LanguagePreference, string> = {
    system: t('settings.languageDevice'),
    en: languageName('en'),
    pl: languageName('pl'),
  };
  return (
    <Screen>
      <View style={{ gap: 8 }}>
        {LANGUAGE_PREFERENCES.map((l) => (
          <RadioRow key={l} icon="label" title={title[l]} detail={detail[l]} selected={choice === l} onPress={() => void pick(l)} />
        ))}
      </View>
      <Label>{t('settings.languageChanges')}</Label>
      <GlassSurface style={{ borderRadius: 26, padding: 16, gap: 10 }}>
        {(['languageChangesApp', 'languageChangesAi', 'languageChangesReport'] as const).map((k) => (
          <View key={k} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            <Icon name="check" size={16} stroke={2.4} wash={false} />
            <Text style={{ flex: 1, fontSize: 14.5 }}>{t(`settings.${k}`)}</Text>
          </View>
        ))}
      </GlassSurface>
      <Hint>{t('settings.languageNote')}</Hint>
    </Screen>
  );
}
