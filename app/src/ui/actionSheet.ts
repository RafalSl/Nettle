import { ActionSheetIOS, Alert, Platform } from 'react-native';
import { t } from '@/i18n';

export interface SheetAction {
  label: string;
  destructive?: boolean;
}

/**
 * UX-9: an action sheet. The actions come first (destructive ones are marked), Cancel is always last. Resolves
 * with the index of the chosen action, or null for Cancel. iOS shows the native sheet; other platforms fall
 * back to an alert.
 */
export function chooseAction(opts: { title: string; message?: string; actions: SheetAction[] }): Promise<number | null> {
  return new Promise((resolve) => {
    const cancelIndex = opts.actions.length;
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: opts.title,
          message: opts.message,
          options: [...opts.actions.map((a) => a.label), t('common.cancel')],
          destructiveButtonIndex: opts.actions.flatMap((a, i) => (a.destructive ? [i] : [])),
          cancelButtonIndex: cancelIndex,
        },
        (index) => resolve(index === cancelIndex ? null : index),
      );
    } else {
      Alert.alert(opts.title, opts.message, [
        ...opts.actions.map((a, i) => ({
          text: a.label,
          style: a.destructive ? ('destructive' as const) : ('default' as const),
          onPress: () => resolve(i),
        })),
        { text: t('common.cancel'), style: 'cancel' as const, onPress: () => resolve(null) },
      ]);
    }
  });
}

/** UX-9: the destructive choice alone, for example "Discard Changes". Resolves true only when it is picked. */
export async function confirmDestructive(opts: { title: string; message?: string; action: string }): Promise<boolean> {
  return (await chooseAction({ title: opts.title, message: opts.message, actions: [{ label: opts.action, destructive: true }] })) === 0;
}
