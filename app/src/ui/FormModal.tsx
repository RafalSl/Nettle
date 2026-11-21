import { Stack, useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Pressable } from 'react-native';
import { errorMessage, t } from '@/i18n';
import { confirmDestructive } from '@/ui/actionSheet';
import { unsavedForm } from '@/ui/formState';
import { Screen } from '@/ui/components';
import { BottomInset } from '@/ui/FloatingTabBar';
import { FloatingSave, SAVE_INSET } from '@/ui/FloatingSave';
import { GlassSurface } from '@/ui/GlassSurface';
import { Text } from '@/ui/themed';

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
 * UX-3: the body of a full-height modal form. The header keeps Cancel (a glass pill) and the title; Save floats at the
 * bottom of the screen, above the keyboard. Save is disabled until `missing` is null, and a line above it says what is
 * missing. Cancel and the swipe-down gesture ask first (Discard Changes) when something was changed. A failed save keeps
 * the form open. With `hideSave` (the choose phase of a two-phase form, IN-7) there is no Save at all.
 */
export function FormModal({
  dirty,
  missing,
  onSave,
  hideSave = false,
  children,
}: {
  dirty: boolean;
  /** What is still needed before Save works, already localized; null when the form is complete. */
  missing: string | null;
  /** Resolves to false to keep the form open without an error (for example when the user declined a confirmation). */
  onSave: () => Promise<void | false>;
  /** True while the form is in a phase that cannot be saved yet. */
  hideSave?: boolean;
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
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.cancel')} onPress={() => void cancel()} hitSlop={4}>
              <GlassSurface style={{ height: 44, paddingHorizontal: 18, borderRadius: 999, justifyContent: 'center' }}>
                <Text style={{ fontSize: 15.5, fontWeight: '600' }}>{t('common.cancel')}</Text>
              </GlassSurface>
            </Pressable>
          ),
        }}
      />
      <BottomInset.Provider value={hideSave ? 24 : SAVE_INSET}>
        <Screen>{children}</Screen>
      </BottomInset.Provider>
      {hideSave ? null : <FloatingSave disabled={missing !== null} missing={missing} onPress={() => void save()} />}
    </>
  );
}
