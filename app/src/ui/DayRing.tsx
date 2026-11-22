import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, PanResponder, Pressable, View } from 'react-native';
import Svg, { Circle, G, Text as SvgText } from 'react-native-svg';
import { hourLabels, type RingDot } from '@/core/model/ring';
import { t } from '@/i18n';
import { GlassSurface } from '@/ui/GlassSurface';
import { Icon } from '@/ui/Icon';
import { Text } from '@/ui/themed';
import { color, fontFamily } from '@/ui/theme';

const SIZE = 256;
const C = SIZE / 2;
const R_INTAKE = 100;
const R_CARE = 74;
const DOT_BOX = 28; // the visible dot is smaller; the box is the touch target (hit slop makes it 44)
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const circumference = (r: number) => 2 * Math.PI * r;
const point = (position: number, r: number) => ({
  x: C + r * Math.cos(-Math.PI / 2 + 2 * Math.PI * position),
  y: C + r * Math.sin(-Math.PI / 2 + 2 * Math.PI * position),
});

/**
 * UX-2, UX-12: the day ring. A 256 pt glass dial: the outer track holds intake (filled dots), the inner one body and
 * care (hollow dots); an accent arc runs up to now on today and draws in once; the hour labels count from the day
 * start. The centre shows the weekday, the date (a tap opens the date picker) and the entry count. A swipe moves the
 * day (the faint arrows beside the ring do the same); a tap on a dot opens that entry (a merged dot, its entries).
 */
export function DayRing({
  dots,
  arc,
  startHour,
  weekday,
  date,
  count,
  canGoNext,
  onPrevious,
  onNext,
  onPickDate,
  onDot,
}: {
  dots: RingDot[];
  /** Fraction of the day up to now (today), or null. */
  arc: number | null;
  startHour: number;
  weekday: string;
  date: string;
  count: number;
  canGoNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onPickDate: () => void;
  onDot: (dot: RingDot) => void;
}) {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (arc === null) return;
    const run = Animated.timing(progress, { toValue: arc, duration: 1400, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    run.start();
    return () => run.stop();
  }, [arc, progress]);
  const cInt = circumference(R_INTAKE);
  const dashOffset = progress.interpolate({ inputRange: [0, 1], outputRange: [cInt, 0] });

  // A horizontal swipe moves the day; a vertical one stays with the page scroll.
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 14 && Math.abs(g.dx) > 2 * Math.abs(g.dy),
        onPanResponderRelease: (_e, g) => {
          if (g.dx > 50) onPrevious();
          else if (g.dx < -50 && canGoNext) onNext();
        },
      }),
    [onPrevious, onNext, canGoNext],
  );
  const labels = hourLabels(startHour);

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', height: SIZE }}>
      <View {...pan.panHandlers} style={{ width: SIZE, height: SIZE }}>
        <GlassSurface blur={22} style={{ width: SIZE, height: SIZE, borderRadius: SIZE / 2 }}>
          <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
            <Circle cx={C} cy={C} r={R_INTAKE} stroke={color.glassLine} strokeWidth={1.5} fill="none" />
            <Circle cx={C} cy={C} r={R_CARE} stroke={color.glassLine} strokeWidth={1.5} fill="none" />
            {arc !== null && (
              <G rotation={-90} originX={C} originY={C}>
                <AnimatedCircle
                  cx={C}
                  cy={C}
                  r={R_INTAKE}
                  stroke={color.accent}
                  strokeOpacity={0.25}
                  strokeWidth={9}
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray={cInt}
                  strokeDashoffset={dashOffset}
                />
                <AnimatedCircle
                  cx={C}
                  cy={C}
                  r={R_INTAKE}
                  stroke={color.accent}
                  strokeWidth={3}
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray={cInt}
                  strokeDashoffset={dashOffset}
                />
              </G>
            )}
            {labels.map((l, i) => {
              const p = point(i / 4, 118);
              return (
                <SvgText key={l} x={p.x} y={p.y + 4} fontSize={11} fontFamily={fontFamily('600')} fill={color.muted} textAnchor="middle">
                  {l}
                </SvgText>
              );
            })}
          </Svg>
          <View
            pointerEvents="box-none"
            style={{ position: 'absolute', left: 0, top: 0, width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('day.jump')}
              onPress={onPickDate}
              hitSlop={8}
              style={{ alignItems: 'center' }}
            >
              <Text style={{ fontSize: 12.5, fontWeight: '600', letterSpacing: 1.8, color: color.accent, textTransform: 'uppercase' }}>
                {weekday}
              </Text>
              <Text style={{ fontSize: 38, fontWeight: '800', letterSpacing: -1.2 }}>{date}</Text>
              <Text style={{ fontSize: 13, color: color.muted }}>{t('day.entries', { n: count })}</Text>
            </Pressable>
          </View>
          {dots.map((d) => {
            const p = point(d.position, d.track === 'intake' ? R_INTAKE : R_CARE);
            const merged = d.ids.length > 1;
            const size = merged ? 20 : 13;
            return (
              <Pressable
                key={`${d.track}-${d.ids[0]}`}
                accessibilityRole="button"
                accessibilityLabel={t('day.dot', { n: d.ids.length })}
                onPress={() => onDot(d)}
                hitSlop={8}
                style={{
                  position: 'absolute',
                  left: p.x - DOT_BOX / 2,
                  top: p.y - DOT_BOX / 2,
                  width: DOT_BOX,
                  height: DOT_BOX,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View
                  style={{
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: d.track === 'intake' ? color.accent : color.ground,
                    borderWidth: d.track === 'intake' ? 0 : 2,
                    borderColor: color.accent,
                  }}
                >
                  {merged ? (
                    <Text style={{ fontSize: 11, fontWeight: '700', color: d.track === 'intake' ? color.onAccent : color.accent }}>
                      {d.ids.length}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </GlassSurface>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('day.previous')}
        onPress={onPrevious}
        hitSlop={12}
        style={{
          position: 'absolute',
          left: -6,
          top: C - 22,
          width: 44,
          height: 44,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.5,
        }}
      >
        <Icon name="back" size={22} wash={false} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('day.next')}
        accessibilityState={{ disabled: !canGoNext }}
        onPress={canGoNext ? onNext : undefined}
        hitSlop={12}
        style={{
          position: 'absolute',
          right: -6,
          top: C - 22,
          width: 44,
          height: 44,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: canGoNext ? 0.5 : 0.15,
        }}
      >
        <Icon name="chev" size={22} wash={false} />
      </Pressable>
    </View>
  );
}
