import { Pressable, View } from 'react-native';
import { GlassSurface } from '@/ui/GlassSurface';
import { Icon, type IconName } from '@/ui/Icon';
import { IconCircle } from '@/ui/IconCircle';
import { Text } from '@/ui/themed';
import { color } from '@/ui/theme';

/** UX-12: a single choice from a short list: a glass pill with an icon circle, a title, a detail and a radio mark on the right. */
export function RadioRow({ icon, title, detail, selected, onPress }: { icon: IconName; title: string; detail?: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityLabel={title} accessibilityState={{ checked: selected }} onPress={onPress}>
      <GlassSurface raised style={{ borderRadius: 999, minHeight: 56, paddingVertical: 8, paddingLeft: 8, paddingRight: 16, flexDirection: 'row', alignItems: 'center', gap: 12, ...(selected ? { borderColor: color.accent, backgroundColor: color.accentSoft } : {}) }}>
        <IconCircle name={icon} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15.5, fontWeight: '600' }}>{title}</Text>
          {detail ? <Text style={{ fontSize: 13, color: color.muted }}>{detail}</Text> : null}
        </View>
        {selected ? (
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={15} tint={color.onAccent} stroke={2.8} wash={false} />
          </View>
        ) : (
          <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: color.control }} />
        )}
      </GlassSurface>
    </Pressable>
  );
}
