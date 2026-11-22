import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { ICON_SHAPES } from '@/ui/iconShapes';
import { color } from '@/ui/theme';

export type IconName = keyof typeof ICON_SHAPES;

const GRADIENTS = {
  wash: { y1: 9, y2: 22, from: 0, to: 0.7 },
  nail: { y1: 2.5, y2: 9.5, from: 0.95, to: 0.45 },
  washMeal: { y1: 9, y2: 17, from: 0, to: 0.75 },
} as const;

/**
 * UX-12: outline icons on a 24 grid, stroke 1.6, round caps, with the accent wash fading in towards the bottom of a
 * closed shape. `tint` is the stroke colour; the wash stays the accent (on the accent, pass `onAccent` and no wash).
 */
export function Icon({
  name,
  size = 24,
  tint = color.text,
  stroke = 1.6,
  wash = true,
}: {
  name: IconName;
  size?: number;
  tint?: string;
  stroke?: number;
  wash?: boolean;
}) {
  const shapes = ICON_SHAPES[name] ?? [];
  const ids = `${name}`;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Defs>
        {(Object.keys(GRADIENTS) as (keyof typeof GRADIENTS)[]).map((g) => (
          <LinearGradient key={g} id={`${g}-${ids}`} gradientUnits="userSpaceOnUse" x1="0" y1={GRADIENTS[g].y1} x2="0" y2={GRADIENTS[g].y2}>
            <Stop offset="0" stopColor={color.accent} stopOpacity={GRADIENTS[g].from} />
            <Stop offset="1" stopColor={color.accent} stopOpacity={GRADIENTS[g].to} />
          </LinearGradient>
        ))}
      </Defs>
      {shapes.map((s, i) => {
        const common = {
          stroke: s.noStroke ? 'none' : tint,
          strokeWidth: stroke,
          strokeLinecap: 'round' as const,
          strokeLinejoin: 'round' as const,
          fill: s.fill && wash ? `url(#${s.fill}-${ids})` : 'none',
        };
        const a = s.a as never;
        if (s.tag === 'path') return <Path key={i} {...(a as object)} {...common} />;
        if (s.tag === 'circle') return <Circle key={i} {...(a as object)} {...common} />;
        return <Rect key={i} {...(a as object)} {...common} />;
      })}
    </Svg>
  );
}
