import type { LlmAction } from '../llm/actions';
import type { Deps } from './deps';

/**
 * Every key the app keeps in the device settings store (`deps.settings`). These values stay on this phone and are
 * not part of an export. The stored names are kept as they are, so a phone keeps its settings after an update.
 */
export const SETTING_KEYS = {
  /** SE-8: "1" while the app lock is on. */
  appLock: 'appLockEnabled',
  /** EX-11: UTC time of the last shared export. */
  lastExport: 'lastExportAt',
  /** SK-9: the reminder switches and times (JSON). */
  reminders: 'reminders',
  /** SK-9: the last reminder tap handled, so Expo's repeat of it at launch does nothing. */
  lastReminderTap: 'lastReminderTap',
  /** IN-10: allergen suggestions asked before, per ingredient name (JSON). */
  allergenCache: 'allergen_cache',
  /** LL-15, IN-20: packs made, results imported and suggestions waiting (JSON). */
  aiPack: 'ai_pack_state',
  /** LL-9: the model chosen for one action. */
  llmModel: (action: LlmAction) => `llm_model.${action}`,
} as const;

/**
 * Reads a JSON value from the settings store. `parse` gets the parsed JSON and returns the value or null when it
 * does not have the expected shape; nothing stored, broken JSON and a wrong shape all give `fallback()`.
 */
export async function readJsonSetting<T>(deps: Deps, key: string, parse: (raw: unknown) => T | null, fallback: () => T): Promise<T> {
  try {
    const raw = await deps.settings.get(key);
    if (!raw) return fallback();
    return parse(JSON.parse(raw)) ?? fallback();
  } catch {
    return fallback();
  }
}

export const writeJsonSetting = (deps: Deps, key: string, value: unknown): Promise<void> => deps.settings.set(key, JSON.stringify(value));
