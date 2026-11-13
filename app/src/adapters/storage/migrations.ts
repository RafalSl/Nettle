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
  // SK-2: name_override for predefined areas.
  `ALTER TABLE skin_area ADD COLUMN name_override TEXT;`,
  // SK-10: area kinds and nail entries.
  `
  ALTER TABLE skin_area ADD COLUMN kind TEXT NOT NULL DEFAULT 'skin' CHECK (kind IN ('skin', 'nail'));
  CREATE TABLE nail_entry (
    id TEXT PRIMARY KEY,
    ts_utc TEXT NOT NULL,
    tz TEXT NOT NULL,
    area_id TEXT NOT NULL REFERENCES skin_area (id),
    stage TEXT NOT NULL CHECK (stage IN ('red_edge', 'separation', 'yellow', 'white', 'clear')),
    extent TEXT NOT NULL CHECK (extent IN ('none', 'under_quarter', 'up_to_half', 'over_half')),
    note TEXT
  );
  CREATE INDEX nail_entry_ts ON nail_entry (ts_utc);
  `,
  // SK-7, SK-11, IN-6: daily check-in, stool entries and the list of daily tags. tags_json holds tag ids.
  `
  CREATE TABLE check_in (
    id TEXT PRIMARY KEY,
    ts_utc TEXT NOT NULL,
    tz TEXT NOT NULL,
    day TEXT NOT NULL,
    wellbeing INTEGER CHECK (wellbeing IS NULL OR wellbeing BETWEEN 0 AND 10),
    stress INTEGER CHECK (stress IS NULL OR stress BETWEEN 0 AND 10),
    sleep INTEGER CHECK (sleep IS NULL OR sleep BETWEEN 0 AND 10),
    abdominal_pain INTEGER CHECK (abdominal_pain IS NULL OR abdominal_pain BETWEEN 0 AND 10),
    bloating INTEGER NOT NULL CHECK (bloating IN (0, 1)),
    tags_json TEXT NOT NULL,
    note TEXT,
    completed_utc TEXT,
    completed_tz TEXT
  );
  CREATE INDEX check_in_ts ON check_in (ts_utc);
  CREATE INDEX check_in_day ON check_in (day);
  CREATE TABLE stool_entry (
    id TEXT PRIMARY KEY,
    ts_utc TEXT NOT NULL,
    tz TEXT NOT NULL,
    bristol INTEGER NOT NULL CHECK (bristol BETWEEN 1 AND 7),
    note TEXT
  );
  CREATE INDEX stool_entry_ts ON stool_entry (ts_utc);
  CREATE TABLE list_item (
    kind TEXT NOT NULL,
    id TEXT NOT NULL,
    name TEXT NOT NULL,
    predefined INTEGER NOT NULL,
    archived INTEGER NOT NULL DEFAULT 0,
    name_override TEXT,
    PRIMARY KEY (kind, id)
  );
  `,
  // IN-10 to IN-13: allergen tags on meals, treatment applications, change events and reactions.
  // area_ids_json and symptoms_json hold JSON arrays; a reaction points at its meal.
  `
  ALTER TABLE meal ADD COLUMN allergens_json TEXT NOT NULL DEFAULT '[]';
  CREATE TABLE treatment_application (
    id TEXT PRIMARY KEY,
    ts_utc TEXT NOT NULL,
    tz TEXT NOT NULL,
    treatment_id TEXT NOT NULL,
    area_ids_json TEXT NOT NULL,
    note TEXT
  );
  CREATE INDEX treatment_application_ts ON treatment_application (ts_utc);
  CREATE TABLE change_event (
    id TEXT PRIMARY KEY,
    ts_utc TEXT NOT NULL,
    tz TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('started', 'stopped')),
    category TEXT NOT NULL CHECK (category IN ('product', 'medication', 'diet')),
    name TEXT NOT NULL,
    note TEXT
  );
  CREATE INDEX change_event_ts ON change_event (ts_utc);
  CREATE TABLE reaction (
    id TEXT PRIMARY KEY,
    ts_utc TEXT NOT NULL,
    tz TEXT NOT NULL,
    meal_id TEXT NOT NULL REFERENCES meal (id),
    symptoms_json TEXT NOT NULL,
    note TEXT
  );
  CREATE INDEX reaction_ts ON reaction (ts_utc);
  `,
  // IN-4, IN-5: alcohol and medication or supplement entries.
  `
  CREATE TABLE alcohol_entry (
    id TEXT PRIMARY KEY,
    ts_utc TEXT NOT NULL,
    tz TEXT NOT NULL,
    drink TEXT NOT NULL,
    amount_ml INTEGER NOT NULL CHECK (amount_ml > 0),
    note TEXT
  );
  CREATE INDEX alcohol_entry_ts ON alcohol_entry (ts_utc);
  CREATE TABLE medication_entry (
    id TEXT PRIMARY KEY,
    ts_utc TEXT NOT NULL,
    tz TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('medication', 'supplement')),
    name TEXT NOT NULL,
    dose TEXT,
    note TEXT
  );
  CREATE INDEX medication_entry_ts ON medication_entry (ts_utc);
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
