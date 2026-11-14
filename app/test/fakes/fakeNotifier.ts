import type { Notifier, ReminderSpec, ReminderTap } from '@/core/ports/notifier';

export class FakeNotifier implements Notifier {
  scheduled: ReminderSpec[] = [];
  granted = true;
  permissionRequests = 0;
  async requestPermission() {
    this.permissionRequests++;
    return this.granted;
  }
  handler: ((tap: ReminderTap) => void | Promise<void>) | null = null;
  onTap(handler: (tap: ReminderTap) => void | Promise<void>) {
    this.handler = handler;
    return () => {
      this.handler = null;
    };
  }
  /** Test helper: the user taps a reminder. */
  async tap(tap: ReminderTap) {
    await this.handler?.(tap);
  }
  async replaceAll(specs: ReminderSpec[]) {
    this.scheduled = specs.map((s) => ({ ...s }));
  }
}
