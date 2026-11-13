import type { CheckIn, ExtraKind, NailEntry, NailExtent, NailStage, Records, StoolEntry } from '@/core/model/types';
import type { SqlValue } from './sqlDb';

type Row = Record<string, string | number | null>;

/**
 * How one flat record kind maps to a table (like a tiny ORM mapping). The first three columns are always
 * id, ts_utc, tz so range queries, ordering and id lookups work the same for every kind.
 */
export interface ExtraTable<T> {
  table: string;
  /** Columns after id, ts_utc and tz. */
  columns: string[];
  toValues(record: T): SqlValue[];
  fromRow(row: Row): T;
}

const nail: ExtraTable<NailEntry> = {
  table: 'nail_entry',
  columns: ['area_id', 'stage', 'extent', 'note'],
  toValues: (e) => [e.areaId, e.stage, e.extent, e.note],
  fromRow: (r) => ({
    id: r.id as string,
    at: { utc: r.ts_utc as string, tz: r.tz as string },
    areaId: r.area_id as string,
    stage: r.stage as NailStage,
    extent: r.extent as NailExtent,
    note: r.note as string | null,
  }),
};

const checkIn: ExtraTable<CheckIn> = {
  table: 'check_in',
  columns: [
    'day',
    'wellbeing',
    'stress',
    'sleep',
    'abdominal_pain',
    'bloating',
    'tags_json',
    'note',
    'completed_utc',
    'completed_tz',
  ],
  toValues: (c) => [
    c.day,
    c.wellbeing,
    c.stress,
    c.sleep,
    c.abdominalPain,
    +c.bloating,
    JSON.stringify(c.tags),
    c.note,
    c.completedAt?.utc ?? null,
    c.completedAt?.tz ?? null,
  ],
  fromRow: (r) => ({
    id: r.id as string,
    at: { utc: r.ts_utc as string, tz: r.tz as string },
    day: r.day as string,
    wellbeing: r.wellbeing as number | null,
    stress: r.stress as number | null,
    sleep: r.sleep as number | null,
    abdominalPain: r.abdominal_pain as number | null,
    bloating: !!r.bloating,
    tags: JSON.parse(r.tags_json as string) as string[],
    note: r.note as string | null,
    completedAt: r.completed_utc ? { utc: r.completed_utc as string, tz: r.completed_tz as string } : null,
  }),
};

const stool: ExtraTable<StoolEntry> = {
  table: 'stool_entry',
  columns: ['bristol', 'note'],
  toValues: (e) => [e.bristol, e.note],
  fromRow: (r) => ({
    id: r.id as string,
    at: { utc: r.ts_utc as string, tz: r.tz as string },
    bristol: r.bristol as number,
    note: r.note as string | null,
  }),
};

export const EXTRA_TABLES: { [K in ExtraKind]: ExtraTable<Records[K][number]> } = {
  nailEntries: nail,
  checkIns: checkIn,
  stoolEntries: stool,
};
