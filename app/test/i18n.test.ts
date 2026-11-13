import en from '@/i18n/en.json';
import pl from '@/i18n/pl.json';
import { PREDEFINED_AREAS } from '@/core/model/areas';
import { ERROR_CODES } from '@/core/model/errors';
import { PREDEFINED_ITEMS } from '@/core/model/lists';
import { ALLERGENS, LIST_KINDS, NAIL_EXTENTS, NAIL_STAGES } from '@/core/model/types';

const keys = (o: object, prefix = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );

describe('i18n (NF-6)', () => {
  it('English and Polish have exactly the same keys', () => {
    expect(keys(pl).sort()).toEqual(keys(en).sort());
  });

  it('every predefined area has a translation', () => {
    for (const a of PREDEFINED_AREAS) expect(en.areas).toHaveProperty([a.id]);
  });

  it('every error code has a translation', () => {
    for (const c of ERROR_CODES) expect(en.errors).toHaveProperty([c]);
  });

  it('every predefined daily tag has a translation (IN-6)', () => {
    for (const k of LIST_KINDS) for (const i of PREDEFINED_ITEMS[k]) expect(en.tags).toHaveProperty([i.id]);
  });

  it('every allergen, nail stage and nail extent has a translation (IN-10, SK-10)', () => {
    for (const a of ALLERGENS) expect(en.allergens).toHaveProperty([a]);
    for (const s of NAIL_STAGES) expect(en.nail.stages).toHaveProperty([s]);
    for (const x of NAIL_EXTENTS) expect(en.nail.extents).toHaveProperty([x]);
  });
});
