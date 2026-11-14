import { Pressable, Text, View } from 'react-native';
import { styles } from '@/ui/components';

/** A list row with a trailing chevron: opens a screen (UX-6 settings, the More list). */
export function NavRow({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [{ paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }, pressed && { opacity: 0.6 }]}>
      <Text style={[styles.rowText, { flex: 1 }]}>{title}</Text>
      <View>
        <Text style={styles.hint}>›</Text>
      </View>
    </Pressable>
  );
}
