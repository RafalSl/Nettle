import { useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { t } from '@/i18n';

/**
 * UX-1: the Back button of the first Settings screen. Settings is a nested stack inside the root stack, so its first
 * screen has nothing to go back to inside its own stack and the navigator draws no Back. This one pops the root stack.
 * A reminder tap can open `/settings/data` as the first screen with no history: Back then goes to Today, not nowhere.
 */
export function BackButton() {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('common.back')}
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
      hitSlop={8}
    >
      <Text style={{ color: '#208AEF', fontSize: 17 }}>‹ {t('common.back')}</Text>
    </Pressable>
  );
}
