import type { EntryType } from '@/core/model/preferences';
import { t } from '@/i18n';

/** UX-2: the form each entry type opens. */
export const ENTRY_ROUTE: Record<
  EntryType,
  | '/form/meal'
  | '/form/drink'
  | '/form/medication'
  | '/form/skin'
  | '/form/nails'
  | '/form/treatment'
  | '/form/checkin'
  | '/form/stool'
  | '/form/reaction'
  | '/form/change'
  | '/form/medical'
> = {
  meal: '/form/meal',
  drink: '/form/drink',
  medication: '/form/medication',
  skin: '/form/skin',
  nails: '/form/nails',
  treatment: '/form/treatment',
  checkin: '/form/checkin',
  stool: '/form/stool',
  reaction: '/form/reaction',
  change: '/form/change',
  medical: '/form/medical',
};

export const entryTitle = (id: EntryType) => t(`entry.${id}.title`);
/** UX-11: the one-line subtitle of More rows and of the layout editor. */
export const entrySubtitle = (id: EntryType) => t(`entry.${id}.hint`);
