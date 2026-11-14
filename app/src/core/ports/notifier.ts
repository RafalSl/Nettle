/** When a reminder fires. Weekdays use the iOS numbering: 1 = Sunday … 7 = Saturday. */
export type ReminderWhen =
  | { type: 'daily'; hour: number; minute: number }
  | { type: 'weekly'; weekday: number; hour: number; minute: number }
  | { type: 'monthly'; day: number; hour: number; minute: number };

export interface ReminderSpec {
  id: string;
  title: string;
  body: string;
  when: ReminderWhen;
}

/** SK-9: local notifications only (no push, no server). Texts never contain diary data. */
export interface Notifier {
  /** Asks the user for permission if needed; true when reminders may be shown. */
  requestPermission(): Promise<boolean>;
  /** Cancels every reminder the app scheduled and schedules exactly these. */
  replaceAll(specs: ReminderSpec[]): Promise<void>;
}
