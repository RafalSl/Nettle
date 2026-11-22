import { createContext, useContext } from 'react';
import { Pressable, View } from 'react-native';
import { GlassSurface } from '@/ui/GlassSurface';
import { Icon, type IconName } from '@/ui/Icon';
import { Text } from '@/ui/themed';
import { color } from '@/ui/theme';

/** Extra space a screen leaves at its end so the last rows scroll clear of the floating tab bar. */
export const BottomInset = createContext(24);
export const TAB_BAR_INSET = 112;
export const useBottomInset = () => useContext(BottomInset);

const ICONS: Record<string, IconName> = { today: 'clock', review: 'chart' };

interface TabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  descriptors: Record<string, { options: { title?: string; tabBarAccessibilityLabel?: string } }>;
  emitter: { emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean } };
  navigateToTab: (routeKey: string) => void;
}

/**
 * UX-12: the tab bar floats: a dark glass pill 26 pt above the bottom edge. The active tab is an accent pill with its
 * icon and label; the other shows the icon and label in soft grey. Two tabs, never hidden or disabled (UX-1).
 */
export function FloatingTabBar({ state, descriptors, emitter, navigateToTab }: TabBarProps) {
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 26, alignItems: 'center' }}>
      <GlassSurface blur={18} sheet style={{ borderRadius: 999, padding: 5, flexDirection: 'row', gap: 4 }}>
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const label = descriptors[route.key]?.options.title ?? route.name;
          const tint = focused ? color.onAccent : color.soft;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: focused }}
              onPress={() => {
                const e = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !e.defaultPrevented) navigateToTab(route.key);
              }}
              style={{
                height: 52,
                paddingHorizontal: 22,
                borderRadius: 999,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: focused ? color.accent : 'transparent',
              }}
            >
              <Icon name={ICONS[route.name] ?? 'list'} size={22} tint={tint} stroke={focused ? 2 : 1.9} wash={false} />
              <Text style={{ fontSize: 15.5, fontWeight: focused ? '700' : '600', color: tint }}>{label}</Text>
            </Pressable>
          );
        })}
      </GlassSurface>
    </View>
  );
}
