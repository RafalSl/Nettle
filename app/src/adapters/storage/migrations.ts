import type { SqlDb } from './sqlDb';

/** Append only. Index + 1 is the PRAGMA user_version after the step has run. */
export const MIGRATIONS: string[] = [
  `
  CREATE TABLE meal (
    id TEXT PRIMARY KEY,
    ts_utc TEXT NOT NULL,
    tz TEXT NOT NULL,
    description TEXT NOT NULL,
    note TEXT
  );
  CREATE INDEX meal_ts ON meal (ts_utc);
  CREATE TABLE meal_ingredient (
    meal_id TEXT NOT NULL REFERENCES meal (id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    name TEXT NOT NULL,
    PRIMARY KEY (meal_id, position)
  );
  CREATE TABLE skin_area (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    predefined INTEGER NOT NULL,
    archived INTEGER NOT NULL DEFAULT 0,
    sensitive_default INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE skin_entry (
    id TEXT PRIMARY KEY,
    ts_utc TEXT NOT NULL,
    tz TEXT NOT NULL,
    area_id TEXT NOT NULL REFERENCES skin_area (id),
    severity INTEGER NOT NULL CHECK (severity BETWEEN 0 AND 10),
    itch INTEGER NOT NULL CHECK (itch BETWEEN 0 AND 10),
    pain INTEGER NOT NULL CHECK (pain BETWEEN 0 AND 10),
    dryness INTEGER NOT NULL CHECK (dryness BETWEEN 0 AND 10),
    scaling INTEGER NOT NULL CHECK (scaling BETWEEN 0 AND 10),
    note TEXT
  );
  CREATE INDEX skin_entry_ts ON skin_entry (ts_utc);
  `,
];

export async function migrate(db: SqlDb): Promise<void> {
  const [row] = await db.all<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  for (let v = current; v < MIGRATIONS.length; v++) {
    await db.transaction(async () => {
      await db.exec(MIGRATIONS[v]!);
      await db.exec(`PRAGMA user_version = ${v + 1}`);
    });
  }
}
