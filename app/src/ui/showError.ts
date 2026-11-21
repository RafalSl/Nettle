import { Alert, Linking } from 'react-native';
import { NettleError } from '@/core/model/errors';
import { errorMessage, t } from '@/i18n';

/** Errors that only the iPhone settings can fix: the alert then offers to open them (IN-8, IN-9, NO-3). */
const SETTINGS_CODES = ['photo_permission_denied', 'notifications_denied'];

/** NF-3: show an error. A refused permission explains itself and offers "Open iPhone settings" and "Not now". */
export function showError(e: unknown): void {
  if (e instanceof NettleError && SETTINGS_CODES.includes(e.code)) {
    Alert.alert(errorMessage(e), undefined, [
      { text: t('common.notNow'), style: 'cancel' },
      { text: t('meal.openIphoneSettings'), onPress: () => void Linking.openSettings() },
    ]);
    return;
  }
  Alert.alert(errorMessage(e));
}
