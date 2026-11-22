/* eslint-disable @typescript-eslint/no-require-imports -- screens are loaded lazily, after the harness mocks are in place */
import { mount, press, hasText, nowDeps, toggle, flush } from './harness';
import { ActionSheetIOS, Alert } from 'react-native';
import { unzipSync } from 'fflate';
import { logMeal } from '@/core/usecases/logMeal';
import { logSkinEntry } from '@/core/usecases/skin';
import { addPhoto } from '@/core/usecases/photos';
import { applyImport, exportBundle, previewImport } from '@/core/usecases/exchange';
import { deleteEntry } from '@/core/usecases/entries';
import en from '@/i18n/en.json';
import { syntheticScores as scores } from '../helpers/fixtures';

describe('Data and backup (EX-14, EX-10, EX-13)', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());
  const data = () => require('@/app/settings/data');

  it('EX-14, EX-11 the full backup holds records, settings and sensitive photos, and remembers the export', async () => {
    const deps = nowDeps();
    const entry = await logSkinEntry(deps, { areaId: 'area-penis', scores });
    await addPhoto(deps, { entryKind: 'skinEntry', entryId: entry.id, sourceUri: 'secret' });
    const { tree, fileShare } = await mount(data, deps);
    expect(await deps.settings.get('lastExportAt')).toBeNull();
    await press(tree, en.data.backupButton);
    await flush();
    const [name, bytes] = fileShare.saveAndShare.mock.calls[0] as unknown as [string, Uint8Array];
    expect(name).toMatch(/^nettle-backup-\d{4}-\d{2}-\d{2}\.zip$/);
    const files = Object.keys(unzipSync(bytes));
    expect(files).toContain('data.json');
    expect(files.some((f) => f.startsWith('photos/'))).toBe(true);
    expect(await deps.settings.get('lastExportAt')).not.toBeNull();
  });

  it('EX-3 the report language starts as the app language', async () => {
    const { tree } = await mount(data, nowDeps());
    await toggle(tree, en.export.report);
    const english = tree.root.findAll((n) => n.props.accessibilityLabel === en.export.english)[0]!;
    expect(english.props.accessibilityState).toMatchObject({ selected: true });
  });

  it('EX-10, EX-13 the import preview counts tombstone skips, and the switch restores what this phone deleted', async () => {
    const phoneA = nowDeps();
    const meal = await logMeal(phoneA, { description: 'Synthetic oats', ingredients: [], at: new Date(Date.now() - 3600_000) });
    const backup = await exportBundle(phoneA);
    const phoneB = nowDeps();
    await applyImport(phoneB, await previewImport(phoneB, backup), { mode: 'replace', parts: { records: true, settings: true } });
    await deleteEntry(phoneB, 'meals', meal.id);
    const { tree } = await mount(data, phoneB, {
      saveAndShare: jest.fn(async () => undefined),
      pickFile: jest.fn(async () => backup as unknown as null),
    });
    await press(tree, en.data.importButton);
    await flush();
    expect(hasText(tree, en.data.tombstoneSkipped.replace('{{n}}', '1'))).toBe(true);
    await press(tree, en.data.merge);
    await flush();
    expect(await phoneB.repo.listRecords('meals')).toEqual([]); // skipped

    await press(tree, en.data.importButton);
    await flush();
    await toggle(tree, en.data.tombstoneRestore);
    await press(tree, en.data.merge);
    await flush();
    expect((await phoneB.repo.listRecords('meals')).map((m) => m.id)).toEqual([meal.id]);
    expect(await phoneB.repo.listTombstones()).toEqual([]);
  });
});

describe('Replace on import offers an export first (UX-6, UX-9)', () => {
  afterEach(() => jest.restoreAllMocks());
  it('UX-6 the Replace sheet has Export first before Replace, and replacing happens only after the person chooses it', async () => {
    const source = nowDeps();
    await logMeal(source, { description: 'Synthetic from file', ingredients: [], at: new Date(Date.now() - 3600_000) });
    const backup = await exportBundle(source);
    const target = nowDeps();
    await logMeal(target, { description: 'Synthetic local', ingredients: [], at: new Date(Date.now() - 7200_000) });
    const seen: string[][] = [];
    const script = [0, 1]; // Export first, then Replace
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation((o, cb) => {
      seen.push(o.options);
      cb(script.shift() ?? o.options.length - 1);
    });
    const { tree, fileShare } = await mount(() => require('@/app/settings/data'), target, {
      saveAndShare: jest.fn(async () => undefined),
      pickFile: jest.fn(async () => backup as unknown as null),
    });
    await press(tree, en.data.importButton);
    await flush();
    await press(tree, en.data.replace);
    await flush();
    expect(seen).toEqual([
      [en.delete.exportFirst, en.data.replace, en.common.cancel],
      [en.delete.exportFirst, en.data.replace, en.common.cancel],
    ]);
    expect(fileShare.saveAndShare).toHaveBeenCalledTimes(1);
    expect((await target.repo.listRecords('meals')).map((m) => m.description)).toEqual(['Synthetic from file']);
  });
});

describe('Photo selection for an export (EX-7, EX-8)', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('EX-7 the user picks single photos, sensitive ones only when picked, and only those go into the ZIP', async () => {
    const deps = nowDeps();
    const chin = await logSkinEntry(deps, { areaId: 'area-chin', scores, at: new Date('2026-01-10T08:00:00.000Z') });
    const intimate = await logSkinEntry(deps, { areaId: 'area-penis', scores, at: new Date('2026-01-11T08:00:00.000Z') });
    await addPhoto(deps, { entryKind: 'skinEntry', entryId: chin.id, sourceUri: 'one' });
    await addPhoto(deps, { entryKind: 'skinEntry', entryId: chin.id, sourceUri: 'two' });
    await addPhoto(deps, { entryKind: 'skinEntry', entryId: intimate.id, sourceUri: 'three' }); // sensitive by the area default
    const { tree, fileShare } = await mount(() => require('@/app/settings/data'), deps);
    await flush();
    await press(tree, en.exportPhotos.custom);
    expect(hasText(tree, en.exportPhotos.customHint)).toBe(true);
    const chips = () => [
      ...new Set(
        tree.root
          .findAll(
            (n) =>
              typeof n.props.accessibilityLabel === 'string' &&
              n.props.accessibilityState?.selected !== undefined &&
              /\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(n.props.accessibilityLabel),
          )
          .map((n) => n.props.accessibilityLabel as string),
      ),
    ];
    expect(chips()).toHaveLength(2); // the two chin photos share a label (same minute); the third is the sensitive one
    const sensitiveLabel = chips().find((l) => l.includes(en.analysis.sensitiveMark))!;
    expect(sensitiveLabel).toContain(en.areas['area-penis']);
    const plain = chips().filter((l) => !l.includes(en.analysis.sensitiveMark));
    await press(tree, plain[0]!); // pick exactly one ordinary photo
    await press(tree, en.data.exportButton);
    await flush();
    const bytes = (fileShare.saveAndShare.mock.calls[0] as unknown as [string, Uint8Array])[1];
    const photos = Object.keys(unzipSync(bytes)).filter((f) => f.startsWith('photos/'));
    expect(photos).toHaveLength(1);
    // now add the sensitive one explicitly
    await press(tree, sensitiveLabel);
    await press(tree, en.data.exportButton);
    await flush();
    const second = Object.keys(unzipSync((fileShare.saveAndShare.mock.calls[1] as unknown as [string, Uint8Array])[1])).filter((f) =>
      f.startsWith('photos/'),
    );
    expect(second).toHaveLength(2);
  });
});
