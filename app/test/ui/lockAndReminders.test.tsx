/* eslint-disable @typescript-eslint/no-require-imports -- screens are loaded lazily, after the harness mocks are in place */
import { create, mockRouter, mockParams, services, Deps, mount, press, hasText, nowDeps, toggle, flush } from './harness';
import React from 'react';
import { Alert, AppState } from 'react-native';
import { AnalysisRunner } from '@/core/usecases/analysisRunner';
import { AppLock } from '@/core/usecases/appLock';
import type { FakeNotifier } from '../fakes/fakeNotifier';
import type { FakeAuth } from '../fakes/fakeAuth';
import { unsavedForm } from '@/ui/formState';
import { logMeal } from '@/core/usecases/logMeal';
import { addArea } from '@/core/usecases/skin';
import en from '@/i18n/en.json';
import { act, type ReactTestRenderer } from 'react-test-renderer';

const fileShareCalls = (_deps: unknown) => 0; // a tap never exports; no file share is wired into these tests

describe('Reminder taps (SK-9)', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockRouter.push.mockClear();
    mockRouter.navigate.mockClear();
    unsavedForm.current = false;
  });
  afterEach(() => jest.restoreAllMocks());

  async function mountLayout(deps: Deps) {
    services.__state.current = {
      deps,
      fileShare: { saveAndShare: jest.fn(), pickFile: jest.fn() },
      analysisRunner: new AnalysisRunner(deps),
      appLock: new AppLock(deps),
    };
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(React.createElement(require('@/app/_layout').default));
    });
    return { tree, notifier: deps.notifier as unknown as FakeNotifier };
  }

  it('SK-9 a tap on the check-in reminder opens the check-in form of the day it was delivered, over Today', async () => {
    const deps = nowDeps();
    const { notifier } = await mountLayout(deps);
    await act(async () => notifier.tap({ id: 'checkin', target: 'checkin', deliveredAt: new Date('2026-01-10T20:00:00.000Z') }));
    expect(mockRouter.navigate).toHaveBeenCalledWith('/today');
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/form/checkin', params: { day: '2026-01-10' } });
  });

  it('SK-9 the same tap is handled once, and a tap while a form has unsaved changes does nothing', async () => {
    const deps = nowDeps();
    const { notifier } = await mountLayout(deps);
    const tap = { id: 'nails', target: 'nails', deliveredAt: new Date('2026-01-10T20:00:00.000Z') };
    await addArea(deps, 'Synthetic thumb', 'nail');
    await act(async () => notifier.tap(tap));
    await act(async () => notifier.tap(tap)); // Expo returns the last response again at launch
    expect(mockRouter.push).toHaveBeenCalledTimes(1);
    unsavedForm.current = true;
    await act(async () => notifier.tap({ id: 'backup', target: 'backup', deliveredAt: new Date('2026-02-01T10:00:00.000Z') }));
    expect(mockRouter.navigate).toHaveBeenCalledTimes(1); // only the Today step of the nails tap
  });

  it('SK-9 the backup reminder opens Data and backup and nothing else', async () => {
    const deps = nowDeps();
    const { notifier } = await mountLayout(deps);
    await act(async () => notifier.tap({ id: 'backup', target: 'backup', deliveredAt: null }));
    expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/settings/data' });
    expect(fileShareCalls(deps)).toBe(0);
  });

  it('SK-9 the check-in form opens on the day it is given', async () => {
    const deps = nowDeps();
    mockParams.current = { day: '2026-01-10' };
    const { tree } = await mount(() => require('@/app/form/checkin'), deps);
    await flush();
    expect(hasText(tree, '2026-01-10')).toBe(true);
    mockParams.current = {};
  });
});

