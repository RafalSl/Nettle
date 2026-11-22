import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import type { ListItem, SkinArea } from '@/core/model/types';
import { dayParam } from '@/core/model/time';
import { dayLog, type LogRow } from '@/core/usecases/dayLog';
import { t } from '@/i18n';
import { useServices } from '@/services';
import { useFocusLoad } from '@/ui/useFocusLoad';
import { Button, Heading, Screen } from '@/ui/components';
import { DayLog } from '@/ui/DayLog';

/** UX-2: one day's full log (Today shows only the newest entries), opened from "Show all" or the days list. */
export default function ReviewDayScreen() {
  const { deps } = useServices();
  const router = useRouter();
  const { day } = useLocalSearchParams<{ day?: string }>();
  const [rows, setRows] = useState<LogRow[]>([]);
  const [ctx, setCtx] = useState<{ areas: SkinArea[]; treatments: ListItem[]; categories: ListItem[] }>({
    areas: [],
    treatments: [],
    categories: [],
  });
  const valid = dayParam(day);
  const load = useFocusLoad(
    async () =>
      valid
        ? {
            rows: await dayLog(deps, valid),
            ctx: {
              areas: await deps.repo.listAreas(),
              treatments: await deps.repo.listItems('treatments'),
              categories: await deps.repo.listItems('changeCategories'),
            },
          }
        : null,
    [deps, valid],
    (r) => {
      if (!r) return;
      setRows(r.rows);
      setCtx(r.ctx);
    },
  );
  if (!valid) return <Screen>{null}</Screen>;
  return (
    <Screen>
      <Heading>{valid}</Heading>
      <DayLog rows={rows} ctx={ctx} onChanged={load} />
      <Button
        kind="secondary"
        title={t('day.openOnToday')}
        onPress={() => router.navigate({ pathname: '/today', params: { day: valid } })}
      />
    </Screen>
  );
}
