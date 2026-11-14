import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { t } from '@/i18n';
import { Button, Heading, Hint, Screen } from '@/ui/components';

/**
 * UX-2: the start screen. This step has the quick actions only; the day switcher, the day's log with edit and
 * delete (EN-1), treatment shortcuts and the context cards follow. Every action opens a modal form (UX-3).
 */
export default function TodayScreen() {
  const router = useRouter();
  return (
    <Screen>
      <Heading>{t('home.quickActions')}</Heading>
      <View style={{ gap: 8 }}>
        <Button title={t('home.meal')} onPress={() => router.push('/form/meal')} />
        <Button title={t('home.skin')} onPress={() => router.push('/form/skin')} />
        <Button title={t('home.treatment')} onPress={() => router.push('/form/treatment')} />
        <Button title={t('home.checkin')} onPress={() => router.push('/form/checkin')} />
        <Button kind="secondary" title={t('home.more')} onPress={() => router.push('/today/more')} />
      </View>
      <Hint>{t('home.flareHint')}</Hint>
    </Screen>
  );
}
