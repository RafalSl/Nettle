import { NettleError } from '../model/errors';
import type { RegularItem, ReminderTime } from '../model/preferences';
import type { Deps } from './deps';
import { setRegularHideName, setRegularTimes, stopRegular } from './regular';
import { applyReminders, type ReminderTexts } from './reminders';

/**
 * IN-17: set the reminder times of a regular item and schedule the notifications. Adding a time asks for
 * notification permission; when it is refused nothing is saved and `notifications_denied` is thrown.
 */
export async function saveRegularReminders(deps: Deps, id: string, times: ReminderTime[], texts: ReminderTexts): Promise<RegularItem> {
  if (times.length > 0 && !(await deps.notifier.requestPermission())) throw new NettleError('notifications_denied');
  const item = await setRegularTimes(deps, id, times);
  await applyReminders(deps, texts);
  return item;
}

/** IN-17: stop a regular item and drop its notifications. */
export async function stopRegularAndRemind(deps: Deps, id: string, texts: ReminderTexts): Promise<void> {
  await stopRegular(deps, id);
  await applyReminders(deps, texts);
}

/** IN-17: hide or show the name of an item in its notifications and reschedule them. */
export async function saveRegularHideName(deps: Deps, id: string, hide: boolean, texts: ReminderTexts): Promise<RegularItem> {
  const item = await setRegularHideName(deps, id, hide);
  await applyReminders(deps, texts);
  return item;
}
