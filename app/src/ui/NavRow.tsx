import { Pressable, View } from 'react-native';
import { Icon, type IconName } from '@/ui/Icon';
import { IconCircle } from '@/ui/IconCircle';
import { Text } from '@/ui/themed';
import { color } from '@/ui/theme';

/**
 * A list row: an optional icon circle, a title, an optional subtitle (UX-11) and value, and a chevron when it opens
 * a screen (UX-6 settings, the More list). A destructive row is coral, has no chevron and goes last in its group.
 */
export function NavRow({
  title,
  subtitle,
  value,
  icon,
  danger = false,
  onPress,
}: {
  title: string;
  subtitle?: string;
  value?: string;
  icon?: IconName;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [
        { paddingVertical: 12, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12 },
        pressed && { opacity: 0.6 },
      ]}
    >
      {icon ? <IconCircle name={icon} size={34} alert={danger} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: danger ? color.alert : color.text }}>{title}</Text>
        {subtitle ? <Text style={{ fontSize: 13.5, color: color.muted }}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={{ fontSize: 14, color: color.muted }}>{value}</Text> : null}
      {danger ? null : <Icon name="chev" size={16} tint={color.muted} stroke={2} wash={false} />}
    </Pressable>
  );
}
