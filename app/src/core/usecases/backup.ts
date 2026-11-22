import { NettleError } from '../model/errors';
import type { Photo } from '../model/types';
import { DAY_MS, localDay, localDaysToRange } from '../model/time';
import type { PhotoSelection } from '../export/photoSelection';
import type { Deps } from './deps';
import { LOG_KINDS } from './dayLog';
import type { ExportOptions } from './exchange';
import { SETTING_KEYS } from './settingsStore';

const LAST_EXPORT = SETTING_KEYS.lastExport;
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
  return last === null ? null : { from: localDay(last, deps.clock.timeZone(), deps.dayStart.get()) };
}

/**
 * EX-14: the two export presets. Doctor report (Review): records in a date range, the PDF, sensitive photos
 * left out unless asked for. Full backup (Settings): records and settings, all photos including sensitive
 * ones, optional password, no PDF, for backup and migration.
 */
export type ExportPreset =
  | {
      kind: 'doctor';
      days?: { from?: string; to?: string };
      report: NonNullable<ExportOptions['report']>;
      photos?: PhotoSelection;
      csv?: boolean;
      /** LL-14 */ summaryId?: string;
    }
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
    ...(preset.summaryId ? { summaryId: preset.summaryId } : {}),
  };
}

export interface ReportPreview {
  /** Diary entries in the period (photos and AI analyses are counted apart or not at all). */
  entries: number;
  photos: number;
  sensitivePhotos: number;
}

/** EX-14: what a Doctor report for these local days would hold, so the screen can show counts before sharing. */
export async function reportPreview(deps: Deps, days: { from?: string; to?: string }): Promise<ReportPreview> {
  const range = localDaysToRange(days.from, days.to, deps.clock.timeZone(), deps.dayStart.get());
  if (!range) throw new NettleError('invalid_range');
  const snap = await deps.repo.snapshot(range);
  const entries = LOG_KINDS.reduce((n, k) => n + snap[k].length, 0);
  const ids = new Set([...snap.skinEntries, ...snap.nailEntries].map((e) => e.id));
  const photos = (await deps.repo.listRecords('photos')).filter((p) => ids.has(p.entryId));
  return { entries, photos: photos.length, sensitivePhotos: photos.filter((p) => p.sensitive).length };
}

/** EX-4, EX-7: the photos a Doctor report for these days could hold, newest last, each with the area of its entry, to pick from one by one. */
export async function reportPhotos(deps: Deps, days: { from?: string; to?: string }): Promise<{ photo: Photo; areaId: string | null }[]> {
  const range = localDaysToRange(days.from, days.to, deps.clock.timeZone(), deps.dayStart.get());
  if (!range) throw new NettleError('invalid_range');
  const snap = await deps.repo.snapshot(range);
  const areaOf = new Map([...snap.skinEntries, ...snap.nailEntries].map((e) => [e.id, e.areaId]));
  return (await deps.repo.listRecords('photos'))
    .filter((p) => areaOf.has(p.entryId))
    .sort((a, b) => a.at.utc.localeCompare(b.at.utc) || a.id.localeCompare(b.id))
    .map((photo) => ({ photo, areaId: areaOf.get(photo.entryId) ?? null }));
}
