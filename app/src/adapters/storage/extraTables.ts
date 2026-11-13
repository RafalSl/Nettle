import type { ExtraKind, NailEntry, NailExtent, NailStage, Records } from '@/core/model/types';
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

export const EXTRA_TABLES: { [K in ExtraKind]: ExtraTable<Records[K][number]> } = {
  nailEntries: nail,
};
