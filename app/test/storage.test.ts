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
    await first.addMeal({
      id: 'm1',
      at: { utc: '2026-01-01T08:00:00.000Z', tz: 'UTC' },
      description: 'Synthetic',
      ingredients: ['x'],
      allergens: [],
      note: null,
    });
    const second = await SqliteRepo.open(db);
    expect(await second.listMeals()).toHaveLength(1);
    const [v] = await db.all<{ user_version: number }>('PRAGMA user_version');
    expect(v?.user_version).toBe(MIGRATIONS.length);
  });

  it('NF-3 upgrades an existing version-1 database in place and keeps its data', async () => {
    const db = createNodeSqliteDb();
    await db.exec('PRAGMA foreign_keys = ON');
    await db.exec(MIGRATIONS[0]!);
    await db.exec('PRAGMA user_version = 1');
    await db.run(
      `INSERT INTO skin_area (id, name, predefined, archived, sensitive_default) VALUES ('area-chin', 'Chin', 1, 0, 0)`,
    );
    await db.run(`INSERT INTO meal (id, ts_utc, tz, description) VALUES ('m1', '2026-01-01T08:00:00.000Z', 'UTC', 'Synthetic')`);
    const repo = await SqliteRepo.open(db);
    expect(await repo.listMeals()).toHaveLength(1);
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
    expect(await repo.listItems('dailyTags')).toHaveLength(9);
    expect(await repo.listRecords('checkIns')).toEqual([]);
  });

  it('SK-7 enforces Bristol 1-7 and check-in score ranges in the database itself', async () => {
    const db = createNodeSqliteDb();
    await SqliteRepo.open(db);
    await expect(
      db.run(`INSERT INTO stool_entry (id, ts_utc, tz, bristol) VALUES ('x', '2026-01-01T00:00:00.000Z', 'UTC', 8)`),
    ).rejects.toThrow();
    await expect(
      db.run(
        `INSERT INTO check_in (id, ts_utc, tz, day, wellbeing, bloating, tags_json)
         VALUES ('x', '2026-01-01T00:00:00.000Z', 'UTC', '2026-01-01', 11, 0, '[]')`,
      ),
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
    expect((await repo.listMeals())[0]?.allergens).toEqual([]);
    expect(await repo.listRecords('reactions')).toEqual([]);
  });

  it('IN-12 and IN-13 enforce enums and the meal link in the database itself', async () => {
    const db = createNodeSqliteDb();
    await db.exec('PRAGMA foreign_keys = ON');
    await SqliteRepo.open(db);
    await expect(
      db.run(`INSERT INTO change_event (id, ts_utc, tz, action, category, name) VALUES ('x', '2026-01-01T00:00:00.000Z', 'UTC', 'paused', 'diet', 'n')`),
    ).rejects.toThrow();
    await expect(
      db.run(`INSERT INTO reaction (id, ts_utc, tz, meal_id, symptoms_json) VALUES ('x', '2026-01-01T00:00:00.000Z', 'UTC', 'no-meal', '[]')`),
    ).rejects.toThrow();
  });

  it('IN-4 and IN-5 enforce amount and category in the database itself', async () => {
    const db = createNodeSqliteDb();
    await SqliteRepo.open(db);
    await expect(
      db.run(`INSERT INTO alcohol_entry (id, ts_utc, tz, drink, amount_ml) VALUES ('x', '2026-01-01T00:00:00.000Z', 'UTC', 'beer', 0)`),
    ).rejects.toThrow();
    await expect(
      db.run(`INSERT INTO medication_entry (id, ts_utc, tz, category, name) VALUES ('x', '2026-01-01T00:00:00.000Z', 'UTC', 'herb', 'n')`),
    ).rejects.toThrow();
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
