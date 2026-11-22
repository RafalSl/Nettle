import { useMemo, useState } from 'react';
import { Animated, PanResponder, Pressable, View } from 'react-native';
import { t } from '@/i18n';
import type { IconName } from '@/ui/Icon';
import { IconCircle } from '@/ui/IconCircle';
import { GlassSurface } from '@/ui/GlassSurface';
import { Text } from '@/ui/themed';
import { color } from '@/ui/theme';

const REVEAL = 110; // how far a swipe pulls the row
const TRIGGER = 80; // past this a release asks to delete

/**
 * UX-2, UX-12: one row of the day's log: a glass pill with an icon circle, the title, an optional detail and the
 * time. The newest entry carries an accent line and glow for a moment (UX-5). Swiping the row left asks to delete
 * it (the same confirmation as the tap path, UX-9); tapping the row is the alternative.
 */
export function LogRowView({
  icon,
  title,
  detail,
  time,
  highlighted = false,
  onPress,
  onDelete,
  label,
  hint,
}: {
  icon: IconName;
  title: string;
  detail?: string | null;
  time: string;
  highlighted?: boolean;
  onPress: () => void;
  onDelete?: () => void;
  label: string;
  hint?: string;
}) {
  const [x] = useState(() => new Animated.Value(0));
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => !!onDelete && g.dx < -14 && Math.abs(g.dx) > 2 * Math.abs(g.dy),
        onPanResponderMove: (_e, g) => x.setValue(Math.max(-REVEAL, Math.min(0, g.dx))),
        onPanResponderRelease: (_e, g) => {
          Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
          if (g.dx < -TRIGGER) onDelete?.();
        },
        onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start(),
      }),
    [x, onDelete],
  );
  return (
    <View>
      {onDelete ? (
        <View
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: REVEAL,
            borderRadius: 999,
            backgroundColor: color.alertSoft,
            alignItems: 'flex-end',
            justifyContent: 'center',
            paddingRight: 22,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '700', color: color.alert }}>{t('day.delete')}</Text>
        </View>
      ) : null}
      <Animated.View {...pan.panHandlers} style={{ transform: [{ translateX: x }] }}>
        <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint} onPress={onPress}>
          <GlassSurface
            style={{
              borderRadius: 999,
              paddingVertical: 8,
              paddingLeft: 8,
              paddingRight: 18,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              minHeight: 56,
              ...(highlighted ? { borderColor: color.accent, backgroundColor: color.accentSoft } : {}),
            }}
          >
            <IconCircle name={icon} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15.5, fontWeight: '600' }} numberOfLines={1}>
                {title}
              </Text>
              {detail ? (
                <Text style={{ fontSize: 13, color: color.muted }} numberOfLines={1}>
                  {detail}
                </Text>
              ) : null}
            </View>
            <Text style={{ fontSize: 13.5, color: color.muted }}>{time}</Text>
          </GlassSurface>
        </Pressable>
      </Animated.View>
    </View>
  );
}
