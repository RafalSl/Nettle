/** Errors carry a stable code; the UI maps codes to i18n keys (no user text in core). */
export type ErrorCode =
  | 'empty_description'
  | 'invalid_score'
  | 'unknown_area'
  | 'area_archived'
  | 'empty_area_name'
  | 'predefined_area_locked'
  | 'import_corrupt_zip'
  | 'import_missing_data'
  | 'import_invalid_json'
  | 'import_unsupported_version'
  | 'import_invalid_data';

export class NettleError extends Error {
  constructor(
    readonly code: ErrorCode,
    detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'NettleError';
  }
}
