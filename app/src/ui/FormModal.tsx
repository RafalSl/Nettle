import { Stack, useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode, type Ref } from 'react';
import { Pressable, type ScrollViewInstance, View } from 'react-native';
import { errorMessage, t } from '@/i18n';
import { confirmDestructive } from '@/ui/actionSheet';
import { unsavedForm } from '@/ui/formState';
import { Screen } from '@/ui/components';
import { BottomInset } from '@/ui/FloatingTabBar';
import { FloatingSave, SAVE_INSET } from '@/ui/FloatingSave';
import { GlassSurface } from '@/ui/GlassSurface';
import { Text } from '@/ui/themed';
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
  banner,
  scrollRef,
  children,
}: {
  dirty: boolean;
  /** What is still needed before Save works, already localized; null when the form is complete. */
  missing: string | null;
  /** Resolves to false to keep the form open without an error (for example when the user declined a confirmation). */
  onSave: () => Promise<void | false>;
  /** True while the form is in a phase that cannot be saved yet. */
  hideSave?: boolean;
  /** A note that stays pinned under the header while the form scrolls (the urgent-care advice of a reaction). */
  banner?: ReactNode;
  /** Lets a form scroll itself (the meal form keeps Add ingredient above the keyboard). */
  scrollRef?: Ref<ScrollViewInstance>;
  children: ReactNode;
}) {
  const router = useRouter();
  useEffect(() => {
    unsavedForm.current = dirty;
    return () => {
      unsavedForm.current = false;
    };
  }, [dirty]);
  /** NF-3: a failed save keeps the form open with a coral banner; the input stays. */
  const [error, setError] = useState<string | null>(null);
  async function save() {
    setError(null);
    try {
      if ((await onSave()) !== false) router.back();
    } catch (e) {
      setError(errorMessage(e));
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
      {banner}
      {error !== null && (
        <View accessibilityRole="alert" style={{ marginHorizontal: 20, marginTop: 4, padding: 14, borderRadius: 22, gap: 2, backgroundColor: color.alertSoft, borderWidth: 1, borderColor: color.alertLine }}>
          <Text style={{ color: color.alert, fontWeight: '700', fontSize: 14.5 }}>{error}</Text>
          <Text style={{ color: color.soft, fontSize: 13.5 }}>{t('edit.keptOpen')}</Text>
        </View>
      )}
      <BottomInset.Provider value={hideSave ? 24 : SAVE_INSET}>
        <Screen scrollRef={scrollRef}>{children}</Screen>
      </BottomInset.Provider>
      {hideSave ? null : <FloatingSave disabled={missing !== null} missing={missing} onPress={() => void save()} />}
    </>
  );
}
