import type { EntryType } from '@/core/model/preferences';
import type { LogKind } from '@/core/usecases/dayLog';
import type { IconName } from '@/ui/Icon';

/** UX-12: entry types are told apart by icon and label, never by colour. */
export const ENTRY_ICON: Record<EntryType, IconName> = {
  meal: 'meal',
  drink: 'drink',
  medication: 'medication',
  skin: 'skin',
  nails: 'nails',
  treatment: 'treatment',
  checkin: 'health',
  stool: 'stool',
  reaction: 'reaction',
  change: 'change',
  medical: 'medical',
};

/** The entry type of each kind in the day's log. */
export const KIND_ENTRY: Record<LogKind, EntryType> = {
  meals: 'meal',
  skinEntries: 'skin',
  nailEntries: 'nails',
  checkIns: 'checkin',
  stoolEntries: 'stool',
  treatmentApplications: 'treatment',
  changeEvents: 'change',
  medicalEvents: 'medical',
  reactions: 'reaction',
  drinks: 'drink',
  medicationEntries: 'medication',
};
