import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, Modal, Pressable, View } from 'react-native';
import { t } from '@/i18n';
import { GlassSurface } from '@/ui/GlassSurface';
import { Icon } from '@/ui/Icon';
import { Text } from '@/ui/themed';
import { color } from '@/ui/theme';

/**
 * UX-3, UX-12: a quick sheet. It floats 10 pt in from the sides and 26 pt above the bottom edge over a dimmed
 * screen, slides up 60 pt and fades in over 0.5 s, and closes on a tap outside or on the close circle.
 */
export function Sheet({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const [t0] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const run = Animated.timing(t0, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, [t0]);
  return (
    <Modal transparent animationType="none" visible onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: color.scrim }}>
        <Pressable accessibilityLabel={t('common.close')} accessibilityRole="button" onPress={onClose} style={{ flex: 1 }} />
        <Animated.View
          style={{
            marginHorizontal: 10,
            marginBottom: 26,
            opacity: t0,
            transform: [{ translateY: t0.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }],
          }}
        >
          <GlassSurface sheet blur={30} style={{ borderRadius: 36, padding: 18, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '700' }}>{title}</Text>
                {subtitle ? <Text style={{ fontSize: 13, color: color.muted }}>{subtitle}</Text> : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
                onPress={onClose}
                hitSlop={6}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: color.glassFillRaised,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="x" size={18} wash={false} stroke={2} />
              </Pressable>
            </View>
            {children}
          </GlassSurface>
        </Animated.View>
      </View>
    </Modal>
  );
}

/** A one-tap row of a quick sheet: an icon circle and a title in a glass pill. A locked row is dimmed and ignores taps. */
export function SheetRow({
  icon,
  title,
  detail,
  locked = false,
  onPress,
  outline = false,
}: {
  icon?: Parameters<typeof Icon>[0]['name'];
  title: string;
  detail?: string;
  locked?: boolean;
  onPress: () => void;
  outline?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: locked }}
      onPress={locked ? undefined : onPress}
    >
      <GlassSurface
        raised
        style={{
          borderRadius: 999,
          minHeight: 52,
          paddingVertical: 8,
          paddingHorizontal: 18,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          opacity: locked ? 0.4 : 1,
          ...(outline ? { borderColor: color.accentLine, borderWidth: 1.5 } : {}),
        }}
      >
        {icon ? <Icon name={icon} size={22} /> : null}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15.5, fontWeight: '600', color: outline ? color.accent : color.text }}>{title}</Text>
          {detail ? <Text style={{ fontSize: 13, color: color.muted }}>{detail}</Text> : null}
        </View>
      </GlassSurface>
    </Pressable>
  );
}

/** A small caption above a group of rows in a sheet ("Regular", "Often used"). */
export const SheetLabel = ({ children }: { children: ReactNode }) => (
  <Text style={{ fontSize: 13, fontWeight: '600', letterSpacing: 1.4, color: color.muted, textTransform: 'uppercase', marginTop: 4 }}>
    {children}
  </Text>
);
