import type { SkinArea } from './types';

/**
 * SK-1, SK-5. Names here are English seed values; the UI localizes predefined areas by id. The last three are the
 * intimate areas, kept apart because they respond differently to treatment; each is sensitive by default.
 */
export const PREDEFINED_AREAS: readonly SkinArea[] = [
  ['area-chin', 'Chin', false],
  ['area-neck', 'Neck', false],
  ['area-ears-inside', 'Ears (inside)', false],
  ['area-behind-ears', 'Behind the ears', false],
  ['area-sternum', 'Sternum', false],
  ['area-penis', 'Penis', true],
  ['area-perineum-groin', 'Perineum and groin', true],
  ['area-between-buttocks', 'Between the buttocks', true],
].map(([id, name, sensitiveDefault]) => ({
  id: id as string,
  kind: 'skin' as const,
  name: name as string,
  predefined: true,
  archived: false,
  sensitiveDefault: sensitiveDefault as boolean,
  nameOverride: null,
}));
