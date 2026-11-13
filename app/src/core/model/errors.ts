/** Errors carry a stable code; the UI maps codes to i18n keys (no user text in core). */
/** Every code the core can throw; the i18n test checks that each one has a message. */
export const ERROR_CODES = [
  'empty_description',
  'invalid_score',
  'unknown_area',
  'area_archived',
  'wrong_area_kind',
  'unknown_item',
  'empty_item_name',
  'invalid_stool_type',
  'checkin_not_found',
  'import_unknown_item',
  'import_unknown_meal',
  'unknown_meal',
  'invalid_value',
  'no_areas_selected',
  'reaction_before_meal',
  'invalid_nail_value',
  'empty_area_name',
  'import_corrupt_zip',
  'import_missing_data',
  'import_invalid_json',
  'import_unsupported_version',
  'import_invalid_data',
  'import_unknown_area',
  'import_password_required',
  'import_wrong_password',
  'import_too_large',
  'password_too_short',
  'invalid_range',
  'invalid_amount',
  'empty_name',
  'no_previous_entry',
  'nothing_selected',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export class NettleError extends Error {
  constructor(
    readonly code: ErrorCode,
    detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'NettleError';
  }
}
