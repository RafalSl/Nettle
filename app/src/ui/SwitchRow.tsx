import { Pressable, View } from 'react-native';
import { GlassSurface } from '@/ui/GlassSurface';
import { Switch, Text } from '@/ui/themed';
import { color } from '@/ui/theme';

/** UX-12: the whole glass pill is the control (role switch); an optional hint sits under the title. */
export function SwitchRow({
  title,
  hint,
  value,
  onChange,
  disabled = false,
}: {
  title: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={title}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
    >
      <GlassSurface
        style={{
          borderRadius: 999,
          paddingVertical: 10,
          paddingLeft: 20,
          paddingRight: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          minHeight: 56,
          opacity: disabled ? 0.45 : 1,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '600' }}>{title}</Text>
          {hint ? <Text style={{ fontSize: 13, color: color.muted }}>{hint}</Text> : null}
        </View>
        <Switch value={value} onValueChange={onChange} disabled={disabled} accessibilityLabel={title} accessibilityElementsHidden />
      </GlassSurface>
    </Pressable>
  );
}
