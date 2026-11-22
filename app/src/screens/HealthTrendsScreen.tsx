import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import type { ListItem } from '@/core/model/types';
import { localDay } from '@/core/model/time';
import {
  DEFAULT_TREND_RANGE,
  healthTrendPoints,
  limitTrend,
  trendScoreItems,
  type TrendPoint,
  type TrendRange,
} from '@/core/usecases/timeline';
import { itemDescription, itemLabel, t } from '@/i18n';
import { useServices } from '@/services';
import { useNow } from '@/ui/useNow';
import { TrendChart } from '@/ui/TrendChart';
import { Chips, Heading, Hint, Screen } from '@/ui/components';
import { showError } from '@/ui/showError';

/** SK-7, UX-1: a trend chart of one Daily health score item (0 to 10), one bar per logged day, with a text summary. */
export default function HealthTrendsScreen() {
  const { deps } = useServices();
  const [items, setItems] = useState<ListItem[]>([]);
  const [pick, setPick] = useState<string | null>(null);
  const [points, setPoints] = useState<TrendPoint[]>([]);
  const [range, setRange] = useState<TrendRange>(DEFAULT_TREND_RANGE);
  const selected = pick && items.some((i) => i.id === pick) ? pick : (items[0]?.id ?? null);

  useFocusEffect(
    useCallback(() => {
      trendScoreItems(deps).then(setItems, (e) => showError(e));
    }, [deps]),
  );
  useFocusEffect(
    useCallback(() => {
      if (selected) healthTrendPoints(deps, selected).then(setPoints, (e) => showError(e));
    }, [deps, selected]),
  );
  const now = useNow(deps);
  const item = items.find((i) => i.id === selected);
  return (
    <Screen>
      <Heading>{t('review.healthTitle')}</Heading>
      {items.length === 0 ? (
        <Hint>{t('review.healthEmpty')}</Hint>
      ) : (
        <>
          <Chips
            items={items.map((i) => ({ id: i.id, label: itemLabel(i) }))}
            selected={new Set(selected ? [selected] : [])}
            onToggle={setPick}
          />
          {item && itemDescription(item) ? <Hint>{itemDescription(item)}</Hint> : null}
          <TrendChart
            points={limitTrend(points, range, localDay(now.toISOString(), deps.clock.timeZone(), deps.dayStart.get()))}
            max={10}
            label={item ? itemLabel(item) : ''}
            range={range}
            onRange={setRange}
          />
        </>
      )}
    </Screen>
  );
}
