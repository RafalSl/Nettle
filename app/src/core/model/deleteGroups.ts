import type { RecordKind } from './types';

/** SE-9: the groups a person picks from when deleting by entry type. Together they cover every record kind once. */
export const DELETE_GROUPS = {
  food: ['meals', 'reactions', 'drinks', 'medicationEntries'],
  skin: ['skinEntries', 'nailEntries', 'photos', 'treatmentApplications'],
  health: ['checkIns', 'stoolEntries', 'changeEvents', 'medicalEvents'],
  ai: ['analyses', 'reportSummaries'],
} as const satisfies Record<string, readonly RecordKind[]>;

export type DeleteGroup = keyof typeof DELETE_GROUPS;
export const DELETE_GROUP_IDS = Object.keys(DELETE_GROUPS) as DeleteGroup[];
