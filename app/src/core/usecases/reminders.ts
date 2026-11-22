import { NettleError } from '../model/errors';
import { addDays, localDay, wallTimeOnDay } from '../model/time';
import type { ReminderSpec, ReminderStatus, ReminderTap } from '../ports/notifier';
import type { Deps } from './deps';
import { getCheckIn } from './checkin';
import { listActiveAreas } from './skin';
import { getPreferences } from './preferences';
import { logRegular, listRegular } from './regular';

/** SK-9 and the monthly backup nudge (Data, privacy and security): what the user switched on. */
export interface ReminderSettings {
  checkIn: { enabled: boolean; hour: number; minute: number };
  /** Weekly nail photo; only scheduled while nail areas exist. Weekday 1 = Sunday … 7 = Saturday. */
  nails: { enabled: boolean; weekday: number; hour: number; minute: number };
  /** Monthly "export your diary" reminder, on this day of the month (1 to 28 so every month has it). */
  backup: { enabled: boolean; day: number; hour: number; minute: number };
}

export const DEFAULT_REMINDERS: ReminderSettings = {
  checkIn: { enabled: false, hour: 21, minute: 0 },
  nails: { enabled: false, weekday: 1, hour: 10, minute: 0 },
  backup: { enabled: false, day: 1, hour: 10, minute: 0 },
};

/** Texts come from the app's translations; they must not contain diary data. */
export interface ReminderTexts {
  checkIn: { title: string; body: string };
  nails: { title: string; body: string };
  backup: { title: string; body: string };
  /** IN-17: a regular item's reminder shows its name unless the user hides it; never a dose or a note. */
  regular: {
    named: (name: string, kind: 'medication' | 'treatment') => { title: string; body: string };
    hidden: (kind: 'medication' | 'treatment') => { title: string; body: string };
    takenLabel: string;
    appliedLabel: string;
  };
}

/** SK-9: the Daily health reminder is scheduled for this many days ahead, one by one, so a day that already has a record can be skipped. */
export const CHECKIN_REMINDER_DAYS = 14;

const KEY = 'reminders';
const int = (n: unknown, min: number, max: number) => typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;

function valid(s: ReminderSettings): boolean {
  const time = (t: { hour: number; minute: number }) => int(t.hour, 0, 23) && int(t.minute, 0, 59);
  return (
    time(s.checkIn) &&
    time(s.nails) &&
    int(s.nails.weekday, 1, 7) &&
    time(s.backup) &&
    int(s.backup.day, 1, 28) &&
    [s.checkIn.enabled, s.nails.enabled, s.backup.enabled].every((b) => typeof b === 'boolean')
  );
}

/** Stored settings, or the defaults when nothing valid is stored. */
export async function loadReminderSettings(deps: Deps): Promise<ReminderSettings> {
  const raw = await deps.settings.get(KEY);
  if (!raw) return structuredCloneSettings(DEFAULT_REMINDERS);
  try {
    const parsed = JSON.parse(raw) as ReminderSettings;
    return valid(parsed) ? parsed : structuredCloneSettings(DEFAULT_REMINDERS);
  } catch {
    return structuredCloneSettings(DEFAULT_REMINDERS);
  }
}

const structuredCloneSettings = (s: ReminderSettings): ReminderSettings => JSON.parse(JSON.stringify(s)) as ReminderSettings;

/**
 * The reminders that should exist now: the switched-on ones, the nail one only while nail areas exist, one per
 * reminder time of each regular item, and the Daily health reminder for the next days except today when today
 * already has its record (SK-9: saving the record reschedules it).
 */
export async function plannedReminders(deps: Deps, texts: ReminderTexts): Promise<ReminderSpec[]> {
  const s = await loadReminderSettings(deps);
  const specs: ReminderSpec[] = [];
  if (s.checkIn.enabled) {
    const now = deps.clock.now();
    const tz = deps.clock.timeZone(); // one time zone for the clock time and the diary day (SK-9)
    const today = localDay(now.toISOString(), tz, 0);
    for (let i = 0; i < CHECKIN_REMINDER_DAYS; i++) {
      const at = wallTimeOnDay(addDays(today, i) ?? today, s.checkIn.hour, s.checkIn.minute, tz);
      if (!at || at.getTime() <= now.getTime()) continue;
      if (i === 0 && (await getCheckIn(deps, localDay(at.toISOString(), tz, deps.dayStart.get())))) continue;
      specs.push({ id: `checkin-${i}`, target: 'checkin', ...texts.checkIn, when: { type: 'at', at } });
    }
  }
  if (s.nails.enabled && (await listActiveAreas(deps, 'nail')).length > 0) {
    specs.push({ id: 'nails', ...texts.nails, when: { type: 'weekly', weekday: s.nails.weekday, hour: s.nails.hour, minute: s.nails.minute } });
  }
  if (s.backup.enabled) {
    specs.push({ id: 'backup', ...texts.backup, when: { type: 'monthly', day: s.backup.day, hour: s.backup.hour, minute: s.backup.minute } });
  }
  const treatments = new Map((await deps.repo.listItems('treatments')).map((t) => [t.id, t.nameOverride ?? t.name]));
  for (const r of (await getPreferences(deps)).regular) {
    const name = r.kind === 'medication' ? r.name : (treatments.get(r.treatmentId ?? '') ?? null);
    const text = r.hideName || !name ? texts.regular.hidden(r.kind) : texts.regular.named(name, r.kind);
    r.times.forEach((t, i) =>
      specs.push({
        id: `regular-${r.id}-${i}`,
        target: 'regular',
        itemId: r.id,
        actionLabel: r.kind === 'medication' ? texts.regular.takenLabel : texts.regular.appliedLabel,
        ...text,
        when: { type: 'daily', hour: t.hour, minute: t.minute },
      }),
    );
  }
  return specs;
}

