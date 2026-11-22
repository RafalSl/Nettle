import { NettleError } from '../model/errors';
import type { Deps } from './deps';
import { SETTING_KEYS } from './settingsStore';

const KEY = SETTING_KEYS.appLock;
/** SE-8 default: lock after this long in the background, and on every cold start. */
export const LOCK_AFTER_MS = 60_000;

/**
 * SE-8: the app lock. Off by default. When on, the app is locked on a cold start and after a minute in the
 * background, and unlocking asks for Face ID or the passcode. Platform-free: the app tells it when it goes to
 * the background and comes back, and it calls the Authenticator port.
 */
export class AppLock {
  private enabled = false;
  private isLocked = false;
  private backgroundedAt: number | null = null;
  private listeners = new Set<() => void>();
  private waiting: (() => void)[] = [];
  private didFail = false;

  constructor(private readonly deps: Deps) {}

  /** Reads the setting; a cold start with the lock on begins locked. Call before showing any content. */
  async init(): Promise<void> {
    this.enabled = (await this.deps.settings.get(KEY)) === '1';
    this.isLocked = this.enabled;
    this.emit();
  }

  get locked(): boolean {
    return this.isLocked;
  }
  /** SE-8: the last unlock attempt failed or was cancelled; the cover then says so. Cleared by the next success. */
  get failed(): boolean {
    return this.didFail;
  }
  get isEnabled(): boolean {
    return this.enabled;
  }
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private emit() {
    for (const l of [...this.listeners]) l();
    if (!this.isLocked) {
      for (const w of this.waiting.splice(0)) w();
    }
  }

  /** Resolves at once when unlocked, otherwise when the person unlocks. A reminder tap waits for this (SE-8). */
  whenUnlocked(): Promise<void> {
    return this.isLocked ? new Promise((resolve) => this.waiting.push(resolve)) : Promise.resolve();
  }

  /**
   * Turns the lock on or off. Either way the person must pass the prompt first, so the lock cannot be switched
   * on by accident or off by someone else. Switching it on needs Face ID, Touch ID or a passcode on the device
   * (`lock_unavailable`); a failed or cancelled prompt changes nothing (`lock_failed`).
   */
  async setEnabled(enabled: boolean, reason: string): Promise<void> {
    if (enabled && !(await this.deps.auth.available())) throw new NettleError('lock_unavailable');
    if (!(await this.deps.auth.authenticate(reason))) throw new NettleError('lock_failed');
    if (enabled) await this.deps.settings.set(KEY, '1');
    else await this.deps.settings.delete(KEY);
    this.enabled = enabled;
    this.isLocked = false; // the person just proved they are the owner
    this.emit();
  }

  /** Shows the prompt; unlocks on success and returns whether it did. */
  async unlock(reason: string): Promise<boolean> {
    if (!this.isLocked) return true;
    if (!(await this.deps.auth.authenticate(reason))) {
      this.didFail = true;
      this.emit();
      return false;
    }
    this.didFail = false;
    this.isLocked = false;
    this.emit();
    return true;
  }

  /** The app left the foreground. */
  background(): void {
    if (this.backgroundedAt === null) this.backgroundedAt = this.deps.clock.now().getTime();
  }

  /** The app is back: lock when it was away for a minute or more. */
  foreground(): void {
    const away = this.backgroundedAt === null ? 0 : this.deps.clock.now().getTime() - this.backgroundedAt;
    this.backgroundedAt = null;
    if (this.enabled && !this.isLocked && away >= LOCK_AFTER_MS) {
      this.isLocked = true;
      this.emit();
    }
  }
}
