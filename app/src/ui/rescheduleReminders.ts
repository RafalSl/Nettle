import { applyReminders } from '@/core/usecases/reminders';
import type { Deps } from '@/core/usecases/deps';
import { reminderTexts } from '@/i18n';

/**
 * SK-9: schedules the reminders again after the diary changed in a way they depend on (today's Daily health record
 * was saved, moved or deleted, or records were imported or deleted). A convenience: a failure never blocks the change.
 */
export const rescheduleReminders = (deps: Deps): Promise<void> => applyReminders(deps, reminderTexts()).catch(() => undefined);
