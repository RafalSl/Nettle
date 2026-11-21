import { Pressable, View } from 'react-native';
import { GlassSurface } from '@/ui/GlassSurface';
import { Switch, Text } from '@/ui/themed';
import { color } from '@/ui/theme';

/** UX-12: the whole glass pill is the control (role switch); an optional hint sits under the title. */
export function SwitchRow({ title, hint, value, onChange }: { title: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityLabel={title} accessibilityState={{ checked: value }} onPress={() => onChange(!value)}>
      <GlassSurface style={{ borderRadius: 999, paddingVertical: 10, paddingLeft: 20, paddingRight: 14, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '600' }}>{title}</Text>
          {hint ? <Text style={{ fontSize: 13, color: color.muted }}>{hint}</Text> : null}
        </View>
        <Switch value={value} onValueChange={onChange} accessibilityElementsHidden />
      </GlassSurface>
    </Pressable>
  );
}
