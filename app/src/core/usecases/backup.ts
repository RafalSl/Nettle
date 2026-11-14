import { localDay } from '../model/time';
import type { PhotoSelection } from '../export/photoSelection';
import type { Deps } from './deps';
import type { ExportOptions } from './exchange';

const LAST_EXPORT = 'lastExportAt';
const DAY_MS = 86_400_000;
/** UX-2: the Today card appears when the last export is older than this many days. */
export const BACKUP_CARD_DAYS = 7;

/** UTC time of the last export that was shared, or null. Not part of an export. */
export async function getLastExport(deps: Deps): Promise<string | null> {
  return deps.settings.get(LAST_EXPORT);
}

/** EX-11: call after the share sheet confirmed, so a cancelled share does not count as a backup. */
export async function markExported(deps: Deps): Promise<void> {
  await deps.settings.set(LAST_EXPORT, deps.clock.now().toISOString());
}

/** UX-2: whole days since the last export, or null when there has been none. */
export async function daysSinceExport(deps: Deps): Promise<number | null> {
  const last = await getLastExport(deps);
  return last === null ? null : Math.floor((deps.clock.now().getTime() - Date.parse(last)) / DAY_MS);
}

/** UX-2: show the backup card on Today (no export yet counts as due). */
export async function backupCardDue(deps: Deps): Promise<boolean> {
  const days = await daysSinceExport(deps);
  return days === null || days > BACKUP_CARD_DAYS;
}

/** EX-11: the local calendar days since the last export, ready for `ExportOptions.days`; null before the first export. */
export async function sinceLastExport(deps: Deps): Promise<{ from: string } | null> {
  const last = await getLastExport(deps);
  return last === null ? null : { from: localDay(last, deps.clock.timeZone()) };
}

/**
 * EX-14: the two export presets. Doctor report (Review): records in a date range, the PDF, sensitive photos
 * left out unless asked for. Full backup (Settings): records and settings, all photos including sensitive
 * ones, optional password, no PDF, for backup and migration.
 */
export type ExportPreset =
  | { kind: 'doctor'; days?: { from?: string; to?: string }; report: NonNullable<ExportOptions['report']>; photos?: PhotoSelection; csv?: boolean }
  | { kind: 'backup'; password?: string };

export function presetOptions(preset: ExportPreset): ExportOptions {
  if (preset.kind === 'backup') {
    return { parts: { records: true, settings: true }, photos: { mode: 'all' }, password: preset.password };
  }
  return {
    days: preset.days,
    parts: { records: true, settings: false },
    photos: preset.photos ?? { mode: 'non_sensitive' },
    report: preset.report,
    csv: preset.csv,
  };
}
