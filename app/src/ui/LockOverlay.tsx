import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { Text } from '@/ui/themed';
import { t } from '@/i18n';
import { useServices } from '@/services';
import { Button } from '@/ui/components';
import { color } from '@/ui/theme';

/** Only the states that hide the app count as "away"; an unknown state at launch is treated as active. */
const isActive = (state: string | null | undefined) => state !== 'inactive' && state !== 'background';

/**
 * SE-8: covers the app while it is locked, and also while it is not in the foreground, so the app switcher never
 * shows the diary. It asks for Face ID or the passcode when the app comes back locked, and offers a button when
 * the prompt was cancelled. The content below stays mounted, so an open form is not lost by a short absence.
 */
export function LockOverlay() {
  const { appLock } = useServices();
  const locked = useSyncExternalStore(appLock.subscribe, () => appLock.locked);
  const [active, setActive] = useState(isActive(AppState.currentState));
  const prompted = useRef(false);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (isActive(state)) {
        appLock.foreground();
        setActive(true);
      } else {
        appLock.background();
        setActive(false);
      }
    });
    return () => sub.remove();
  }, [appLock]);

  const prompt = () => void appLock.unlock(t('lock.reason'));
  useEffect(() => {
    if (!locked) prompted.current = false;
    else if (active && !prompted.current) {
      prompted.current = true;
      prompt();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, active]);

  if (!locked && active) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: color.ground, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }]} accessibilityViewIsModal>
      {locked && (
        <>
          <Text style={{ color: '#fff', fontSize: 20 }}>{t('lock.locked')}</Text>
          <Button title={t('lock.unlock')} onPress={prompt} />
        </>
      )}
    </View>
  );
}
