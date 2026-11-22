import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import type { Deps } from '@/core/usecases/deps';

/**
 * NF-7, UX-2: the current time as state. A `deps.clock.now()` in a render body is cached by the React Compiler
 * (`deps` never changes), so a screen that stays mounted would keep the day or month it first rendered. This is
 * read again on focus, when the app returns to the foreground and every minute.
 */
export function useNow(deps: Deps): Date {
  const [now, setNow] = useState(() => deps.clock.now());
  const refresh = useCallback(() => setNow(deps.clock.now()), [deps]);
  useFocusEffect(refresh);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => state === 'active' && refresh());
    const timer = setInterval(refresh, 60_000);
    (timer as { unref?: () => void }).unref?.();
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [refresh]);
  return now;
}
