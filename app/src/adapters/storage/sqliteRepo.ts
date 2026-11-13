import { PREDEFINED_AREAS } from '@/core/model/areas';
import {
  EXTRA_KINDS,
  type DateRange,
  type ExtraKind,
  type Meal,
  type Payload,
  type Records,
  type SkinArea,
  type SkinEntry,
  type Snapshot,
} from '@/core/model/types';
import type { ExistingIds, ImportMode, StorageRepository } from '@/core/ports/storage';
import { EXTRA_TABLES } from './extraTables';
import { migrate } from './migrations';
import type { SqlDb, SqlValue } from './sqlDb';

interface MealRow {
  id: string;
  ts_utc: string;
  tz: string;
  description: string;
  note: string | null;
}
interface AreaRow {
  id: string;
  name: string;
  kind: 'skin' | 'nail';
  predefined: number;
  archived: number;
  sensitive_default: number;
  name_override: string | null;
}
interface EntryRow {
  id: string;
  ts_utc: string;
  tz: string;
  area_id: string;
  severity: number;
  itch: number;
  pain: number;
  dryness: number;
  scaling: number;
  note: string | null;
}

function rangeClause(range?: DateRange): { sql: string; params: SqlValue[] } {
  const parts: string[] = [];
  const params: SqlValue[] = [];
  if (range?.from) {
    parts.push('ts_utc >= ?');
    params.push(range.from);
  }
  if (range?.to) {
    parts.push('ts_utc <= ?');
    params.push(range.to);
  }
  return { sql: parts.length ? `WHERE ${parts.join(' AND ')}` : '', params };
}

export class SqliteRepo implements StorageRepository {
  private constructor(private readonly db: SqlDb) {}

  /** Runs migrations and ensures predefined areas (SK-1) exist. The caller enables foreign keys on the connection first. */
  static async open(db: SqlDb): Promise<SqliteRepo> {
    await migrate(db);
    const repo = new SqliteRepo(db);
    await repo.seedAreas();
    return repo;
  }

  private async seedAreas() {
    for (const a of PREDEFINED_AREAS) await this.insertArea(a, true);
  }

  private async insertArea(a: SkinArea, ignoreIfExists: boolean) {
    await this.db.run(
      `INSERT ${ignoreIfExists ? 'OR IGNORE ' : ''}INTO skin_area (id, kind, name, predefined, archived, sensitive_default, name_override)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [a.id, a.kind, a.name, +a.predefined, +a.archived, +a.sensitiveDefault, a.nameOverride],
    );
  }

  private async insertMeal(m: Meal, ignoreIfExists: boolean) {
    const verb = ignoreIfExists ? 'INSERT OR IGNORE' : 'INSERT';
    await this.db.run(`${verb} INTO meal (id, ts_utc, tz, description, note) VALUES (?, ?, ?, ?, ?)`, [
      m.id,
      m.at.utc,
      m.at.tz,
      m.description,
      m.note,
    ]);
    // Ingredients of a skipped duplicate must not be appended to the existing meal.
    const [row] = await this.db.all<{ n: number }>(
      'SELECT COUNT(*) AS n FROM meal_ingredient WHERE meal_id = ?',
      [m.id],
    );
    if ((row?.n ?? 0) > 0) return;
    for (const [i, name] of m.ingredients.entries()) {
      await this.db.run('INSERT INTO meal_ingredient (meal_id, position, name) VALUES (?, ?, ?)', [
        m.id,
        i,
        name,
      ]);
    }
  }

  private async insertEntry(e: SkinEntry, ignoreIfExists: boolean) {
    const verb = ignoreIfExists ? 'INSERT OR IGNORE' : 'INSERT';
    await this.db.run(
      `${verb} INTO skin_entry (id, ts_utc, tz, area_id, severity, itch, pain, dryness, scaling, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        e.id,
        e.at.utc,
        e.at.tz,
        e.areaId,
        e.scores.severity,
        e.scores.itch,
        e.scores.pain,
        e.scores.dryness,
        e.scores.scaling,
        e.note,
      ],
    );
  }

  private async insertExtra(kind: ExtraKind, record: Records[ExtraKind][number], ignoreIfExists: boolean) {
    const t = EXTRA_TABLES[kind] as (typeof EXTRA_TABLES)[ExtraKind];
    const cols = ['id', 'ts_utc', 'tz', ...t.columns];
    await this.db.run(
      `INSERT ${ignoreIfExists ? 'OR IGNORE ' : ''}INTO ${t.table} (${cols.join(', ')})
       VALUES (${cols.map(() => '?').join(', ')})`,
      [record.id, record.at.utc, record.at.tz, ...(t.toValues as (r: typeof record) => SqlValue[])(record)],
    );
  }

  async addRecord<K extends ExtraKind>(kind: K, record: Records[K][number]) {
    await this.insertExtra(kind, record, false);
  }

  async listRecords<K extends ExtraKind>(kind: K, range?: DateRange): Promise<Records[K]> {
    const t = EXTRA_TABLES[kind] as (typeof EXTRA_TABLES)[ExtraKind];
    const { sql, params } = rangeClause(range);
    const rows = await this.db.all<Record<string, string | number | null>>(
      `SELECT * FROM ${t.table} ${sql} ORDER BY ts_utc DESC, id ASC`,
      params,
    );
    return rows.map((r) => t.fromRow(r)) as unknown as Records[K];
  }

