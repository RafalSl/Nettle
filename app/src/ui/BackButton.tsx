import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { t } from '@/i18n';
import { GlassSurface } from '@/ui/GlassSurface';
import { Icon } from '@/ui/Icon';

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
      hitSlop={4}
    >
      <GlassSurface style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="back" size={20} wash={false} stroke={2} />
      </GlassSurface>
    </Pressable>
  );
}
