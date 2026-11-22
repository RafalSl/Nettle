import { View } from 'react-native';
import { Button } from '@/ui/components';
import { Text } from '@/ui/themed';
import { color } from '@/ui/theme';

/** UX-1, UX-12: centred empty state: a dashed glass ring, a short title, one sentence and at most one primary button. */
export function EmptyState({ title, body, action, onAction }: { title: string; body: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ alignItems: 'center', gap: 12, paddingVertical: 40, paddingHorizontal: 20 }}>
      <View
        style={{
          width: 120,
          height: 120,
          borderRadius: 60,
          borderWidth: 2,
          borderStyle: 'dashed',
          borderColor: color.control,
          backgroundColor: color.glassFill,
        }}
      />
      <Text style={{ fontSize: 22, fontWeight: '800', letterSpacing: -0.5 }}>{title}</Text>
      <Text style={{ fontSize: 15, color: color.soft, textAlign: 'center' }}>{body}</Text>
      {action && onAction ? <Button title={action} onPress={onAction} /> : null}
    </View>
  );
}