  async addMeal(meal: Meal) {
    await this.db.transaction(() => this.insertMeal(meal, false));
  }

  async listMeals(range?: DateRange): Promise<Meal[]> {
    const { sql, params } = rangeClause(range);
    const rows = await this.db.all<MealRow>(
      `SELECT * FROM meal ${sql} ORDER BY ts_utc DESC, id ASC`,
      params,
    );
    const ing = await this.db.all<{ meal_id: string; name: string }>(
      'SELECT meal_id, name FROM meal_ingredient ORDER BY meal_id, position',
    );
    const byMeal = new Map<string, string[]>();
    for (const r of ing) byMeal.set(r.meal_id, [...(byMeal.get(r.meal_id) ?? []), r.name]);
    return rows.map((r) => ({
      id: r.id,
      at: { utc: r.ts_utc, tz: r.tz },
      description: r.description,
      ingredients: byMeal.get(r.id) ?? [],
      note: r.note,
    }));
  }

  async upsertArea(area: SkinArea) {
    await this.db.run(
      `INSERT INTO skin_area (id, kind, name, predefined, archived, sensitive_default, name_override)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, name = excluded.name, predefined = excluded.predefined,
         archived = excluded.archived, sensitive_default = excluded.sensitive_default,
         name_override = excluded.name_override`,
      [area.id, area.kind, area.name, +area.predefined, +area.archived, +area.sensitiveDefault, area.nameOverride],
    );
  }

  async listAreas(): Promise<SkinArea[]> {
    const rows = await this.db.all<AreaRow>('SELECT * FROM skin_area ORDER BY id');
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      name: r.name,
      predefined: !!r.predefined,
      archived: !!r.archived,
      sensitiveDefault: !!r.sensitive_default,
      nameOverride: r.name_override,
    }));
  }

  async addSkinEntry(entry: SkinEntry) {
    await this.insertEntry(entry, false);
  }

  async listSkinEntries(range?: DateRange): Promise<SkinEntry[]> {
    const { sql, params } = rangeClause(range);
    const rows = await this.db.all<EntryRow>(
      `SELECT * FROM skin_entry ${sql} ORDER BY ts_utc DESC, id ASC`,
      params,
    );
    return rows.map((r) => ({
      id: r.id,
      at: { utc: r.ts_utc, tz: r.tz },
      areaId: r.area_id,
      scores: {
        severity: r.severity,
        itch: r.itch,
        pain: r.pain,
        dryness: r.dryness,
        scaling: r.scaling,
      },
      note: r.note,
    }));
  }

  async snapshot(range?: DateRange): Promise<Snapshot> {
    const snap = {
      meals: await this.listMeals(range),
      skinAreas: await this.listAreas(),
      skinEntries: await this.listSkinEntries(range),
    } as Snapshot;
    for (const kind of EXTRA_KINDS) Object.assign(snap, { [kind]: await this.listRecords(kind, range) });
    return snap;
  }

  async existingIds(): Promise<ExistingIds> {
    const ids = async (table: string) =>
      new Set((await this.db.all<{ id: string }>(`SELECT id FROM ${table}`)).map((r) => r.id));
    const result = {
      meals: await ids('meal'),
      skinAreas: await ids('skin_area'),
      skinEntries: await ids('skin_entry'),
    } as ExistingIds;
    for (const kind of EXTRA_KINDS) result[kind] = await ids(EXTRA_TABLES[kind].table);
    return result;
  }

  async importData(payload: Payload, mode: ImportMode) {
    const { records, settings } = payload;
    await this.db.transaction(async () => {
      if (records && mode === 'replace') {
        await this.db.exec('DELETE FROM skin_entry; DELETE FROM meal_ingredient; DELETE FROM meal;');
        for (const kind of EXTRA_KINDS) await this.db.exec(`DELETE FROM ${EXTRA_TABLES[kind].table};`);
      }
      if (settings) {
        for (const a of settings.skinAreas) {
          if (mode === 'replace') await this.upsertArea(a);
          else await this.insertArea(a, true);
        }
      }
      if (records) {
        for (const m of records.meals) await this.insertMeal(m, true);
        for (const e of records.skinEntries) await this.insertEntry(e, true);
        for (const kind of EXTRA_KINDS) {
          for (const r of records[kind]) await this.insertExtra(kind, r, true);
        }
      }
      if (settings && mode === 'replace') {
        // Drop user areas the file does not have, unless an entry still uses them. Predefined areas stay.
        const keep = new Set(settings.skinAreas.map((a) => a.id));
        const used = await this.db.all<{ area_id: string }>(
          'SELECT area_id FROM skin_entry UNION SELECT area_id FROM nail_entry',
        );
        used.forEach((r) => keep.add(r.area_id));
        const current = await this.db.all<{ id: string }>('SELECT id FROM skin_area WHERE predefined = 0');
        for (const { id } of current) {
          if (!keep.has(id)) await this.db.run('DELETE FROM skin_area WHERE id = ?', [id]);
        }
      }
      await this.seedAreas();
    });
  }
}
