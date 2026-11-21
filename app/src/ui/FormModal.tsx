import { Stack, useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Pressable } from 'react-native';
import { Text } from '@/ui/themed';
import { errorMessage, t } from '@/i18n';
import { confirmDestructive } from '@/ui/actionSheet';
import { unsavedForm } from '@/ui/formState';
import { Hint, Screen } from '@/ui/components';
import { color } from '@/ui/theme';

/** Tracks whether the user changed anything, for the discard guard (UX-3). */
export function useForm() {
  const [dirty, setDirty] = useState(false);
  return { dirty, touch: () => setDirty(true) };
}

/** A field whose changes mark the form dirty. */
export function useField<T>(initial: T, touch: () => void) {
  const [value, set] = useState<T>(initial);
  return [value, (next: T) => (touch(), set(next))] as const;
}

/**
 * UX-3: the body of a full-height modal form. Cancel sits on the leading edge of the header and Save on the
 * trailing edge. Save is disabled until `missing` is null, and the form says what is missing. Cancel and the
 * swipe-down gesture ask first (Discard Changes) when something was changed. A failed save keeps the form open.
 */
export function FormModal({
  dirty,
  missing,
  onSave,
  children,
}: {
  dirty: boolean;
  /** What is still needed before Save works, already localized; null when the form is complete. */
  missing: string | null;
  /** Resolves to false to keep the form open without an error (for example when the user declined a confirmation). */
  onSave: () => Promise<void | false>;
  children: ReactNode;
}) {
  const router = useRouter();
  useEffect(() => {
    unsavedForm.current = dirty;
    return () => {
      unsavedForm.current = false;
    };
  }, [dirty]);
  async function save() {
    try {
      if ((await onSave()) !== false) router.back();
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }
  async function cancel() {
    if (!dirty || (await confirmDestructive({ title: t('edit.discardTitle'), action: t('edit.discard') }))) router.back();
  }
  return (
    <>
      <Stack.Screen
        options={{
          gestureEnabled: !dirty,
          headerLeft: () => (
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.cancel')} onPress={() => void cancel()} hitSlop={8}>
              <Text style={{ color: color.accent, fontSize: 17 }}>{t('common.cancel')}</Text>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.save')}
              accessibilityState={{ disabled: missing !== null }}
              disabled={missing !== null}
              onPress={() => void save()}
              hitSlop={8}>
              <Text style={{ color: color.accent, fontSize: 17, fontWeight: '600', opacity: missing !== null ? 0.4 : 1 }}>{t('common.save')}</Text>
            </Pressable>
          ),
        }}
      />
      <Screen>
        {children}
        {missing !== null && <Hint>{t('edit.missing', { what: missing })}</Hint>}
      </Screen>
    </>
  );
}
