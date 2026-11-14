/** NF-7: the hours a diary day may start at: midnight to 06:00. */
export const DAY_START_HOURS = [0, 1, 2, 3, 4, 5, 6] as const;
export const isDayStartHour = (h: unknown): h is (typeof DAY_START_HOURS)[number] =>
  typeof h === 'number' && (DAY_START_HOURS as readonly number[]).includes(h);

/**
 * NF-7: the current "Day starts at" hour, held in memory so every use case and screen groups by day the same way
 * without reading the database each time. The stored setting (`Preferences.dayStartHour`) is the source of truth;
 * the composition root creates this from it, and `setDayStartHour`, imports and merges keep it current.
 */
export class DayStart {
  private hour = 0;
  constructor(hour = 0) {
    this.set(hour);
  }
  get(): number {
    return this.hour;
  }
  set(hour: number): void {
    this.hour = isDayStartHour(hour) ? hour : 0;
  }
}
