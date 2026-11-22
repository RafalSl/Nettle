import { useEffect, useState } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { color } from '@/ui/theme';

/** UX-12: the wait arc: a quarter of a ring that turns only while an LLM call runs (the one proposed motion). */
export function WaitArc({ size = 44 }: { size?: number }) {
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [t]);
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  return (
    <Animated.View
      style={{ width: size, height: size, transform: [{ rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}
    >
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color.glassLineRaised} strokeWidth={3} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color.accent}
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${c * 0.25} ${c}`}
        />
      </Svg>
    </Animated.View>
  );
}
