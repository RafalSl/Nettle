import { getLocales } from 'expo-localization';
import { I18n } from 'i18n-js';
import { NettleError } from '@/core/model/errors';
import en from './en.json';
import pl from './pl.json';

const i18n = new I18n({ en, pl });
i18n.defaultLocale = 'en';
i18n.enableFallback = true;
i18n.locale = getLocales()[0]?.languageCode ?? 'en';

export const t = (key: string, options?: Record<string, string | number>): string =>
  i18n.t(key, options);

/** Maps a thrown error to localized text; unknown errors get the generic message (details are never shown or logged). */
export function errorMessage(e: unknown): string {
  return t(e instanceof NettleError ? `errors.${e.code}` : 'errors.generic');
}

/** SK-2: the user's override wins; otherwise predefined areas are localized by id and user areas show their name. */
export function areaLabel(area: {
  id: string;
  name: string;
  predefined: boolean;
  nameOverride: string | null;
}): string {
  return area.nameOverride ?? (area.predefined ? t(`areas.${area.id}`) : area.name);
}

/** IN-6 / IN-11: same rule for list items such as daily tags; treatments are always user items. */
export function itemLabel(item: { id: string; name: string; predefined: boolean; nameOverride: string | null }): string {
  return item.nameOverride ?? (item.predefined ? t(`tags.${item.id}`) : item.name);
}

/** LL-11: the language LLM answers should use; follows the app language. */
export function currentLanguage(): 'en' | 'pl' {
  return i18n.locale.startsWith('pl') ? 'pl' : 'en';
}
