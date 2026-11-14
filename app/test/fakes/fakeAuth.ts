import type { Authenticator } from '@/core/ports/auth';

/** Scripted authenticator: `available` and `passes` can be changed by a test; every prompt is recorded. */
export class FakeAuth implements Authenticator {
  hasLock = true;
  passes = true;
  prompts: string[] = [];
  async available() {
    return this.hasLock;
  }
  async authenticate(reason: string) {
    this.prompts.push(reason);
    return this.passes;
  }
}
