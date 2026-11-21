import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { color } from '@/ui/theme';

/** Set to false to fall back to a flat translucent fill if blur stutters over the aurora (docs/spikes/design-stack.md). */
export const USE_BLUR = true;

/**
 * UX-12: the base of every floating control: a translucent fill, a 1 pt line and a background blur.
 * `raised` is the stronger look of fields and quick-action circles; `blur` is 18 for pills, 22 for the ring and
 * fields, 30 for sheets.
 */
export function GlassSurface({
  children,
  style,
  raised = false,
  blur = 18,
  sheet = false,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  raised?: boolean;
  blur?: number;
  sheet?: boolean;
}) {
  const fill = sheet ? color.sheetFill : raised ? color.glassFillRaised : color.glassFill;
  const line = raised ? color.glassLineRaised : color.glassLine;
  const frame = { backgroundColor: fill, borderColor: line, borderWidth: StyleSheet.hairlineWidth * 2, overflow: 'hidden' as const };
  if (!USE_BLUR) return <View style={[frame, style]}>{children}</View>;
  return (
    <BlurView intensity={blur * 2} tint="dark" style={[frame, style]}>
      {children}
    </BlurView>
  );
}
