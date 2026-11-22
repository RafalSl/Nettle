import { useSyncExternalStore } from 'react';
import { t } from '@/i18n';
import { useServices } from '@/services';
import { Heading, Hint, Screen } from '@/ui/components';
import { SwitchRow } from '@/ui/SwitchRow';
import { showError } from '@/ui/showError';

/** SE-8, UX-6: the app lock switch. Changing it asks for Face ID or the passcode first, either way. */
export default function PrivacySettings() {
  const { appLock } = useServices();
  const enabled = useSyncExternalStore(appLock.subscribe, () => appLock.isEnabled);
  async function change(next: boolean) {
    try {
      await appLock.setEnabled(next, t(next ? 'lock.turnOn' : 'lock.turnOff'));
    } catch (e) {
      showError(e);
    }
  }
  return (
    <Screen>
      <SwitchRow title={t('lock.switch')} hint={t('lock.hint')} value={enabled} onChange={(v) => void change(v)} />
      <Heading>{t('settings.photosTitle')}</Heading>
      <Hint>{t('settings.photosInfo')}</Hint>
      <Hint>{t('settings.photosSensitive')}</Hint>
    </Screen>
  );
}
