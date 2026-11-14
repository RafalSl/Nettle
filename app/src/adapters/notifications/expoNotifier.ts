import * as Notifications from 'expo-notifications';
import type { Notifier, ReminderSpec } from '@/core/ports/notifier';

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

  async replaceAll(specs) {
    await Notifications.cancelAllScheduledNotificationsAsync();
    for (const s of specs) {
      await Notifications.scheduleNotificationAsync({
        identifier: s.id,
        content: { title: s.title, body: s.body },
        trigger: trigger(s.when),
      });
    }
  },
};
