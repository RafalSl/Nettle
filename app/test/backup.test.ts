import { MemoryRepo } from './fakes/memoryRepo';
import { makeDeps } from './helpers/fixtures';
import {
  backupCardDue,
  daysSinceExport,
  getLastExport,
  markExported,
  presetOptions,
  sinceLastExport,
} from '@/core/usecases/backup';
import { exportBundle, previewImport } from '@/core/usecases/exchange';
import { addPhoto } from '@/core/usecases/photos';
import { logSkinEntry } from '@/core/usecases/skin';
import { unpackBundle } from '@/core/export/bundle';

const scores = { severity: 1, itch: 2, pain: 3, dryness: 4, scaling: 5 };

describe('export bookkeeping (EX-11, UX-2)', () => {
  it('EX-11 knows nothing before the first export, then the local day of the last one', async () => {
    const deps = makeDeps(new MemoryRepo(), '2026-03-01T22:30:00.000Z'); // 23:30 in Warsaw, still the 1st
    expect(await getLastExport(deps)).toBeNull();
    expect(await sinceLastExport(deps)).toBeNull();
    expect(await daysSinceExport(deps)).toBeNull();
    await markExported(deps);
    expect(await sinceLastExport(deps)).toEqual({ from: '2026-03-01' });
  });

  it('UX-2 the backup card is due with no export and after more than 7 days, not before', async () => {
    const deps = makeDeps(new MemoryRepo(), '2026-03-01T10:00:00.000Z');
    expect(await backupCardDue(deps)).toBe(true);
    await markExported(deps);
    const later = (days: number) => ({ ...deps, clock: { ...deps.clock, now: () => new Date(Date.parse('2026-03-01T10:00:00.000Z') + days * 86_400_000) } });
    expect(await daysSinceExport(later(3))).toBe(3);
    expect(await backupCardDue(later(7))).toBe(false);
    expect(await backupCardDue(later(8))).toBe(true);
  });
});

describe('export presets (EX-14)', () => {
  async function setup() {
    const deps = makeDeps(new MemoryRepo());
    const e = await logSkinEntry(deps, { areaId: 'area-penis', scores });
    await addPhoto(deps, { entryKind: 'skinEntry', entryId: e.id, sourceUri: 'secret' }); // intimate area: sensitive by default
    return deps;
  }
  const report = { language: 'en' as const, text: {} as never, areaName: () => '', itemName: () => '' };

  it('EX-14 the doctor report has records only, a PDF and leaves sensitive photos out', async () => {
    const deps = await setup();
    const opts = presetOptions({ kind: 'doctor', report, days: { from: '2026-01-01' } });
    expect(opts).toMatchObject({ parts: { records: true, settings: false }, photos: { mode: 'non_sensitive' }, days: { from: '2026-01-01' } });
    expect(opts.report).toBe(report);
    const parsed = await previewImport(deps, await exportBundle(deps, { ...opts, report: undefined }));
    expect(parsed.payload.records?.photos).toEqual([]);
    expect(parsed.payload.settings).toBeUndefined();
  });

  it('EX-14 the full backup has records and settings and every photo, sensitive ones included, and no PDF', async () => {
    const deps = await setup();
    const opts = presetOptions({ kind: 'backup', password: 'a long synthetic passphrase' });
    expect(opts).toMatchObject({ parts: { records: true, settings: true }, photos: { mode: 'all' } });
    expect(opts.report).toBeUndefined();
    const zip = await exportBundle(deps, opts);
    const { payload } = unpackBundle(zip, 'a long synthetic passphrase');
    expect(payload.records?.photos).toHaveLength(1);
    expect(payload.settings?.skinAreas.length).toBeGreaterThan(0);
  });
});
