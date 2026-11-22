import { useEffect, useRef, useState } from 'react';

/** UX-3: rows that were just tapped stay locked for `ms` against a double tap (one-tap logging). */
export function useRowLock(ms: number) {
  const [locked, setLocked] = useState<Set<string>>(new Set());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const lock = (key: string) => {
    setLocked((l) => new Set(l).add(key));
    timers.current.push(setTimeout(() => setLocked((l) => new Set([...l].filter((k) => k !== key))), ms));
  };
  return { locked, lock };
}
