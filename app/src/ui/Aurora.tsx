import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { color } from '@/ui/theme';

/** One soft glow that drifts slowly (UX-12: 18 to 26 s loops, native driver, so it costs the JS thread nothing). */
function Glow({ tint, size, style, seconds, dx, dy, opacity }: { tint: string; size: number; style: object; seconds: number; dx: number; dy: number; opacity: number }) {
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: seconds * 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: seconds * 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t, seconds]);
  return (
    <Animated.View
      style={[
        { position: 'absolute', width: size, height: size },
        style,
        { transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) }, { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, dy] }) }] },
      ]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={tint} stopOpacity={opacity * 2} />
            <Stop offset="1" stopColor={tint} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#glow)" />
      </Svg>
    </Animated.View>
  );
}

/**
 * UX-12: the ground of every screen: near-black, three soft glows (accent, violet, blue) that drift, and a faint dot
 * grid. It sits behind the content and never takes a touch.
 */
export function Aurora() {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: color.ground, overflow: 'hidden' }]}>
      <Glow tint={color.accent} size={300} style={{ top: -110, left: -110 }} seconds={18} dx={50} dy={40} opacity={0.2} />
      <Glow tint={color.auroraB} size={320} style={{ top: 260, right: -170 }} seconds={22} dx={-60} dy={-30} opacity={0.2} />
      <Glow tint={color.auroraC} size={340} style={{ bottom: -150, left: -80 }} seconds={26} dx={50} dy={-40} opacity={0.18} />
    </View>
  );
}
