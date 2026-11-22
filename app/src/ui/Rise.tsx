import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';

/** UX-12: on first load a section rises 14 pt and fades in over 0.6 s, with a stagger (`order` times 0.1 s). Nothing else moves. */
export function Rise({ children, order = 0, style }: { children: ReactNode; order?: number; style?: StyleProp<ViewStyle> }) {
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const run = Animated.timing(t, {
      toValue: 1,
      duration: 600,
      delay: order * 100,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    run.start();
    return () => run.stop();
  }, [t, order]);
  return (
    <Animated.View
      style={[style, { opacity: t, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}
    >
      {children}
    </Animated.View>
  );
}
