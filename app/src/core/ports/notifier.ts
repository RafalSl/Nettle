/** When a reminder fires. Weekdays use the iOS numbering: 1 = Sunday … 7 = Saturday. */
export type ReminderWhen =
  | { type: 'daily'; hour: number; minute: number }
  | { type: 'at'; at: Date }
  | { type: 'weekly'; weekday: number; hour: number; minute: number }
  | { type: 'monthly'; day: number; hour: number; minute: number };

export interface ReminderSpec {
  id: string;
  title: string;
  body: string;
  when: ReminderWhen;
  /** The fixed place a tap leads to ('checkin', 'nails', 'backup', 'regular'); defaults to the id. */
  target?: string;
  /** IN-17: the regular item a reminder is for. Never shown in the text unless the user allows it. */
  itemId?: string;
  /** IN-17: the label of the one action button (Taken, Applied); a tap on it logs the item. */
  actionLabel?: string;
}

/** SK-9: a tap on a reminder. `target` is the untrusted `data.target` of the notification, `deliveredAt` its delivery time when known. */
export interface ReminderTap {
  /** The notification's identifier (the reminder id). */
  id: string;
  target: unknown;
  deliveredAt: Date | null;
  /** IN-17: 'log' when the user pressed the action button of a regular item's reminder. */
  action?: 'log' | null;
  /** IN-17: the regular item of the reminder. */
  itemId?: string | null;
}

/** SK-9: what the phone says about reminders, for a self-check in Settings. */
export interface ReminderStatus {
  permission: 'granted' | 'denied' | 'undetermined';
  /** How many reminders are scheduled with the system right now. */
  scheduled: number;
}

/** SK-9: local notifications only (no push, no server). Texts never contain diary data. */
export interface Notifier {
  /**
   * Calls `handler` for every tap on a reminder, including the one that launched the app, and clears the stored
   * last response after the handler returned. Returns the unsubscribe function.
   */
  onTap(handler: (tap: ReminderTap) => void | Promise<void>): () => void;
  /** Asks the user for permission if needed; true when reminders may be shown. */
  requestPermission(): Promise<boolean>;
  /** What the system holds: the permission and the number of scheduled reminders. */
  status(): Promise<ReminderStatus>;
  /** Shows one notification a few seconds from now, to check that this phone shows them at all. */
  sendTest(title: string, body: string): Promise<void>;
  /** Cancels every reminder the app scheduled and schedules exactly these. */
  replaceAll(specs: ReminderSpec[]): Promise<void>;
}
