import { getLocales } from 'expo-localization';
import { I18n } from 'i18n-js';
import { useSyncExternalStore } from 'react';
import { NettleError } from '@/core/model/errors';
import { resolveLanguage, type Language, type LanguagePreference } from '@/core/model/language';
import type { ReminderTexts } from '@/core/usecases/reminders';
import en from './en.json';
import pl from './pl.json';

const i18n = new I18n({ en, pl });
i18n.defaultLocale = 'en';
i18n.enableFallback = true;
i18n.locale = getLocales()[0]?.languageCode ?? 'en';

const listeners = new Set<() => void>();

/** UX-7: the language of the device (iOS setting, or whatever Expo Go serves). */
export const deviceLanguage = (): Language => resolveLanguage('system', getLocales()[0]?.languageCode);

/** UX-7: applies the Language setting: every later `t()` call follows it, and `useAppLanguage` subscribers re-render. */
export function setLanguage(preference: LanguagePreference): void {
  const next = resolveLanguage(preference, getLocales()[0]?.languageCode);
  if (i18n.locale === next) return;
  i18n.locale = next;
  listeners.forEach((l) => l());
}

/** UX-7: the app language as React state; the navigation root is keyed by it, so every screen redraws after a change. */
export function useAppLanguage(): Language {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    () => (i18n.locale.startsWith('pl') ? 'pl' : 'en'),
  );
}

export const t = (key: string, options?: Record<string, string | number>): string => i18n.t(key, options);

/** Maps a thrown error to localized text; unknown errors get the generic message (details are never shown or logged). */
export function errorMessage(e: unknown): string {
  return t(e instanceof NettleError ? `errors.${e.code}` : 'errors.generic');
}

/** SK-2: the user's override wins; otherwise predefined areas are localized by id and user areas show their name. */
export function areaLabel(area: { id: string; name: string; predefined: boolean; nameOverride: string | null }): string {
  return area.nameOverride ?? (area.predefined ? t(`areas.${area.id}`) : area.name);
}

/** IN-6 / IN-11: same rule for list items such as daily tags; treatments are always user items. */
export function itemLabel(item: { id: string; name: string; predefined: boolean; nameOverride: string | null }): string {
  return item.nameOverride ?? (item.predefined ? t(`tags.${item.id}`) : item.name);
}

/** SK-7, UX-11: a short description of a Daily health item: by id for predefined items, the user's text otherwise. */
export function itemDescription(item: { id: string; predefined: boolean; description: string | null }): string | null {
  if (!item.predefined) return item.description;
  const key = `itemDescriptions.${item.id}`;
  const text = t(key);
  return text.startsWith('[missing') ? null : text;
}

/** UX-2: the weekday and the short date of a diary day ("YYYY-MM-DD") in the app language, for the centre of the ring. */
export function dayParts(day: string): { weekday: string; date: string } {
  const locale = i18n.locale.startsWith('pl') ? 'pl-PL' : 'en-GB';
  const at = new Date(`${day}T12:00:00Z`);
  return {
    weekday: at.toLocaleDateString(locale, { weekday: 'long', timeZone: 'UTC' }),
    date: at.toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).replace('.', ''),
  };
}

/** LL-11: the language LLM answers should use; follows the app language. */
export function currentLanguage(): 'en' | 'pl' {
  return i18n.locale.startsWith('pl') ? 'pl' : 'en';
}

/** EX-3: text in a chosen language, independent of the app language (the report language is chosen at export time). */
export const tIn = (language: 'en' | 'pl', key: string, options?: Record<string, string | number>): string =>
  i18n.t(key, { ...options, locale: language });

/** Area and list item names in a chosen language (same rule as `areaLabel` and `itemLabel`). */
export const areaLabelIn = (
  language: 'en' | 'pl',
  area: { id: string; name: string; predefined: boolean; nameOverride: string | null },
): string => area.nameOverride ?? (area.predefined ? tIn(language, `areas.${area.id}`) : area.name);
export const itemLabelIn = (
  language: 'en' | 'pl',
  item: { id: string; name: string; predefined: boolean; nameOverride: string | null },
): string => item.nameOverride ?? (item.predefined ? tIn(language, `tags.${item.id}`) : item.name);

/** SK-9: reminder texts in the app language. They never contain diary data. */
export function reminderTexts(): ReminderTexts {
  return {
    checkIn: { title: t('reminders.text.checkInTitle'), body: t('reminders.text.checkInBody') },
    nails: { title: t('reminders.text.nailsTitle'), body: t('reminders.text.nailsBody') },
    backup: { title: t('reminders.text.backupTitle'), body: t('reminders.text.backupBody') },
    regular: {
      named: (name, kind) => ({ title: t(`reminders.text.${kind}Named`, { name }), body: t('reminders.text.regularBody') }),
      hidden: (kind) => ({ title: t(`reminders.text.${kind}Hidden`), body: t('reminders.text.regularBody') }),
      takenLabel: t('reminders.text.taken'),
      appliedLabel: t('reminders.text.applied'),
    },
  };
}
