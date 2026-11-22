import { SqliteRepo } from '@/adapters/storage/sqliteRepo';
import { MIGRATIONS } from '@/adapters/storage/migrations';
import { MemoryRepo } from './fakes/memoryRepo';
import { storageContract } from './contract/storage.contract';
import { createNodeSqliteDb } from './helpers/nodeSqliteDb';

storageContract('in-memory', async () => new MemoryRepo());
storageContract('sqlite', async () => SqliteRepo.open(createNodeSqliteDb()));

describe('sqlite migrations', () => {
  it('NF-3 reopening an already migrated database keeps data and does not re-run migrations', async () => {
    const db = createNodeSqliteDb();
    const first = await SqliteRepo.open(db);
    await first.addRecord('meals', {
      id: 'm1',
      at: { utc: '2026-01-01T08:00:00.000Z', tz: 'UTC' },
      description: 'Synthetic',
      ingredients: ['x'],
      allergens: [],
      barcode: null,
      source: { kind: 'typed', edited: false, llm: null, aiTags: false },
      note: null,
    });
    const second = await SqliteRepo.open(db);
    expect(await second.listRecords('meals')).toHaveLength(1);
    const [v] = await db.all<{ user_version: number }>('PRAGMA user_version');
    expect(v?.user_version).toBe(MIGRATIONS.length);
  });

  it('NF-3 preferences saved before a setting existed get its default instead of undefined', async () => {
    const db = createNodeSqliteDb();
    const repo = await SqliteRepo.open(db);
    await db.run('INSERT INTO preference (id, json) VALUES (1, ?)', [JSON.stringify({ dayStartHour: 3, favorites: { meals: [] } })]);
    const p = await repo.getPreferences();
    expect(p?.dayStartHour).toBe(3);
    expect(p?.favorites.drinks).toEqual([]);
    expect(p?.suggestions.rows).toBe(5);
  });

  it('NF-3 upgrades an existing version-1 database in place and keeps its data', async () => {
    const db = createNodeSqliteDb();
    await db.exec('PRAGMA foreign_keys = ON');
    await db.exec(MIGRATIONS[0]!);
    await db.exec('PRAGMA user_version = 1');
    await db.run(`INSERT INTO skin_area (id, name, predefined, archived, sensitive_default) VALUES ('area-chin', 'Chin', 1, 0, 0)`);
    await db.run(`INSERT INTO meal (id, ts_utc, tz, description) VALUES ('m1', '2026-01-01T08:00:00.000Z', 'UTC', 'Synthetic')`);
    const repo = await SqliteRepo.open(db);
    expect(await repo.listRecords('meals')).toHaveLength(1);
    expect((await repo.listAreas()).find((a) => a.id === 'area-chin')?.nameOverride).toBeNull();
    expect((await repo.listAreas()).find((a) => a.id === 'area-chin')?.kind).toBe('skin'); // SK-10 default
    const [v] = await db.all<{ user_version: number }>('PRAGMA user_version');
    expect(v?.user_version).toBe(MIGRATIONS.length);
  });

  it('SK-10 enforces nail stage and extent values in the database itself', async () => {
    const db = createNodeSqliteDb();
    await SqliteRepo.open(db);
    await expect(
      db.run(
        `INSERT INTO nail_entry (id, ts_utc, tz, area_id, stage, extent)
         VALUES ('x', '2026-01-01T00:00:00.000Z', 'UTC', 'area-chin', 'purple', 'none')`,
      ),
    ).rejects.toThrow();
  });

  it('SK-7 upgrades a version-3 database and seeds the daily tags', async () => {
    const db = createNodeSqliteDb();
    await db.exec('PRAGMA foreign_keys = ON');
    for (const [i, sql] of MIGRATIONS.slice(0, 3).entries()) {
      await db.exec(sql);
      await db.exec(`PRAGMA user_version = ${i + 1}`);
    }
    const repo = await SqliteRepo.open(db);
    expect(await repo.listItems('dailyItems')).toHaveLength(16);
    expect(await repo.listRecords('checkIns')).toEqual([]);
  });

  it('SK-7 enforces Bristol 1-7 in the database itself', async () => {
    const db = createNodeSqliteDb();
    await SqliteRepo.open(db);
    await expect(
      db.run(`INSERT INTO stool_entry (id, ts_utc, tz, bristol) VALUES ('x', '2026-01-01T00:00:00.000Z', 'UTC', 8)`),
    ).rejects.toThrow();
  });

  it('IN-10 upgrades a version-4 database: existing meals get an empty allergen list', async () => {
    const db = createNodeSqliteDb();
    await db.exec('PRAGMA foreign_keys = ON');
    for (const [i, sql] of MIGRATIONS.slice(0, 4).entries()) {
      await db.exec(sql);
      await db.exec(`PRAGMA user_version = ${i + 1}`);
    }
    await db.run(`INSERT INTO meal (id, ts_utc, tz, description) VALUES ('m1', '2026-01-01T08:00:00.000Z', 'UTC', 'Synthetic')`);
    const repo = await SqliteRepo.open(db);
    expect((await repo.listRecords('meals'))[0]?.allergens).toEqual([]);
    expect(await repo.listRecords('reactions')).toEqual([]);
  });

  it('IN-12 and IN-13 enforce enums and the meal link in the database itself', async () => {
    const db = createNodeSqliteDb();
    await db.exec('PRAGMA foreign_keys = ON');
    await SqliteRepo.open(db);
    await expect(
      db.run(
        `INSERT INTO change_event (id, ts_utc, tz, action, category, name) VALUES ('x', '2026-01-01T00:00:00.000Z', 'UTC', 'paused', 'diet', 'n')`,
      ),
    ).rejects.toThrow();
    await expect(
      db.run(
        `INSERT INTO reaction (id, ts_utc, tz, meal_id, symptoms_json) VALUES ('x', '2026-01-01T00:00:00.000Z', 'UTC', 'no-meal', '[]')`,
      ),
    ).rejects.toThrow();
  });

  it('IN-4 migration 13 turns alcohol entries into alcoholic drinks and renames their tombstones', async () => {
    const db = createNodeSqliteDb();
    for (const [i, sql] of MIGRATIONS.slice(0, 12).entries()) {
      await db.exec(sql);
      await db.exec(`PRAGMA user_version = ${i + 1}`);
    }
    await db.run(
      `INSERT INTO alcohol_entry (id, ts_utc, tz, drink, amount_ml) VALUES ('d1', '2026-01-01T00:00:00.000Z', 'UTC', 'beer', 500)`,
    );
    await db.run(
      `INSERT INTO tombstone (id, kind, deleted_utc, deleted_tz) VALUES ('t1', 'alcoholEntries', '2026-01-02T00:00:00.000Z', 'UTC')`,
    );
    const repo = await SqliteRepo.open(db);
    expect(await repo.listRecords('drinks')).toEqual([
      {
        id: 'd1',
        at: { utc: '2026-01-01T00:00:00.000Z', tz: 'UTC' },
        name: 'beer',
        amountMl: 500,
        alcohol: true,
        ingredients: [],
        allergens: [],
        barcode: null,
        source: { kind: 'typed', edited: false, llm: null, aiTags: false },
        note: null,
      },
    ]);
    expect((await db.all<{ kind: string }>('SELECT kind FROM tombstone')).map((r) => r.kind)).toEqual(['drinks']);
  });

  it('IN-2, IN-16 migration 14 gives existing meals and drinks a typed source and no barcode', async () => {
    const db = createNodeSqliteDb();
    for (const [i, sql] of MIGRATIONS.slice(0, 13).entries()) {
      await db.exec(sql);
      await db.exec(`PRAGMA user_version = ${i + 1}`);
    }
    await db.run(
      `INSERT INTO meal (id, ts_utc, tz, description, allergens_json) VALUES ('m1', '2026-01-01T00:00:00.000Z', 'UTC', 'Synthetic', '[]')`,
    );
    await db.run(`INSERT INTO drink (id, ts_utc, tz, name, amount_ml) VALUES ('d1', '2026-01-01T00:00:00.000Z', 'UTC', 'tea', 200)`);
    const repo = await SqliteRepo.open(db);
    const typed = { kind: 'typed', edited: false, llm: null, aiTags: false };
    expect(await repo.listRecords('meals')).toMatchObject([{ id: 'm1', barcode: null, source: typed }]);
    expect(await repo.listRecords('drinks')).toMatchObject([{ id: 'd1', barcode: null, source: typed }]);
  });

  it('SK-1 the intimate-area migration keeps an old single intimate area as an archived area with its entries; a new database never has it', async () => {
    const db = createNodeSqliteDb();
    const step = MIGRATIONS.findIndex((sql) => sql.includes("'area-intimate'")); // the step under test
    expect(step).toBeGreaterThan(0);
    for (const [i, sql] of MIGRATIONS.slice(0, step).entries()) {
      await db.exec(sql);
      await db.exec(`PRAGMA user_version = ${i + 1}`);
    }
    await db.run(
      `INSERT INTO skin_area (id, name, predefined, sensitive_default, kind) VALUES ('area-intimate', 'Intimate area', 1, 1, 'skin')`,
    );
    await db.run(
      `INSERT INTO skin_entry (id, ts_utc, tz, area_id, severity, itch, pain, dryness, scaling) VALUES ('e1', '2026-01-01T00:00:00.000Z', 'UTC', 'area-intimate', 3, 3, 3, 3, 3)`,
    );
    const repo = await SqliteRepo.open(db);
    const old = (await repo.listAreas()).find((a) => a.id === 'area-intimate');
    expect(old).toMatchObject({ name: 'Intimate area', predefined: false, archived: true });
    expect((await repo.listRecords('skinEntries')).map((e) => e.areaId)).toEqual(['area-intimate']); // history stays
    expect((await repo.listAreas()).filter((a) => a.predefined).map((a) => a.id)).toEqual(
      expect.arrayContaining(['area-penis', 'area-perineum-groin', 'area-between-buttocks']),
    );
    const fresh = await SqliteRepo.open(createNodeSqliteDb());
    expect((await fresh.listAreas()).some((a) => a.id === 'area-intimate')).toBe(false);
  });

  it('IN-4 and IN-5 enforce amount and category in the database itself', async () => {
    const db = createNodeSqliteDb();
    await SqliteRepo.open(db);
    await expect(
      db.run(`INSERT INTO drink (id, ts_utc, tz, name, amount_ml) VALUES ('x', '2026-01-01T00:00:00.000Z', 'UTC', 'beer', 0)`),
    ).rejects.toThrow();
    await expect(
      db.run(`INSERT INTO medication_entry (id, ts_utc, tz, category, name) VALUES ('x', '2026-01-01T00:00:00.000Z', 'UTC', 'herb', 'n')`),
    ).rejects.toThrow();
  });

  it('SK-4 stores photo records and keeps each file name unique', async () => {
    const db = createNodeSqliteDb();
    const repo = await SqliteRepo.open(db);
    const photo = {
      id: 'p1',
      at: { utc: '2026-01-01T00:00:00.000Z', tz: 'UTC' },
      entryKind: 'skinEntry' as const,
      entryId: 'e1',
      sensitive: true,
      file: 'a.jpg',
    };
    await repo.addRecord('photos', photo);
    expect(await repo.listRecords('photos')).toEqual([photo]);
    await expect(repo.addRecord('photos', { ...photo, id: 'p2' })).rejects.toThrow(); // same file
    await expect(
      db.run(
        `INSERT INTO photo (id, ts_utc, tz, entry_kind, entry_id, sensitive, file) VALUES ('x', '2026-01-01T00:00:00.000Z', 'UTC', 'meal', 'e', 0, 'b.jpg')`,
      ),
    ).rejects.toThrow();
  });

  it('NF-3 a database left at any earlier version upgrades to exactly the schema of a fresh one', async () => {
    const schema = async (db: ReturnType<typeof createNodeSqliteDb>) =>
      (await db.all<{ name: string; sql: string }>("SELECT name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name"))
        .map((r) => `${r.name}: ${(r.sql ?? '').replace(/\s+/g, ' ')}`)
        .join('\n');
    const fresh = createNodeSqliteDb();
    await SqliteRepo.open(fresh);
    const expected = await schema(fresh);
    for (let version = 1; version < MIGRATIONS.length; version++) {
      const db = createNodeSqliteDb();
      await db.exec('PRAGMA foreign_keys = ON');
      for (let v = 0; v < version; v++) await db.exec(MIGRATIONS[v]!); // the app as it was at `version`
      await db.exec(`PRAGMA user_version = ${version}`);
      await SqliteRepo.open(db);
      const [row] = await db.all<{ user_version: number }>('PRAGMA user_version');
      expect(row?.user_version).toBe(MIGRATIONS.length);
      expect(await schema(db)).toBe(expected);
    }
  });

  it('SK-3 enforces 0-10 scores in the database itself', async () => {
    const db = createNodeSqliteDb();
    await SqliteRepo.open(db);
    await expect(
      db.run(
        `INSERT INTO skin_entry (id, ts_utc, tz, area_id, severity, itch, pain, dryness, scaling)
         VALUES ('x', '2026-01-01T00:00:00.000Z', 'UTC', 'area-chin', 11, 0, 0, 0, 0)`,
      ),
    ).rejects.toThrow();
  });
});
