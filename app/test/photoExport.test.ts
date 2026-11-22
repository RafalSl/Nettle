import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { SqliteRepo } from '@/adapters/storage/sqliteRepo';
import { NettleError } from '@/core/model/errors';
import { filterPhotoIds, planPhotoNames, selectPhotos } from '@/core/export/photoSelection';
import type { Photo } from '@/core/model/types';
import type { StorageRepository } from '@/core/ports/storage';
import { applyImport, exportBundle, previewImport } from '@/core/usecases/exchange';
import { addPhoto } from '@/core/usecases/photos';
import { addArea, logNailEntry, logSkinEntry } from '@/core/usecases/skin';
import type { Deps } from '@/core/usecases/deps';
import { MemoryPhotoStore } from './fakes/memoryPhotoStore';
import { MemoryRepo } from './fakes/memoryRepo';
import { createNodeSqliteDb } from './helpers/nodeSqliteDb';
import { makeDeps } from './helpers/fixtures';

const repos: [string, () => Promise<StorageRepository>][] = [
  ['in-memory', async () => new MemoryRepo()],
  ['sqlite', async () => SqliteRepo.open(createNodeSqliteDb())],
];
const BOTH = { records: true, settings: true };
const RECORDS = { records: true, settings: false };
const scores = { severity: 1, itch: 2, pain: 3, dryness: 4, scaling: 5 };
const code = async (p: Promise<unknown>) =>
  p.then(
    () => 'no error',
    (e: unknown) => (e instanceof NettleError ? e.code : 'other'),
  );
const names = (zip: Uint8Array) => Object.keys(unzipSync(zip)).sort();
const dataJson = (zip: Uint8Array) => JSON.parse(strFromU8(unzipSync(zip)['data.json']!));
const text = (b: Uint8Array) => new TextDecoder().decode(b);

/** Two skin entries (chin, intimate) and a nail entry, each with a photo; the intimate one is sensitive by default. */
async function seeded(make: () => Promise<StorageRepository>) {
  const repo = await make();
  const deps = makeDeps(repo);
  const chin = await logSkinEntry(deps, { areaId: 'area-chin', scores, at: new Date('2026-01-10T08:00:00.000Z') });
  const intimate = await logSkinEntry(deps, { areaId: 'area-penis', scores, at: new Date('2026-01-10T09:00:00.000Z') });
  const nail = await addArea(deps, 'Synthetic thumb', 'nail');
  const nailEntry = await logNailEntry(deps, { areaId: nail.id, stage: 'clear', extent: 'none', at: new Date('2026-01-20T08:00:00.000Z') });
  const p = (entryKind: 'skinEntry' | 'nailEntry', entryId: string, uri: string, at: string) =>
    addPhoto(deps, { entryKind, entryId, sourceUri: uri, at: new Date(at) });
  const photos = {
    chin: await p('skinEntry', chin.id, 'chin-bytes', '2026-01-10T08:01:00.000Z'),
    chin2: await p('skinEntry', chin.id, 'chin-two-bytes', '2026-01-10T08:02:00.000Z'),
    intimate: await p('skinEntry', intimate.id, 'intimate-bytes', '2026-01-10T09:01:00.000Z'),
    nail: await p('nailEntry', nailEntry.id, 'nail-bytes', '2026-01-20T08:01:00.000Z'),
  };
  return { repo, deps, photos, nail };
}
const store = (d: Deps) => d.photos as MemoryPhotoStore;

