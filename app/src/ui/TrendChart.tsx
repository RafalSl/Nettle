import { View } from 'react-native';
import { Text } from '@/ui/themed';
import type { TrendPoint } from '@/core/usecases/timeline';
import { t } from '@/i18n';
import { Hint, styles } from '@/ui/components';
import { color } from '@/ui/theme';

const MAX_POINTS = 30;

/**
 * UX-1: a bar chart of one trend, built from plain views (no extra library). Bars are scaled to `max`, the
 * latest `MAX_POINTS` days show, a flare start or end is marked under its bar, and the accessibility label says
 * the same in words: first and last value and the range.
 */
export function TrendChart({ points, max, label }: { points: readonly TrendPoint[]; max: number; label: string }) {
  const shown = points.slice(-MAX_POINTS);
  if (shown.length === 0) return <Hint>{t('review.trendEmpty')}</Hint>;
  const first = shown[0]!;
  const last = shown[shown.length - 1]!;
  const values = shown.map((p) => p.value);
  const summary = t('review.trendSummary', { label, from: first.day, to: last.day, first: first.value, last: last.value, min: Math.min(...values), max: Math.max(...values) });
  const HEIGHT = 80;
  return (
    <View accessible accessibilityLabel={summary} style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: HEIGHT, gap: 2 }}>
        {shown.map((p) => (
          <View key={p.day} style={{ flex: 1, height: Math.max(2, (p.value / max) * HEIGHT), backgroundColor: p.flare === 'start' ? color.alert : color.accent, borderRadius: 2 }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 2 }}>
        {shown.map((p) => (
          <Text key={p.day} style={[styles.hint, { flex: 1, textAlign: 'center', fontSize: 9 }]}>
            {p.flare === 'start' ? '▲' : p.flare === 'end' ? '▼' : ' '}
          </Text>
        ))}
      </View>
      <Hint>{summary}</Hint>
    </View>
  );
}
