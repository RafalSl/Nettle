import { View } from 'react-native';
import { Icon, type IconName } from '@/ui/Icon';
import { color } from '@/ui/theme';

/** UX-12: an icon in a glass circle (34 in settings rows, 40 in log rows, 44 in sheets, 56 to 64 quick actions). `alert` tints it coral. */
export function IconCircle({ name, size = 40, alert = false }: { name: IconName; size?: number; alert?: boolean }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: alert ? color.alertSoft : color.glassFillRaised,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={name} size={Math.round(size * 0.55)} tint={alert ? color.alert : color.text} />
    </View>
  );
}
