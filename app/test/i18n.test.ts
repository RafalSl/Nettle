import en from '@/i18n/en.json';
import pl from '@/i18n/pl.json';
import { PREDEFINED_AREAS } from '@/core/model/areas';
import type { ErrorCode } from '@/core/model/errors';

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
    const codes: ErrorCode[] = [
      'empty_description', 'invalid_score', 'unknown_area', 'area_archived', 'empty_area_name',
      'import_corrupt_zip', 'import_missing_data', 'import_invalid_json',
      'import_unsupported_version', 'import_invalid_data', 'import_unknown_area', 'nothing_selected',
    ];
    for (const c of codes) expect(en.errors).toHaveProperty([c]);
  });
});
