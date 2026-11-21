// Design spike (UX-12): throwaway screen to check on a phone, in Expo Go, that the Aurora ring stack runs.
// Open it with the deep link nettle:///spike (or exp://<host>/--/spike). Delete it once docs/spikes/design-stack.md is filled in.
import { BlurView } from 'expo-blur';
import { useFonts, Gabarito_400Regular, Gabarito_600SemiBold, Gabarito_800ExtraBold } from '@expo-google-fonts/gabarito';
import { useEffect, useMemo, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedKeyboard,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const RADIUS = 110;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function Glow({ color, size, style, seconds }: { color: string; size: number; style: object; seconds: number }) {
  const drift = useSharedValue(0);
  useEffect(() => {
    drift.value = withRepeat(withSequence(withTiming(1, { duration: seconds * 1000, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: seconds * 1000, easing: Easing.inOut(Easing.sin) })), -1);
  }, [drift, seconds]);
  const move = useAnimatedStyle(() => ({ transform: [{ translateX: drift.value * 40 }, { translateY: drift.value * -30 }] }));
  return <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity: 0.35 }, style, move]} />;
}

function Glass({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <BlurView intensity={22} tint="dark" style={[styles.glass, style]}>
      {children}
    </BlurView>
  );
}

export default function Spike() {
  const [loaded] = useFonts({ Gabarito_400Regular, Gabarito_600SemiBold, Gabarito_800ExtraBold });
  const [dayOffset, setDayOffset] = useState(0);
  const [text, setText] = useState('');
  const arc = useSharedValue(0);
  const keyboard = useAnimatedKeyboard();

  useEffect(() => {
    arc.value = withTiming(0.62, { duration: 1400, easing: Easing.out(Easing.cubic) });
  }, [arc]);
  const arcProps = useAnimatedProps(() => ({ strokeDashoffset: CIRCUMFERENCE * (1 - arc.value) }));
  const saveStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -keyboard.height.value }] }));

  // The swipe is a plain PanResponder: no extra library, and a horizontal move wins over a vertical scroll.
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > 2 * Math.abs(g.dy),
        onPanResponderRelease: (_e, g) => {
          if (g.dx < -50) setDayOffset((d) => d + 1);
          else if (g.dx > 50) setDayOffset((d) => d - 1);
        },
      }),
    [],
  );

  if (!loaded) return <View style={styles.ground} />;
  return (
    <View style={styles.ground}>
      <Glow color="#5EEAD4" size={320} style={{ top: -80, left: -100 }} seconds={18} />
      <Glow color="#6D4AE0" size={300} style={{ top: 200, right: -140 }} seconds={22} />
      <Glow color="#2563EB" size={340} style={{ bottom: -120, left: -60 }} seconds={26} />

      <View style={styles.center} {...pan.panHandlers}>
        <Glass style={styles.ring}>
          <Svg width={256} height={256} viewBox="0 0 256 256">
            <Defs>
              <LinearGradient id="wash" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#5EEAD4" stopOpacity="0" />
                <Stop offset="1" stopColor="#5EEAD4" stopOpacity="0.7" />
              </LinearGradient>
            </Defs>
            <Circle cx={128} cy={128} r={RADIUS} stroke="rgba(255,255,255,0.12)" strokeWidth={10} fill="none" />
            <AnimatedCircle
              cx={128}
              cy={128}
              r={RADIUS}
              stroke="#5EEAD4"
              strokeWidth={10}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={CIRCUMFERENCE}
              animatedProps={arcProps}
              originX={128}
              originY={128}
              rotation={-90}
            />
            <Path d="M96 150 q32 -60 64 0 q-32 30 -64 0 z" stroke="#F2F5F9" strokeWidth={1.6} strokeLinejoin="round" fill="url(#wash)" />
          </Svg>
          <View style={styles.ringText} pointerEvents="none">
            <Text style={styles.weekday}>SATURDAY</Text>
            <Text style={styles.date}>{14 + dayOffset} Nov</Text>
            <Text style={styles.caption}>swipe: day offset {dayOffset}</Text>
          </View>
        </Glass>
      </View>

      <Glass style={styles.field}>
        <TextInput value={text} onChangeText={setText} placeholder="Type to raise the keyboard" placeholderTextColor="#9AA4B2" style={styles.input} />
      </Glass>

      <Animated.View style={[styles.saveWrap, saveStyle]}>
        <Pressable accessibilityRole="button" style={styles.save}>
          <Text style={styles.saveText}>Save</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  ground: { flex: 1, backgroundColor: '#070B12', overflow: 'hidden' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  glass: { overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.07)', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1 },
  ring: { width: 256, height: 256, borderRadius: 128, alignItems: 'center', justifyContent: 'center' },
  ringText: { position: 'absolute', alignItems: 'center' },
  weekday: { fontFamily: 'Gabarito_600SemiBold', fontSize: 12.5, letterSpacing: 1.8, color: '#5EEAD4' },
  date: { fontFamily: 'Gabarito_800ExtraBold', fontSize: 38, letterSpacing: -1.2, color: '#F2F5F9', fontVariant: ['tabular-nums'] },
  caption: { fontFamily: 'Gabarito_400Regular', fontSize: 12.5, color: '#9AA4B2' },
  field: { marginHorizontal: 20, height: 54, borderRadius: 999, justifyContent: 'center', paddingHorizontal: 20, marginBottom: 120 },
  input: { fontFamily: 'Gabarito_400Regular', fontSize: 15, color: '#F2F5F9' },
  saveWrap: { position: 'absolute', left: 20, right: 20, bottom: 26 },
  save: { height: 56, borderRadius: 999, backgroundColor: '#5EEAD4', alignItems: 'center', justifyContent: 'center' },
  saveText: { fontFamily: 'Gabarito_600SemiBold', fontSize: 16, color: '#062A26' },
});