describe('photo selection and names (EX-2, EX-7)', () => {
  const photo = (id: string, utc: string, sensitive = false): Photo => ({
    id,
    at: { utc, tz: 'Europe/Warsaw' },
    entryKind: 'skinEntry',
    entryId: 'e-' + id,
    sensitive,
    file: id + '.jpg',
  });
  const photos = [
    photo('a', '2026-01-10T08:00:00.000Z'),
    photo('b', '2026-01-10T09:00:00.000Z', true),
    photo('c', '2026-02-01T09:00:00.000Z'),
  ];

  it('EX-7 selects all, none, non-sensitive or an explicit list', () => {
    expect(selectPhotos(photos, { mode: 'all' }).map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(selectPhotos(photos, { mode: 'none' })).toEqual([]);
    expect(selectPhotos(photos, { mode: 'non_sensitive' }).map((p) => p.id)).toEqual(['a', 'c']);
    expect(selectPhotos(photos, { mode: 'custom', ids: ['b', 'zzz'] }).map((p) => p.id)).toEqual(['b']);
  });

  it('EX-7 a filter selection combines area and date range and adds sensitive photos only when asked', () => {
    const area = (p: Photo) => (p.id === 'c' ? 'area-neck' : 'area-chin');
    const ids = (sel: Parameters<typeof selectPhotos>[1]) => selectPhotos(photos, sel, area).map((p) => p.id);
    expect(ids({ mode: 'filter', areaIds: ['area-chin'], includeSensitive: false })).toEqual(['a']);
    expect(ids({ mode: 'filter', areaIds: ['area-chin'], includeSensitive: true })).toEqual(['a', 'b']);
    expect(ids({ mode: 'filter', range: { from: '2026-01-31T00:00:00.000Z' }, includeSensitive: false })).toEqual(['c']);
    expect(ids({ mode: 'filter', includeSensitive: false })).toEqual(['a', 'c']);
  });

  it('EX-7 builds a custom list from an area and a date range', () => {
    const area = (p: Photo) => (p.id === 'c' ? 'area-neck' : 'area-chin');
    expect(filterPhotoIds(photos, area, { areaIds: ['area-chin'] })).toEqual(['a', 'b']);
    expect(filterPhotoIds(photos, area, { range: { from: '2026-01-31T00:00:00.000Z' } })).toEqual(['c']);
    expect(filterPhotoIds(photos, area, { areaIds: ['area-neck'], range: { to: '2026-01-31T00:00:00.000Z' } })).toEqual([]);
    expect(filterPhotoIds(photos, area, {})).toEqual(['a', 'b', 'c']);
  });

  it('EX-2 names photos by local day, a short label and a counter, and hides sensitive ones', () => {
    const areas: Record<string, { id: string; kind: 'skin' | 'nail'; predefined: boolean }> = {
      a: { id: 'area-chin', kind: 'skin', predefined: true },
      b: { id: 'area-penis', kind: 'skin', predefined: true },
      c: { id: 'user-1', kind: 'nail', predefined: false },
    };
    const more = [...photos, photo('d', '2026-01-10T08:30:00.000Z')];
    areas.d = areas.a!;
    const result = planPhotoNames(more, (p) => areas[p.id] as never);
    expect(result.get('a')).toBe('photos/2026-01-10_chin_01.jpg');
    expect(result.get('d')).toBe('photos/2026-01-10_chin_02.jpg');
    expect(result.get('b')).toBe('photos/2026-01-10_private_01.jpg'); // the intimate area is not in the name
    expect(result.get('c')).toBe('photos/2026-02-01_nail_01.jpg');
  });

  it('EX-2 uses the local day, so a late evening photo is not named after the next UTC day', () => {
    const late = photo('x', '2026-01-10T23:30:00.000Z'); // 00:30 on the 11th in Warsaw
    expect(planPhotoNames([late], () => undefined).get('x')).toBe('photos/2026-01-11_photo_01.jpg');
  });
});

describe.each(repos)('export and import with photos (%s)', (_name, make) => {
  it('EX-7 the default export leaves out sensitive photos and EX-2 names the files', async () => {
    const { deps, photos } = await seeded(make);
    const zip = await exportBundle(deps);
    expect(names(zip)).toEqual([
      'data.json',
      'photos/2026-01-10_chin_01.jpg',
      'photos/2026-01-10_chin_02.jpg',
      'photos/2026-01-20_nail_01.jpg',
    ]);
    const json = dataJson(zip);
    expect(json.records.photos.map((p: { id: string }) => p.id).sort()).toEqual([photos.chin.id, photos.chin2.id, photos.nail.id].sort());
    expect(text(unzipSync(zip)['photos/2026-01-10_chin_01.jpg']!)).toBe('chin-bytes');
    expect(JSON.stringify(json)).not.toContain('intimate-bytes');
  });

  it('EX-7 all, none and custom selections', async () => {
    const { deps, photos } = await seeded(make);
    expect(names(await exportBundle(deps, { photos: { mode: 'all' } }))).toContain('photos/2026-01-10_private_01.jpg');
    expect(names(await exportBundle(deps, { photos: { mode: 'none' } }))).toEqual(['data.json']);
    const custom = await exportBundle(deps, { photos: { mode: 'custom', ids: [photos.intimate.id, photos.nail.id] } });
    expect(names(custom)).toEqual(['data.json', 'photos/2026-01-10_private_01.jpg', 'photos/2026-01-20_nail_01.jpg']);
    expect(dataJson(custom).records.photos).toHaveLength(2); // EX-8: data.json lists only what is in the bundle
  });

  it('EX-1 a date range keeps only photos of entries in the range; a settings-only export has none', async () => {
    const { deps } = await seeded(make);
    const jan10 = await exportBundle(deps, { days: { from: '2026-01-10', to: '2026-01-10' }, photos: { mode: 'all' } });
    expect(names(jan10)).toEqual([
      'data.json',
      'photos/2026-01-10_chin_01.jpg',
      'photos/2026-01-10_chin_02.jpg',
      'photos/2026-01-10_private_01.jpg',
    ]);
    const settings = await exportBundle(deps, { parts: { records: false, settings: true }, photos: { mode: 'all' } });
    expect(names(settings)).toEqual(['data.json']);
  });

  it('EX-6 + EX-10 a password-protected export with photos restores them byte for byte on a fresh install', async () => {
    const { deps: src } = await seeded(make);
    const zip = await exportBundle(src, { password: 'synthetic-passphrase-1', photos: { mode: 'all' } });
    expect(zip.length).toBeGreaterThan(0);
    const target = makeDeps(await make());
    const parsed = await previewImport(target, zip, 'synthetic-passphrase-1');
    expect(parsed.preview.incoming.photos).toBe(4);
    await applyImport(target, parsed, { mode: 'replace', parts: BOTH });
    const restored = await target.repo.listRecords('photos');
    expect(restored).toHaveLength(4);
    const bytes = await Promise.all(restored.map(async (p) => text(await target.photos.read(p.file))));
    expect(bytes.sort()).toEqual(['chin-bytes', 'chin-two-bytes', 'intimate-bytes', 'nail-bytes']);
    expect(restored.every((p) => !p.file.startsWith('photos/'))).toBe(true); // store keys, not zip paths
    expect(restored.filter((p) => p.sensitive)).toHaveLength(1);
  });

  it('EX-10 merge skips a photo that exists and does not store its file again', async () => {
    const { deps: src } = await seeded(make);
    const zip = await exportBundle(src, { photos: { mode: 'all' } });
    const target = makeDeps(await make());
    await applyImport(target, await previewImport(target, zip), { mode: 'replace', parts: BOTH });
    expect(store(target).files.size).toBe(4);
    const again = await previewImport(target, zip);
    expect(again.preview.duplicates.photos).toBe(4);
    await applyImport(target, again, { mode: 'merge', parts: BOTH });
    expect(store(target).files.size).toBe(4);
    expect(await target.repo.listRecords('photos')).toHaveLength(4);
  });

  it('EX-10 replace records removes the files of the photos it replaces', async () => {
    const { deps: src } = await seeded(make);
    const zip = await exportBundle(src, { photos: { mode: 'none' } });
    const target = await seeded(make);
    expect(store(target.deps).files.size).toBe(4);
    await applyImport(target.deps, await previewImport(target.deps, zip), { mode: 'replace', parts: RECORDS });
    expect(await target.repo.listRecords('photos')).toEqual([]);
    expect(store(target.deps).files.size).toBe(0);
  });

  it('NF-3 a ZIP that lacks a photo named in data.json fails with nothing stored or changed', async () => {
    const { deps: src } = await seeded(make);
    const files = unzipSync(await exportBundle(src));
    delete files['photos/2026-01-20_nail_01.jpg'];
    const broken = zipSync(files);
    const target = makeDeps(await make());
    const parsed = await previewImport(target, broken);
    expect(await code(applyImport(target, parsed, { mode: 'replace', parts: BOTH }))).toBe('import_missing_photo');
    expect(store(target).files.size).toBe(0);
    expect(await target.repo.listRecords('skinEntries')).toEqual([]);
  });

  it('EX-10 photos of entries that are not in the app are refused unless the entries are imported too', async () => {
    const { deps: src } = await seeded(make);
    const zip = await exportBundle(src);
    const files = unzipSync(zip);
    const json = JSON.parse(strFromU8(files['data.json']!));
    json.records.skin_entries = [];
    json.records.nail_entries = [];
    files['data.json'] = strToU8(JSON.stringify(json));
    const target = makeDeps(await make());
    const parsed = await previewImport(target, zipSync(files));
    expect(await code(applyImport(target, parsed, { mode: 'merge', parts: RECORDS }))).toBe('import_unknown_entry');
    expect(store(target).files.size).toBe(0);
  });

  it('EX-10 a data.json that points outside photos/ is rejected', async () => {
    const { deps: src } = await seeded(make);
    const files = unzipSync(await exportBundle(src));
    for (const bad of ['../x.jpg', '/etc/passwd', 'photos/../x.jpg', 'other/a.jpg', 'photos/a b.jpg']) {
      const json = JSON.parse(strFromU8(files['data.json']!));
      json.records.photos[0].file = bad;
      const target = makeDeps(await make());
      expect(await code(previewImport(target, zipSync({ ...files, 'data.json': strToU8(JSON.stringify(json)) })))).toBe(
        'import_invalid_data',
      );
    }
  });

  it('EX-2 photos are stored in the ZIP without compression (JPEG does not shrink)', async () => {
    const { deps } = await seeded(make);
    const big = new Uint8Array(200_000).map((_, i) => (i * 7919) % 251);
    await deps.photos.saveBytes(big); // not referenced; just check the writer through a direct export below
    const entry = (await deps.repo.listRecords('skinEntries'))[0]!;
    const key = await deps.photos.saveBytes(big);
    await deps.repo.addRecord('photos', {
      id: 'big',
      at: { utc: '2026-01-10T08:05:00.000Z', tz: 'Europe/Warsaw' },
      entryKind: 'skinEntry',
      entryId: entry.id,
      sensitive: false,
      file: key,
    });
    const zip = await exportBundle(deps);
    expect(zip.length).toBeGreaterThan(big.length);
    expect(zip.length).toBeLessThan(big.length + 4000);
  });
});
