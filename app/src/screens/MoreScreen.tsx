import { useRouter } from 'expo-router';
import { t } from '@/i18n';
import { NavRow } from '@/ui/NavRow';
import { Screen } from '@/ui/components';

/** UX-2: a pushed list of the rarer entries; each opens its modal form. */
export default function MoreScreen() {
  const router = useRouter();
  return (
    <Screen>
      <NavRow title={t('home.moreDrink')} onPress={() => router.push('/form/drink')} />
      <NavRow title={t('home.moreMedication')} onPress={() => router.push('/form/medication')} />
      <NavRow title={t('home.moreReaction')} onPress={() => router.push('/form/reaction')} />
      <NavRow title={t('home.moreNails')} onPress={() => router.push('/form/nails')} />
      <NavRow title={t('home.moreChange')} onPress={() => router.push('/form/change')} />
    </Screen>
  );
}
