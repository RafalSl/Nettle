import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { t } from '@/i18n';
import { GlassSurface } from '@/ui/GlassSurface';
import { Icon } from '@/ui/Icon';

/** UX-1: the gear (sliders) of both tabs, a glass circle at the top right; it pushes Settings above the tabs. */
export function GearButton() {
  const router = useRouter();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t('nav.gear')} onPress={() => router.push('/settings')} hitSlop={4}>
      <GlassSurface style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="sliders" size={21} stroke={1.8} wash={false} />
      </GlassSurface>
    </Pressable>
  );
}
