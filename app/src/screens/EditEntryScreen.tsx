import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import type { ListItem, RecordKind, SkinArea } from '@/core/model/types';
import { LOG_KINDS, type LogRow } from '@/core/usecases/dayLog';
import { getEntry } from '@/core/usecases/entries';
import { EditChange } from '@/forms/change/EditChange';
import { EditCheckIn } from '@/forms/checkin/EditCheckIn';
import { EditDrink } from '@/forms/drink/EditDrink';
import { EditMeal } from '@/forms/meal/EditMeal';
import { EditMedical } from '@/forms/medical/EditMedical';
import { EditMedication } from '@/forms/medication/EditMedication';
import { EditNail } from '@/forms/nails/EditNail';
import { EditReaction } from '@/forms/reaction/EditReaction';
import { EditSkin } from '@/forms/skin/EditSkin';
import { EditStool } from '@/forms/stool/EditStool';
import { EditTreatment } from '@/forms/treatment/EditTreatment';
import { t } from '@/i18n';
import { useServices } from '@/services';
import { Hint } from '@/ui/components';

interface Loaded {
  row: LogRow;
  areas: SkinArea[];
  treatments: ListItem[];
  dailyItems: ListItem[];
  categories: ListItem[];
}

/** Areas and items that are archived stay listed only when the entry already uses them. */
const usable = <T extends { id: string; archived: boolean }>(l: T[], used: string[]) => l.filter((x) => !x.archived || used.includes(x.id));

/**
 * EN-1: edit one entry of the day's log. The route carries the record kind and id; the form for the kind (in
 * `src/forms/<kind>/Edit*.tsx`) loads with the record and saves through the matching `edit*` use case, which keeps
 * the id and applies the edit rules. Only the fields the entry has are shown, in the unified modal (UX-3).
 */
export default function EditEntryScreen() {
  const { deps } = useServices();
  const { kind, id, suggestion } = useLocalSearchParams<{ kind: string; id: string; suggestion?: string }>();
  const suggestionId = typeof suggestion === 'string' && suggestion ? suggestion : null; // IN-20: opened from "Suggestions to review"
  const [state, setState] = useState<Loaded | 'missing' | null>(null);

  useEffect(() => {
    (async () => {
      if (!(LOG_KINDS as readonly string[]).includes(kind)) return setState('missing');
      const record = await getEntry(deps, kind as RecordKind, id);
      setState({
        row: { kind, id, at: (record as { at: LogRow['at'] }).at, record } as LogRow,
        areas: await deps.repo.listAreas(),
        treatments: await deps.repo.listItems('treatments'),
        dailyItems: await deps.repo.listItems('dailyItems'),
        categories: await deps.repo.listItems('changeCategories'),
      });
    })().catch(() => setState('missing'));
  }, [deps, kind, id]);

  if (state === null) return null;
  if (state === 'missing') return <Hint>{t('edit.unavailable')}</Hint>;
  const { row, areas, treatments, dailyItems, categories } = state;
  switch (row.kind) {
    case 'meals':
      return <EditMeal r={row.record} suggestionId={suggestionId} />;
    case 'drinks':
      return <EditDrink r={row.record} suggestionId={suggestionId} />;
    case 'skinEntries':
      return <EditSkin r={row.record} areas={usable(areas, [row.record.areaId])} />;
    case 'nailEntries':
      return <EditNail r={row.record} areas={usable(areas, [row.record.areaId])} />;
    case 'checkIns':
      return <EditCheckIn r={row.record} items={dailyItems.filter((i) => !i.archived)} />;
    case 'stoolEntries':
      return <EditStool r={row.record} />;
    case 'treatmentApplications':
      return (
        <EditTreatment r={row.record} areas={usable(areas, row.record.areaIds)} treatments={usable(treatments, [row.record.treatmentId])} />
      );
    case 'changeEvents':
      return <EditChange r={row.record} categories={categories} />;
    case 'medicalEvents':
      return <EditMedical r={row.record} />;
    case 'reactions':
      return <EditReaction r={row.record} />;
    case 'medicationEntries':
      return <EditMedication r={row.record} />;
  }
}
