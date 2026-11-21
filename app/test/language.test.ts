import { parsePreferences, preferencesToJson } from '@/core/export/preferencesJson';
import { NettleError } from '@/core/model/errors';
import { resolveLanguage } from '@/core/model/language';
import { defaultPreferences } from '@/core/model/preferences';
import { getPreferences, setLanguage as saveLanguage } from '@/core/usecases/preferences';
import { currentLanguage, setLanguage, t } from '@/i18n';
import { MemoryRepo } from './fakes/memoryRepo';
import { makeDeps } from './helpers/fixtures';

describe('language setting (UX-7, NF-6, LL-11)', () => {
  it('UX-7 Device language gives Polish only on a Polish device; an explicit choice wins', () => {
    expect(resolveLanguage('system', 'pl')).toBe('pl');
    expect(resolveLanguage('system', 'pl-PL')).toBe('pl');
    expect(resolveLanguage('system', 'en')).toBe('en');
    expect(resolveLanguage('system', 'de')).toBe('en'); // another language: English
    expect(resolveLanguage('system', null)).toBe('en');
    expect(resolveLanguage('en', 'pl')).toBe('en');
    expect(resolveLanguage('pl', 'en')).toBe('pl');
  });

  it('UX-7 the default is Device language, and a choice is stored with the preferences', async () => {
    const deps = makeDeps(new MemoryRepo());
    expect((await getPreferences(deps)).language).toBe('system');
    expect(await saveLanguage(deps, 'pl')).toBe('pl');
    expect((await getPreferences(deps)).language).toBe('pl');
    await expect(saveLanguage(deps, 'de' as never)).rejects.toBeInstanceOf(NettleError);
  });

  it('UX-7, EX-1 the language travels in the settings part and is validated on the way in', () => {
    const p = { ...defaultPreferences(), language: 'pl' as const };
    const json = JSON.parse(JSON.stringify(preferencesToJson(p)));
    expect(json.language).toBe('pl');
    expect(parsePreferences(json, 'preferences')).toEqual(p);
    expect(() => parsePreferences({ ...json, language: 'de' }, 'preferences')).toThrow();
  });

  it('UX-7, LL-11 switching the language changes t() and currentLanguage() at once', () => {
    try {
      setLanguage('pl');
      expect(currentLanguage()).toBe('pl');
      expect(t('nav.language')).toBe('Język');
      setLanguage('en');
      expect(currentLanguage()).toBe('en');
      expect(t('nav.language')).toBe('Language');
    } finally {
      setLanguage('en');
    }
  });
});
