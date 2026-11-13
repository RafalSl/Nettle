import { EXTRA_KINDS, NAIL_EXTENTS, NAIL_STAGES, type ExtraKind, type NailEntry, type Records } from '../model/types';
import { nullableText, oneOf, str, utc, type Obj } from './guards';

/**
 * data.json wire format for the flat record kinds (see ExtraKind): `key` is the snake_case array name inside
 * `records`, `toJson` and `parse` convert one row. Adding a kind means adding one entry here.
 */
interface Codec<T> {
  key: string;
  toJson(record: T): Obj;
  parse(o: Obj, where: string): T;
}

const nail: Codec<NailEntry> = {
  key: 'nail_entries',
  toJson: (e) => ({
    id: e.id,
    utc: e.at.utc,
    tz: e.at.tz,
    area_id: e.areaId,
    stage: e.stage,
    extent: e.extent,
    note: e.note,
  }),
  parse: (o, w) => ({
    id: str(o, 'id', w),
    at: { utc: utc(o, w), tz: str(o, 'tz', w) },
    areaId: str(o, 'area_id', w),
    stage: oneOf(o, 'stage', NAIL_STAGES, w),
    extent: oneOf(o, 'extent', NAIL_EXTENTS, w),
    note: nullableText(o, 'note', w),
  }),
};

export const EXTRA_CODECS: { [K in ExtraKind]: Codec<Records[K][number]> } = {
  nailEntries: nail,
};

export { EXTRA_KINDS };
