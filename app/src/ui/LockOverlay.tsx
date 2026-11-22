import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { Text } from '@/ui/themed';
import { t } from '@/i18n';
import { useServices } from '@/services';
import { Aurora } from '@/ui/Aurora';
import { Button } from '@/ui/components';
import { GlassSurface } from '@/ui/GlassSurface';
import { Icon } from '@/ui/Icon';
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
  const failed = useSyncExternalStore(appLock.subscribe, () => appLock.failed);
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
  // SE-8: the cover shows no entry, ever. Away from the foreground (the app switcher) it is only a lock mark.
  if (!active) {
    return (
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: color.ground, alignItems: 'center', justifyContent: 'center' }]}
        accessibilityViewIsModal
      >
        <GlassSurface style={{ width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="lock" size={36} />
        </GlassSurface>
      </View>
    );
  }
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: color.ground, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24 },
      ]}
      accessibilityViewIsModal
    >
      <Aurora />
      <GlassSurface style={{ width: 150, height: 150, borderRadius: 75, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="lock" size={44} tint={failed ? color.alert : color.accent} />
      </GlassSurface>
      <Text style={{ fontSize: 26, fontWeight: '800', letterSpacing: -0.6, textAlign: 'center' }}>
        {failed ? t('lock.failedTitle') : t('lock.locked')}
      </Text>
      <Text style={{ fontSize: 15, color: color.soft, textAlign: 'center', maxWidth: 300 }}>
        {failed ? t('lock.failedBody') : t('lock.body')}
      </Text>
      <View style={{ alignSelf: 'stretch', gap: 8 }}>
        <Button title={failed ? t('lock.tryAgain') : t('lock.unlock')} onPress={prompt} />
        <Button kind="secondary" title={t('lock.usePasscode')} onPress={prompt} />
      </View>
    </View>
  );
}
