import { AppLock, LOCK_AFTER_MS } from '@/core/usecases/appLock';
import { FakeAuth } from './fakes/fakeAuth';
import { MemoryRepo } from './fakes/memoryRepo';
import { makeDeps } from './helpers/fixtures';
import { errorCode } from './helpers/errors';

function setup() {
  const deps = makeDeps(new MemoryRepo());
  let now = Date.parse('2026-01-15T10:00:00.000Z');
  deps.clock = { now: () => new Date(now), timeZone: () => 'Europe/Warsaw' };
  const auth = deps.auth as FakeAuth;
  return { deps, auth, lock: new AppLock(deps), advance: (ms: number) => void (now += ms) };
}

describe('app lock (SE-8)', () => {
  it('SE-8 is off by default: never locked, no prompt', async () => {
    const { lock, auth, advance } = setup();
    await lock.init();
    expect(lock.locked).toBe(false);
    lock.background();
    advance(10 * LOCK_AFTER_MS);
    lock.foreground();
    expect(lock.locked).toBe(false);
    expect(auth.prompts).toEqual([]);
  });

  it('SE-8 switching it on needs the person to pass the prompt, and a device with no lock refuses', async () => {
    const { deps, lock, auth } = setup();
    await lock.init();
    auth.hasLock = false;
    expect(await errorCode(lock.setEnabled(true, 'Turn on'))).toBe('lock_unavailable');
    expect(auth.prompts).toEqual([]);
    auth.hasLock = true;
    auth.passes = false;
    expect(await errorCode(lock.setEnabled(true, 'Turn on'))).toBe('lock_failed');
    expect(lock.isEnabled).toBe(false);
    expect(await deps.settings.get('appLockEnabled')).toBeNull();
    auth.passes = true;
    await lock.setEnabled(true, 'Turn on');
    expect(lock.isEnabled).toBe(true);
    expect(lock.locked).toBe(false); // the person has just proved they are the owner
    expect(await deps.settings.get('appLockEnabled')).toBe('1');
  });

  it('SE-8 a cold start with the lock on begins locked, and unlocking needs the prompt', async () => {
    const { deps, auth } = setup();
    await deps.settings.set('appLockEnabled', '1');
    const lock = new AppLock(deps);
    await lock.init();
    expect(lock.locked).toBe(true);
    auth.passes = false;
    expect(await lock.unlock('Unlock')).toBe(false);
    expect(lock.locked).toBe(true);
    auth.passes = true;
    expect(await lock.unlock('Unlock')).toBe(true);
    expect(lock.locked).toBe(false);
  });

  it('SE-8 locks after a minute in the background, not after less', async () => {
    const { lock, advance } = setup();
    await lock.init();
    await lock.setEnabled(true, 'Turn on');
    lock.background();
    advance(LOCK_AFTER_MS - 1);
    lock.foreground();
    expect(lock.locked).toBe(false);
    lock.background();
    advance(LOCK_AFTER_MS);
    lock.foreground();
    expect(lock.locked).toBe(true);
  });

  it('SE-8 a second background call does not restart the clock', async () => {
    const { lock, advance } = setup();
    await lock.init();
    await lock.setEnabled(true, 'Turn on');
    lock.background();
    advance(LOCK_AFTER_MS / 2);
    lock.background(); // "inactive" then "background" both arrive
    advance(LOCK_AFTER_MS / 2);
    lock.foreground();
    expect(lock.locked).toBe(true);
  });

  it('SE-8 switching it off needs the prompt too, and a reminder tap waits until the unlock', async () => {
    const { lock, auth, deps, advance } = setup();
    await lock.init();
    await lock.setEnabled(true, 'Turn on');
    lock.background();
    advance(LOCK_AFTER_MS);
    lock.foreground();
    let released = false;
    void lock.whenUnlocked().then(() => (released = true));
    await Promise.resolve();
    expect(released).toBe(false);
    await lock.unlock('Unlock');
    await Promise.resolve();
    expect(released).toBe(true);
    auth.passes = false;
    expect(await errorCode(lock.setEnabled(false, 'Turn off'))).toBe('lock_failed');
    expect(lock.isEnabled).toBe(true);
    auth.passes = true;
    await lock.setEnabled(false, 'Turn off');
    expect(lock.isEnabled).toBe(false);
    expect(await deps.settings.get('appLockEnabled')).toBeNull();
  });

  it('SE-8 listeners hear about every change', async () => {
    const { lock, advance } = setup();
    await lock.init();
    const seen: boolean[] = [];
    lock.subscribe(() => seen.push(lock.locked));
    await lock.setEnabled(true, 'Turn on');
    lock.background();
    advance(LOCK_AFTER_MS);
    lock.foreground();
    await lock.unlock('Unlock');
    expect(seen).toEqual([false, true, false]);
  });
});
