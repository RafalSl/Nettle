import * as Notifications from 'expo-notifications';
import type { Notifier, ReminderSpec, ReminderStatus, ReminderTap } from '@/core/ports/notifier';

const LOG_ACTION = 'log';

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
    case 'at':
      return { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when.at };
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

  async status(): Promise<ReminderStatus> {
    const p = await Notifications.getPermissionsAsync();
    const scheduled = (await Notifications.getAllScheduledNotificationsAsync()).length;
    return { permission: p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied', scheduled };
  },

  async sendTest(title, body) {
    await Notifications.scheduleNotificationAsync({
      identifier: 'test-reminder',
      content: { title, body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5 },
    });
  },

  onTap(handler) {
    const toTap = (r: Notifications.NotificationResponse): ReminderTap | null => {
      const logged = r.actionIdentifier === LOG_ACTION;
      if (!logged && r.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return null;
      // `notification.date` may be in seconds or milliseconds (to be verified on a device); both are accepted.
      const raw = r.notification.date;
      return {
        id: r.notification.request.identifier,
        target: r.notification.request.content.data?.target,
        deliveredAt: typeof raw === 'number' ? new Date(raw < 1e11 ? raw * 1000 : raw) : null,
        action: logged ? 'log' : null,
        itemId: typeof r.notification.request.content.data?.itemId === 'string' ? r.notification.request.content.data.itemId : null,
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
      // IN-17: the one action button (Taken, Applied); it opens the app, which logs the item when the tap is handled.
      let categoryIdentifier: string | undefined;
      if (s.actionLabel) {
        categoryIdentifier = `log-${s.actionLabel.replace(/\W/g, '_')}`;
        await Notifications.setNotificationCategoryAsync(categoryIdentifier, [{ identifier: LOG_ACTION, buttonTitle: s.actionLabel, options: { opensAppToForeground: true } }]);
      }
      await Notifications.scheduleNotificationAsync({
        identifier: s.id,
        content: {
          title: s.title,
          body: s.body,
          // only an id from a fixed list and an item id, never an entry or a URL
          data: { target: s.target ?? s.id, ...(s.itemId ? { itemId: s.itemId } : {}) },
          ...(categoryIdentifier ? { categoryIdentifier } : {}),
        },
        trigger: trigger(s.when),
      });
    }
  },
};
