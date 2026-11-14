import type { Notifier, ReminderSpec } from '@/core/ports/notifier';

export class FakeNotifier implements Notifier {
  scheduled: ReminderSpec[] = [];
  granted = true;
  permissionRequests = 0;
  async requestPermission() {
    this.permissionRequests++;
    return this.granted;
  }
  async replaceAll(specs: ReminderSpec[]) {
    this.scheduled = specs.map((s) => ({ ...s }));
  }
}
