import { useFocusEffect } from 'expo-router';
import { useCallback, useLayoutEffect, useRef, useState, type DependencyList } from 'react';
import { showError } from '@/ui/showError';

const sameDeps = (a: DependencyList, b: DependencyList) => a.length === b.length && a.every((x, i) => Object.is(x, b[i]));

/** A number that changes whenever one of `deps` changes (compared like React compares effect dependencies). */
function useDepsVersion(deps: DependencyList): number {
  const [seen, setSeen] = useState({ deps, version: 0 });
  if (!sameDeps(seen.deps, deps)) {
    const next = { deps, version: seen.version + 1 };
    setSeen(next); // React's "adjust state while rendering" pattern: it re-renders at once with the new version
    return next.version;
  }
  return seen.version;
}

/**
 * UX-2: loads a screen's data whenever it comes into focus, and again when `deps` change or `reload` is called.
 * Only the latest load is applied: a slow answer for an earlier day or month never overwrites a newer one, and an
 * answer that arrives after the screen lost focus is dropped (it loads again on return). Errors go to `showError`
 * unless `onError` is given. Like a request id in a backend handler, `seq` tells the latest load from older ones.
 */
export function useFocusLoad<T>(
  load: () => Promise<T>,
  deps: DependencyList,
  apply: (value: T) => void,
  onError: (e: unknown) => void = showError,
): () => void {
  const latest = useRef({ load, apply, onError });
  useLayoutEffect(() => {
    latest.current = { load, apply, onError };
  });
  const seq = useRef(0);
  const version = useDepsVersion(deps);
  const reload = useCallback(() => {
    const mine = ++seq.current;
    const { load: run, apply: use, onError: fail } = latest.current;
    run().then(
      (value) => mine === seq.current && use(value),
      (e: unknown) => mine === seq.current && fail(e),
    );
  }, []);
  useFocusEffect(
    useCallback(() => {
      reload();
      return () => void ++seq.current; // leaving the screen drops an answer still on its way
      // `version` is the dependency: it changes exactly when one of `deps` does.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reload, version]),
  );
  return reload;
}
