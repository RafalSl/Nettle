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

/** Predefined areas are localized by id; user-created areas show their own name. */
export function areaLabel(area: { id: string; name: string; predefined: boolean }): string {
  return area.predefined ? t(`areas.${area.id}`) : area.name;
}
