import React, { useEffect } from 'react';
import { act, create } from 'react-test-renderer';
import { useFocusLoad } from '@/ui/useFocusLoad';

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return { useFocusEffect: (cb: () => void | (() => void)) => useEffect(cb, [cb]) };
});
jest.mock('@/ui/showError', () => ({ showError: jest.fn() }));

/** A promise the test resolves by hand, to play a slow and a fast answer. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function Probe({ day, answers, shown }: { day: string; answers: Record<string, Promise<string>>; shown: string[] }) {
  useFocusLoad(
    () => answers[day]!,
    [answers, day],
    (v) => shown.push(v),
  );
  return null;
}

describe('useFocusLoad (UX-2)', () => {
  it('UX-2 a slow answer for an earlier day never overwrites the answer for the day shown now', async () => {
    const slow = deferred<string>();
    const fast = deferred<string>();
    const answers = { '2026-01-14': slow.promise, '2026-01-15': fast.promise };
    const shown: string[] = [];
    let r!: ReturnType<typeof create>;
    await act(async () => {
      r = create(<Probe day="2026-01-14" answers={answers} shown={shown} />);
    });
    await act(async () => r.update(<Probe day="2026-01-15" answers={answers} shown={shown} />));
    await act(async () => fast.resolve('day 15'));
    await act(async () => slow.resolve('day 14'));
    expect(shown).toEqual(['day 15']);
  });

  it('UX-2 reload loads again with the same dependencies, and an error goes to the error handler', async () => {
    const onError = jest.fn();
    const calls: number[] = [];
    let n = 0;
    const next = async () => {
      n += 1;
      if (n === 2) throw new Error('synthetic failure');
      return n;
    };
    const exposed: (() => void)[] = [];
    function Counter({ expose }: { expose: (reload: () => void) => void }) {
      const reload = useFocusLoad(next, [], (v) => calls.push(v), onError);
      useEffect(() => {
        expose(reload);
      }, [expose, reload]);
      return null;
    }
    await act(async () => {
      create(<Counter expose={(r) => exposed.push(r)} />);
    });
    await act(async () => exposed[0]!());
    await act(async () => exposed[0]!());
    expect(calls).toEqual([1, 3]);
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