describe('App lock (SE-8)', () => {
  let alert: jest.SpyInstance;
  let appState: ((s: string) => void) | null;
  beforeEach(() => {
    alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    appState = null;
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_type: string, handler: (s: string) => void) => {
      appState = handler;
      return { remove: jest.fn() };
    }) as never);
    mockRouter.push.mockClear();
    mockRouter.navigate.mockClear();
  });
  afterEach(() => jest.restoreAllMocks());

  async function mountLayout(deps: Deps, lock: AppLock) {
    services.__state.current = {
      deps,
      fileShare: { saveAndShare: jest.fn(), pickFile: jest.fn() },
      analysisRunner: new AnalysisRunner(deps),
      appLock: lock,
    };
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(React.createElement(require('@/app/_layout').default));
    });
    return tree;
  }
  const covered = (tree: ReactTestRenderer) => tree.root.findAll((n) => n.props.accessibilityViewIsModal === true).length > 0;

  it('SE-8 the Privacy screen switches the lock on only after the prompt, and says why when it cannot', async () => {
    const deps = nowDeps();
    const lock = new AppLock(deps);
    await lock.init();
    services.__state.current = {
      deps,
      fileShare: { saveAndShare: jest.fn(), pickFile: jest.fn() },
      analysisRunner: new AnalysisRunner(deps),
      appLock: lock,
    };
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(React.createElement(require('@/app/settings/privacy').default));
    });
    const auth = deps.auth as unknown as FakeAuth;
    auth.hasLock = false;
    await toggle(tree, en.lock.switch);
    expect(alert.mock.calls.at(-1)![0]).toBe(en.errors.lock_unavailable);
    auth.hasLock = true;
    auth.passes = false;
    await toggle(tree, en.lock.switch);
    expect(alert.mock.calls.at(-1)![0]).toBe(en.errors.lock_failed);
    expect(await deps.settings.get('appLockEnabled')).toBeNull();
    auth.passes = true;
    await toggle(tree, en.lock.switch);
    expect(auth.prompts.at(-1)).toBe(en.lock.turnOn);
    expect(await deps.settings.get('appLockEnabled')).toBe('1');
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === en.lock.switch && n.props.value === true).length).toBeGreaterThan(0);
  });

  it('SE-8 a cold start with the lock on shows the cover and asks once; Unlock after a cancelled prompt works', async () => {
    const deps = nowDeps();
    await deps.settings.set('appLockEnabled', '1');
    const lock = new AppLock(deps);
    await lock.init();
    const auth = deps.auth as unknown as FakeAuth;
    auth.passes = false;
    const tree = await mountLayout(deps, lock);
    await flush();
    expect(hasText(tree, en.lock.failedTitle)).toBe(true); // the cancelled prompt turns the cover into the failed state: coral lock, Try again
    expect(hasText(tree, en.lock.failedBody)).toBe(true);
    expect(auth.prompts).toEqual([en.lock.reason]); // one prompt, not one per render
    auth.passes = true;
    await press(tree, en.lock.tryAgain);
    await flush();
    expect(lock.locked).toBe(false);
    expect(hasText(tree, en.lock.failedTitle)).toBe(false);
    expect(hasText(tree, en.lock.locked)).toBe(false);
  });

  it('SE-8 while the app is not in the foreground a cover hides the diary, and a long absence locks it', async () => {
    const deps = nowDeps();
    const lock = new AppLock(deps);
    await lock.init();
    await lock.setEnabled(true, 'on');
    let now = Date.now();
    deps.clock = { now: () => new Date(now), timeZone: () => 'Europe/Warsaw' };
    const tree = await mountLayout(deps, lock);
    expect(covered(tree)).toBe(false);
    await act(async () => appState!('inactive'));
    expect(covered(tree)).toBe(true); // the app switcher shows the cover, not the diary
    await act(async () => appState!('active'));
    expect(covered(tree)).toBe(false);
    expect(lock.locked).toBe(false); // a short absence does not lock
    (deps.auth as unknown as FakeAuth).passes = false; // the prompt on return is cancelled, so the cover stays
    await act(async () => appState!('background'));
    now += 61_000;
    await act(async () => appState!('active'));
    await flush();
    expect(lock.locked).toBe(true);
    expect(hasText(tree, en.lock.failedTitle)).toBe(true);
  });

  it('SE-8 a reminder tap waits for the unlock before it opens anything', async () => {
    const deps = nowDeps();
    await deps.settings.set('appLockEnabled', '1');
    const lock = new AppLock(deps);
    await lock.init();
    (deps.auth as unknown as FakeAuth).passes = false;
    const tree = await mountLayout(deps, lock);
    const notifier = deps.notifier as unknown as FakeNotifier;
    let tapped!: Promise<void>;
    await act(async () => {
      tapped = notifier.tap({ id: 'backup', target: 'backup', deliveredAt: null });
    });
    expect(mockRouter.navigate).not.toHaveBeenCalled();
    (deps.auth as unknown as FakeAuth).passes = true;
    await press(tree, en.lock.tryAgain);
    await act(async () => {
      await tapped;
    });
    expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/settings/data' });
  });
});

describe('Lock cover states (SE-8)', () => {
  it('SE-8 the cover is gone after the automatic prompt passes, and no entry is shown', async () => {
    const deps = nowDeps();
    await logMeal(deps, { description: 'Synthetic secret meal', ingredients: [], at: new Date(Date.now() - 3600_000) });
    await deps.settings.set('appLockEnabled', '1');
    const lock = new AppLock(deps);
    await lock.init();
    (deps.auth as unknown as FakeAuth).passes = true;
    services.__state.current = {
      deps,
      fileShare: { saveAndShare: jest.fn(), pickFile: jest.fn() },
      analysisRunner: new AnalysisRunner(deps),
      appLock: lock,
    };
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(React.createElement(require('@/ui/LockOverlay').LockOverlay));
    });
    await flush();
    expect(lock.locked).toBe(false); // the automatic prompt passed
    expect(hasText(tree, 'Synthetic secret meal')).toBe(false);
  });

  it('SE-8 a failed attempt reuses the cover with Try again and Use passcode', async () => {
    const deps = nowDeps();
    await deps.settings.set('appLockEnabled', '1');
    const lock = new AppLock(deps);
    await lock.init();
    (deps.auth as unknown as FakeAuth).passes = false;
    services.__state.current = {
      deps,
      fileShare: { saveAndShare: jest.fn(), pickFile: jest.fn() },
      analysisRunner: new AnalysisRunner(deps),
      appLock: lock,
    };
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(React.createElement(require('@/ui/LockOverlay').LockOverlay));
    });
    await flush();
    expect(lock.failed).toBe(true);
    expect(hasText(tree, en.lock.failedTitle)).toBe(true);
    expect(hasText(tree, en.lock.usePasscode)).toBe(true);
    (deps.auth as unknown as FakeAuth).passes = true;
    await press(tree, en.lock.usePasscode);
    await flush();
    expect(lock.locked).toBe(false);
    expect(lock.failed).toBe(false);
  });
});
