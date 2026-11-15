import { Pressable, Text, View } from 'react-native';
import { styles } from '@/ui/components';

/** A list row with a trailing chevron: opens a screen (UX-6 settings, the More list). An optional subtitle says what the row is for (UX-11). */
export function NavRow({ title, subtitle, onPress }: { title: string; subtitle?: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [{ paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }, pressed && { opacity: 0.6 }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowText}>{title}</Text>
        {subtitle ? <Text style={styles.hint}>{subtitle}</Text> : null}
      </View>
      <View>
        <Text style={styles.hint}>›</Text>
      </View>
    </Pressable>
  );
}
