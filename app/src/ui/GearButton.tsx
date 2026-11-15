import { useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { t } from '@/i18n';

/** UX-1: the gear in the header of both tabs; it pushes Settings above the tabs. */
export function GearButton() {
  const router = useRouter();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t('nav.gear')} onPress={() => router.push('/settings')} hitSlop={8}>
      <Text style={{ fontSize: 22 }}>⚙︎</Text>
    </Pressable>
  );
}
