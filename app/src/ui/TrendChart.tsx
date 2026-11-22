import { View } from 'react-native';
import { Text } from '@/ui/themed';
import { downsample, TREND_RANGES, type TrendPoint, type TrendRange } from '@/core/usecases/timeline';
import { t } from '@/i18n';
import { Hint, Segmented, styles } from '@/ui/components';
import { GlassSurface } from '@/ui/GlassSurface';
import { color } from '@/ui/theme';

const MAX_BARS = 90;

/**
 * UX-1, SK-8: a bar chart of one trend in a glass card, built from plain views (no extra library). A range switch
 * (30 days, 90 days, 1 year, All) sits above it; the caller filters the points by the range. Bars are scaled to
 * `max`, a flare start is coral and a start or end is marked under its bar, and the accessibility label says the
 * same in words: first and last value and the range. More than 90 days are drawn as averages of several days.
 */
export function TrendChart({
  points,
  max,
  label,
  range,
  onRange,
}: {
  points: readonly TrendPoint[];
  max: number;
  label: string;
  range?: TrendRange;
  onRange?: (r: TrendRange) => void;
}) {
  const shown = downsample(points, MAX_BARS);
  const compressed = shown.length < points.length;
  const sw =
    range && onRange ? (
      <Segmented
        items={TREND_RANGES.map((r) => ({ id: r, label: t(`review.range.${r}`) }))}
        value={range}
        onChange={(id) => onRange(id as TrendRange)}
      />
    ) : null;
  if (shown.length === 0)
    return (
      <View style={{ gap: 8 }}>
        {sw}
        <Hint>{t('review.trendEmpty')}</Hint>
      </View>
    );
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const values = points.map((p) => p.value);
  const summary = t('review.trendSummary', {
    label,
    from: first.day,
    to: last.day,
    first: first.value,
    last: last.value,
    min: Math.min(...values),
    max: Math.max(...values),
  });
  const HEIGHT = 80;
  return (
    <GlassSurface style={{ borderRadius: 28, padding: 14, gap: 10 }}>
      {sw}
      <View accessible accessibilityLabel={summary} style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: HEIGHT, gap: 2 }}>
          {shown.map((p) => (
            <View
              key={p.day}
              style={{
                flex: 1,
                height: Math.max(2, (p.value / max) * HEIGHT),
                backgroundColor: p.flare === 'start' ? color.alert : color.accent,
                borderRadius: 2,
              }}
            />
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
        {compressed && <Hint>{t('review.trendCompressed')}</Hint>}
      </View>
    </GlassSurface>
  );
}
