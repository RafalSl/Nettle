import { ActionSheetIOS, Alert, Platform } from 'react-native';
import { t } from '@/i18n';

/**
 * UX-9: a destructive choice in an action sheet, destructive action first and Cancel last. Resolves true only
 * when the user picks the destructive action. iOS shows the native sheet; other platforms fall back to an alert.
 */
export function confirmDestructive(opts: { title: string; message?: string; action: string }): Promise<boolean> {
  return new Promise((resolve) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: opts.title,
          message: opts.message,
          options: [opts.action, t('common.cancel')],
          destructiveButtonIndex: 0,
          cancelButtonIndex: 1,
        },
        (index) => resolve(index === 0),
      );
    } else {
      Alert.alert(opts.title, opts.message, [
        { text: opts.action, style: 'destructive', onPress: () => resolve(true) },
        { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
      ]);
    }
  });
}
