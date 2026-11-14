import * as Notifications from 'expo-notifications';
import type { Notifier, ReminderSpec, ReminderTap } from '@/core/ports/notifier';

// A reminder that fires while the app is open is shown as a banner, without sound.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

const trigger = (when: ReminderSpec['when']): Notifications.SchedulableNotificationTriggerInput => {
  switch (when.type) {
    case 'daily':
      return { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: when.hour, minute: when.minute };
    case 'weekly':
      return { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: when.weekday, hour: when.hour, minute: when.minute };
    case 'monthly':
      return { type: Notifications.SchedulableTriggerInputTypes.MONTHLY, day: when.day, hour: when.hour, minute: when.minute };
  }
};

/** SK-9: iOS local notifications through expo-notifications (works in Expo Go). */
export const expoNotifier: Notifier = {
  async requestPermission() {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
  },

  onTap(handler) {
    const toTap = (r: Notifications.NotificationResponse): ReminderTap | null => {
      if (r.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return null;
      // `notification.date` may be in seconds or milliseconds (to be verified on a device); both are accepted.
      const raw = r.notification.date;
      return {
        id: r.notification.request.identifier,
        target: r.notification.request.content.data?.target,
        deliveredAt: typeof raw === 'number' ? new Date(raw < 1e11 ? raw * 1000 : raw) : null,
      };
    };
    const handle = async (r: Notifications.NotificationResponse | null) => {
      const tap = r && toTap(r);
      if (!tap) return;
      try {
        await handler(tap);
      } finally {
        // Expo returns the last response again at launch; clear it so the form does not reopen on every start.
        await Notifications.clearLastNotificationResponseAsync();
      }
    };
    void Notifications.getLastNotificationResponseAsync().then(handle).catch(() => undefined); // the tap that launched the app
    const sub = Notifications.addNotificationResponseReceivedListener((r) => void handle(r));
    return () => sub.remove();
  },

  async replaceAll(specs) {
    await Notifications.cancelAllScheduledNotificationsAsync();
    for (const s of specs) {
      await Notifications.scheduleNotificationAsync({
        identifier: s.id,
        content: { title: s.title, body: s.body, data: { target: s.id } }, // only an id from a fixed list, never an entry or a URL
        trigger: trigger(s.when),
      });
    }
  },
};
