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
  // SK-4, SK-5: photo records. entry_id points at a skin_entry or a nail_entry, depending on entry_kind, so
  // there is no foreign key; the use cases and import check it and deletion removes photos with their entry.
  `
  CREATE TABLE photo (
    id TEXT PRIMARY KEY,
    ts_utc TEXT NOT NULL,
    tz TEXT NOT NULL,
    entry_kind TEXT NOT NULL CHECK (entry_kind IN ('skinEntry', 'nailEntry')),
    entry_id TEXT NOT NULL,
    sensitive INTEGER NOT NULL CHECK (sensitive IN (0, 1)),
    file TEXT NOT NULL UNIQUE
  );
  CREATE INDEX photo_ts ON photo (ts_utc);
  CREATE INDEX photo_entry ON photo (entry_id);
  `,
  // LL-9: small device settings (the model name). Not exported; the API key is never stored here.
  `CREATE TABLE app_setting (key TEXT PRIMARY KEY, value TEXT NOT NULL);`,
  // LL-7: stored analyses. counts_json and result_json hold JSON; the result has the same shape as in data.json.
  `
  CREATE TABLE analysis (
    id TEXT PRIMARY KEY,
    ts_utc TEXT NOT NULL,
    tz TEXT NOT NULL,
    day_from TEXT NOT NULL,
    day_to TEXT NOT NULL,
    model TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    language TEXT NOT NULL CHECK (language IN ('en', 'pl')),
    counts_json TEXT NOT NULL,
    result_json TEXT NOT NULL
  );
  CREATE INDEX analysis_ts ON analysis (ts_utc);
  `,
  // SK-6: flare start and end markers per area.
  `
  CREATE TABLE flare_marker (
    id TEXT PRIMARY KEY,
    ts_utc TEXT NOT NULL,
    tz TEXT NOT NULL,
    area_id TEXT NOT NULL REFERENCES skin_area (id),
    kind TEXT NOT NULL CHECK (kind IN ('start', 'end')),
    note TEXT
  );
  CREATE INDEX flare_marker_ts ON flare_marker (ts_utc);
  `,
  // EX-13: tombstones of single deleted entries (EN-1). Bulk delete (SE-9) leaves none.
  `
  CREATE TABLE tombstone (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    deleted_utc TEXT NOT NULL,
    deleted_tz TEXT NOT NULL
  );
  `,
  // EX-1, IN-14, UX-2: favorites, suggestion settings and the quick-action layout, one JSON document.
  `
  CREATE TABLE preference (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    json TEXT NOT NULL
  );
  `,
  // IN-4: alcohol entries become drinks (any beverage) with an alcohol switch, ingredients and allergen tags.
  // Existing rows were all alcoholic. Tombstones follow the new kind name; the old favorite drinks (a different
  // shape) are dropped, since only prototype data exists.
  `
  ALTER TABLE alcohol_entry RENAME TO drink;
  ALTER TABLE drink RENAME COLUMN drink TO name;
  ALTER TABLE drink ADD COLUMN alcohol INTEGER NOT NULL DEFAULT 1 CHECK (alcohol IN (0, 1));
  ALTER TABLE drink ADD COLUMN ingredients_json TEXT NOT NULL DEFAULT '[]';
  ALTER TABLE drink ADD COLUMN allergens_json TEXT NOT NULL DEFAULT '[]';
  DROP INDEX alcohol_entry_ts;
  CREATE INDEX drink_ts ON drink (ts_utc);
  UPDATE tombstone SET kind = 'drinks' WHERE kind = 'alcoholEntries';
  UPDATE preference SET json = json_set(json_remove(json, '$.favorites.alcohol'), '$.favorites.drinks', json('[]'));
  `,
  // IN-2, IN-16: the barcode an entry was made from and where its ingredients came from. Existing rows are typed.
  // Favorites are dropped again: their snapshots now carry both fields (prototype data only).
  `
  ALTER TABLE meal ADD COLUMN barcode TEXT;
  ALTER TABLE meal ADD COLUMN source_json TEXT NOT NULL DEFAULT '{"kind":"typed","edited":false,"llm":null}';
  ALTER TABLE drink ADD COLUMN barcode TEXT;
  ALTER TABLE drink ADD COLUMN source_json TEXT NOT NULL DEFAULT '{"kind":"typed","edited":false,"llm":null}';
  CREATE INDEX meal_barcode ON meal (barcode);
  CREATE INDEX drink_barcode ON drink (barcode);
  UPDATE preference SET json = json_set(json, '$.favorites.meals', json('[]'), '$.favorites.drinks', json('[]'));
  `,
  // LL-14: stored report summaries (the AI narrative a doctor report can open with).
  `
  CREATE TABLE report_summary (
    id TEXT PRIMARY KEY,
    ts_utc TEXT NOT NULL,
    tz TEXT NOT NULL,
    day_from TEXT NOT NULL,
    day_to TEXT NOT NULL,
    language TEXT NOT NULL CHECK (language IN ('en', 'pl')),
    model TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    counts_json TEXT NOT NULL,
    generated TEXT NOT NULL,
    text TEXT NOT NULL
  );
  CREATE INDEX report_summary_ts ON report_summary (ts_utc);
  `,
  // SK-7, SK-11, IN-6: Daily health. Values keyed by item id replace the fixed scores, bloating and tags, and the
  // day-complete mark goes; list items get a value kind and a description. Prototype data is dropped (no old-data handling).
  `
  DROP TABLE check_in;
  CREATE TABLE check_in (
    id TEXT PRIMARY KEY,
    ts_utc TEXT NOT NULL,
    tz TEXT NOT NULL,
    day TEXT NOT NULL,
    values_json TEXT NOT NULL,
    note TEXT
  );
  CREATE INDEX check_in_ts ON check_in (ts_utc);
  CREATE INDEX check_in_day ON check_in (day);
  DELETE FROM list_item WHERE kind = 'dailyTags';
  ALTER TABLE list_item ADD COLUMN value_kind TEXT NOT NULL DEFAULT 'yesno' CHECK (value_kind IN ('score', 'yesno'));
  ALTER TABLE list_item ADD COLUMN description TEXT;
  UPDATE preference SET json = json_remove(json, '$.checkInScores');
  `,
  // SK-6: flares are derived from skin entries, so the marker table goes (prototype data only).
  `
  DROP TABLE flare_marker;
  `,
  // IN-12: routine changes. Categories are a list (ids, so the user can add some) and a start can be "date unknown".
  // The medication category goes. Prototype data only: the table is recreated.
  `
  DROP TABLE change_event;
  CREATE TABLE change_event (
    id TEXT PRIMARY KEY,
    ts_utc TEXT NOT NULL,
    tz TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('started', 'stopped')),
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    date_unknown INTEGER NOT NULL DEFAULT 0 CHECK (date_unknown IN (0, 1)),
    note TEXT
  );
  CREATE INDEX change_event_ts ON change_event (ts_utc);
  `,
  // SK-1: the single "intimate area" became three predefined areas (penis, perineum and groin, between the buttocks).
  // A database that still has the old row keeps it as an archived area under its stored name, so nothing that points
  // at it breaks and no translation key is needed; a new database never has it. Prototype data only.
  `
  UPDATE skin_area SET predefined = 0, archived = 1 WHERE id = 'area-intimate';
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