/** Makes the scheduled notifications match the settings and the current areas. Safe to call often. */
export async function applyReminders(deps: Deps, texts: ReminderTexts): Promise<void> {
  await deps.notifier.replaceAll(await plannedReminders(deps, texts));
}

/**
 * Saves new settings and applies them. Switching a reminder on asks for notification permission; when it is
 * refused nothing is saved and `notifications_denied` is thrown, so the switch does not lie.
 */
export async function saveReminderSettings(deps: Deps, next: ReminderSettings, texts: ReminderTexts): Promise<void> {
  if (!valid(next)) throw new NettleError('invalid_value', 'reminders');
  if ((next.checkIn.enabled || next.nails.enabled || next.backup.enabled) && !(await deps.notifier.requestPermission())) {
    throw new NettleError('notifications_denied');
  }
  await deps.settings.set(KEY, JSON.stringify(next));
  await applyReminders(deps, texts);
}

/** SK-9: the permission and the number of scheduled reminders, so a silent failure can be seen. */
export async function reminderStatus(deps: Deps): Promise<ReminderStatus> {
  return deps.notifier.status(); // async, so a notifier that fails becomes a rejection the screen can ignore
}

/**
 * SK-9: one notification a few seconds from now, with fixed text and no diary data. Asks for permission first;
 * `notifications_denied` when it is refused.
 */
export async function sendTestReminder(deps: Deps, title: string, body: string): Promise<void> {
  if (!(await deps.notifier.requestPermission())) throw new NettleError('notifications_denied');
  await deps.notifier.sendTest(title, body);
}

/** SK-9: where a tap leads. `viaToday` opens the Today tab first, so closing the form lands there. */
export interface TapAction {
  route: { pathname: string; params?: Record<string, string> };
  viaToday: boolean;
  /** IN-17: the action button of a regular item's reminder could not log it; the screen says so. */
  notLogged?: boolean;
}

const TAP_MARKER = 'lastReminderTap';

/**
 * SK-9: what to do with a tap on a reminder. The target comes from a fixed list and is never a URL. Returns null
 * when nothing should happen: a repeat of a tap already handled (Expo returns the last response again at launch),
 * an unknown target, or a form with unsaved changes (the cards on Today cover it). A tap is marked handled even
 * when it does nothing, so it is handled once per reminder.
 *
 * - checkin: the check-in form for the day the reminder was delivered; just Today when that day already has its record.
 * - nails: the nail update form; just Today when no nail area remains.
 * - backup: Data and backup; it never exports by itself.
 */
export async function resolveReminderTap(
  deps: Deps,
  tap: ReminderTap,
  options: { hasUnsavedForm: boolean },
): Promise<TapAction | null> {
  // Without a delivery time, the day of the tap stands in, so a daily reminder is still handled once per day.
  const when = tap.deliveredAt?.getTime() ?? `day-${localDay(deps.clock.now().toISOString(), deps.clock.timeZone(), 0)}`;
  const marker = `${tap.id}|${tap.action ?? ''}|${when}`;
  if ((await deps.settings.get(TAP_MARKER)) === marker) return null;
  await deps.settings.set(TAP_MARKER, marker);
  // IN-17: the action button of a regular item's reminder logs it, whatever form is open.
  if (tap.target === 'regular' && tap.action === 'log' && typeof tap.itemId === 'string') {
    // A stopped item or a removed area: nothing is logged, the tap never crashes, and the person is told.
    const logged = await logRegular(deps, tap.itemId).then(
      () => true,
      () => false,
    );
    return logged ? { route: { pathname: '/today' }, viaToday: false } : { route: { pathname: '/today' }, viaToday: false, notLogged: true };
  }
  if (options.hasUnsavedForm) return null;
  const today: TapAction = { route: { pathname: '/today' }, viaToday: false };
  switch (tap.target) {
    case 'checkin': {
      const at = tap.deliveredAt ?? deps.clock.now();
      const day = localDay(at.toISOString(), deps.clock.timeZone(), deps.dayStart.get());
      if (await getCheckIn(deps, day)) return today; // SK-9: the day already has its Daily health record
      return { route: { pathname: '/form/checkin', params: { day } }, viaToday: true };
    }
    case 'nails':
      return (await listActiveAreas(deps, 'nail')).length > 0 ? { route: { pathname: '/form/nails' }, viaToday: true } : today;
    case 'backup':
      return { route: { pathname: '/settings/data' }, viaToday: false };
    case 'regular': {
      // IN-17: the quick sheet of regular items, on Today
      const kind = (await listRegular(deps)).find((r) => r.id === tap.itemId)?.kind;
      return kind ? { route: { pathname: '/today', params: { sheet: kind } }, viaToday: false } : today;
    }
    default:
      return null;
  }
}

/**
 * IN-17: after an import the scheduled notifications are rebuilt from the imported regular items. Anything that
 * needs reminders asks for notification permission again (the permission belongs to this phone, not to the file).
 * Returns false when permission was refused; the items stay, only the reminders are not scheduled.
 */
export async function restoreReminders(deps: Deps, texts: ReminderTexts): Promise<boolean> {
  const wanted = (await listRegular(deps)).some((r) => r.times.length > 0);
  const allowed = !wanted || (await deps.notifier.requestPermission());
  await applyReminders(deps, texts);
  return allowed;
}
