import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import type { ListItem, SkinArea } from '@/core/model/types';
import { dayLog, type LogRow } from '@/core/usecases/dayLog';
import { errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { Button, Heading, Screen } from '@/ui/components';
import { DayLog } from '@/ui/DayLog';

/** UX-2: one day's full log (Today shows only the newest entries), opened from "Show all" or the days list. */
export default function ReviewDayScreen() {
  const { deps } = useServices();
  const router = useRouter();
  const { day } = useLocalSearchParams<{ day?: string }>();
  const [rows, setRows] = useState<LogRow[]>([]);
  const [ctx, setCtx] = useState<{ areas: SkinArea[]; treatments: ListItem[]; categories: ListItem[] }>({ areas: [], treatments: [], categories: [] });
  const valid = typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
  const load = useCallback(() => {
    if (!valid) return;
    (async () => {
      setRows(await dayLog(deps, valid));
      setCtx({ areas: await deps.repo.listAreas(), treatments: await deps.repo.listItems('treatments'), categories: await deps.repo.listItems('changeCategories') });
    })().catch((e) => Alert.alert(errorMessage(e)));
  }, [deps, valid]);
  useFocusEffect(load);
  if (!valid) return <Screen>{null}</Screen>;
  return (
    <Screen>
      <Heading>{valid}</Heading>
      <DayLog rows={rows} ctx={ctx} onChanged={load} />
      <Button kind="secondary" title={t('day.openOnToday')} onPress={() => router.navigate({ pathname: '/today', params: { day: valid } })} />
    </Screen>
  );
}
