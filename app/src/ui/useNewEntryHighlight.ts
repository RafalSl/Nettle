import { useEffect, useRef, useState } from 'react';

/**
 * UX-2: which rows of a day's log appeared since the last look (a form just saved them), highlighted for `ms`.
 * The first load of a day highlights nothing. `seen(day, ids)` is called with every load of the log.
 */
export function useNewEntryHighlight(ms: number) {
  const [highlight, setHighlight] = useState<Set<string>>(new Set());
  const last = useRef<{ day: string; ids: Set<string>; loaded: boolean }>({ day: '', ids: new Set(), loaded: false });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const seen = (day: string, ids: string[]) => {
    const before = last.current;
    if (before.day === day && before.loaded) {
      const fresh = ids.filter((id) => !before.ids.has(id));
      if (fresh.length > 0) {
        setHighlight(new Set(fresh));
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setHighlight(new Set()), ms);
        (timer.current as { unref?: () => void }).unref?.(); // never keeps a test or a process alive
      }
    }
    last.current = { day, ids: new Set(ids), loaded: true };
  };
  return { highlight, seen };
}
