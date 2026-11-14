import { useSyncExternalStore } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { Hint, Screen, styles } from '@/ui/components';

/** SE-8, UX-6: the app lock switch. Changing it asks for Face ID or the passcode first, either way. */
export default function PrivacySettings() {
  const { appLock } = useServices();
  const enabled = useSyncExternalStore(appLock.subscribe, () => appLock.isEnabled);
  async function change(next: boolean) {
    try {
      await appLock.setEnabled(next, t(next ? 'lock.turnOn' : 'lock.turnOff'));
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }
  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={styles.rowText}>{t('lock.switch')}</Text>
        <Switch value={enabled} onValueChange={(v) => void change(v)} accessibilityLabel={t('lock.switch')} />
      </View>
      <Hint>{t('lock.hint')}</Hint>
    </Screen>
  );
}
