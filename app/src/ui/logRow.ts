import type { IngredientSource } from '@/core/model/source';
import type { LogRow } from '@/core/usecases/dayLog';
import type { ListItem, SkinArea, SkinScores } from '@/core/model/types';
import { areaLabel, itemLabel, t } from '@/i18n';

export interface RowContext {
  areas: SkinArea[];
  treatments: ListItem[];
  /** IN-12: the routine change categories. */
  categories: ListItem[];
}

/** IN-16: the source shown on an entry; typed entries say nothing. */
const sourceLabel = (s: IngredientSource): string =>
  s.kind === 'typed' ? '' : `${t(`source.${s.kind}`)}${s.edited ? `, ${t('source.edited')}` : ''}`;

const categoryLabel = (ctx: RowContext, id: string) => {
  const c = ctx.categories.find((x) => x.id === id);
  return c ? itemLabel(c) : id;
};

/** SK-3: the cracks flag and size of a skin entry as short phrases, empty when there is nothing to say. */
export const skinExtras = (e: { cracks: boolean; sizeMm: number | null }): string[] => [
  ...(e.cracks ? [t('log.cracks')] : []),
  ...(e.sizeMm !== null ? [t('log.sizeMm', { n: e.sizeMm })] : []),
];

/** SK-3: the scores of a skin entry with its cracks flag and size, for a row or a timeline line. */
export const skinSummary = (e: { scores: SkinScores; cracks: boolean; sizeMm: number | null }): string =>
  [t('log.scores', { ...e.scores }), ...skinExtras(e)].join(', ');

/** UX-2: the text of one row of the day's log. Only ids and enums are looked up; free text is shown as typed. */
export function describeRow(row: LogRow, ctx: RowContext): { title: string; detail: string | null } {
  const area = (id: string) => {
    const a = ctx.areas.find((x) => x.id === id);
    return a ? areaLabel(a) : id;
  };
  switch (row.kind) {
    case 'meals':
      return { title: row.record.description, detail: [row.record.ingredients.join(', '), sourceLabel(row.record.source)].filter(Boolean).join(' · ') || null };
    case 'skinEntries':
      return { title: `${t('log.skin')}: ${area(row.record.areaId)}`, detail: skinSummary(row.record) };
    case 'nailEntries':
      return {
        title: `${t('log.nail')}: ${area(row.record.areaId)}`,
        detail: `${t(`nail.stages.${row.record.stage}`)}, ${t(`nail.extents.${row.record.extent}`)}`,
      };
    case 'checkIns':
      return { title: t('log.checkin'), detail: null };
    case 'stoolEntries':
      return { title: t('log.stool', { n: row.record.bristol }), detail: null };
    case 'treatmentApplications': {
      const treatment = ctx.treatments.find((x) => x.id === row.record.treatmentId);
      return {
        title: t('log.treatment', {
          name: treatment ? itemLabel(treatment) : row.record.treatmentId,
          areas: row.record.areaIds.map(area).join(', '),
        }),
        detail: null,
      };
    }
    case 'changeEvents':
      return {
        title: t('log.change', { action: t(`change.actions.${row.record.action}`), name: row.record.name }),
        detail: [categoryLabel(ctx, row.record.category), row.record.dateUnknown ? t('change.dateUnknownShort') : ''].filter(Boolean).join(' · '),
      };
    case 'reactions':
      return { title: t('log.reaction', { symptoms: row.record.symptoms.map((s) => t(`symptoms.${s}`)).join(', ') }), detail: null };
    case 'drinks':
      return { title: t('log.drink', { name: row.record.name, ml: row.record.amountMl }), detail: [row.record.alcohol ? t('log.alcoholic') : '', sourceLabel(row.record.source)].filter(Boolean).join(' · ') || null };
    case 'medicationEntries':
      return { title: t('log.medication', { name: row.record.name }), detail: row.record.dose };
  }
}
