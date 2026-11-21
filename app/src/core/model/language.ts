/** UX-7: the Language setting. "system" follows the device language. */
export const LANGUAGE_PREFERENCES = ['system', 'en', 'pl'] as const;
export type LanguagePreference = (typeof LANGUAGE_PREFERENCES)[number];
export type Language = 'en' | 'pl';

/** UX-7: the language the app text uses: Polish for "pl", or for "system" on a device set to Polish; English otherwise. */
export function resolveLanguage(preference: LanguagePreference, deviceLanguageCode: string | null | undefined): Language {
  if (preference === 'en' || preference === 'pl') return preference;
  return deviceLanguageCode?.toLowerCase().startsWith('pl') ? 'pl' : 'en';
}
