import { AreasSection } from '@/ui/AreasSection';
import { FavoritesSection } from '@/ui/FavoritesSection';
import { FlareThresholdSection } from '@/ui/FlareThresholdSection';
import { DayStartSection } from '@/ui/DayStartSection';
import { LlmSettingsSection } from '@/ui/LlmSettingsSection';
import { ListSection } from '@/ui/ListSection';
import { RemindersSection } from '@/ui/RemindersSection';
import { Screen } from '@/ui/components';
import { NavGroup } from '@/ui/NavGroup';
import { NavRow } from '@/ui/NavRow';
import { useRouter } from 'expo-router';
import { t } from '@/i18n';

/** UX-6: the Logging group opens suggestions, the skin and nail areas and favorites; the rest of it is on this screen. */
function SubPages() {
  const router = useRouter();
  return (
    <NavGroup>
      <NavRow icon="sparkle" title={t('nav.suggestions')} onPress={() => router.push('/settings/suggestions')} />
      <NavRow icon="skin" title={t('nav.areas')} onPress={() => router.push('/settings/areas')} />
      <NavRow icon="medication" title={t('nav.regular')} onPress={() => router.push('/settings/regular')} />
      <NavRow icon="star" title={t('nav.favorites')} onPress={() => router.push('/settings/favorites')} />
    </NavGroup>
  );
}

/** UX-6: Privacy and photos belongs to the Reminders and privacy group. */
function PrivacyRow() {
  const router = useRouter();
  return (
    <NavGroup>
      <NavRow icon="lock" title={t('nav.privacy')} onPress={() => router.push('/settings/privacy')} />
    </NavGroup>
  );
}

export const LoggingSettings = () => (
  <Screen>
    <SubPages />
    <DayStartSection />
    <FlareThresholdSection />
    <ListSection kind="dailyItems" />
    <ListSection kind="changeCategories" />
    <ListSection kind="treatments" />
  </Screen>
);
export const AreaSettings = () => (
  <Screen>
    <AreasSection kind="skin" />
    <AreasSection kind="nail" />
  </Screen>
);
export const FavoriteSettings = () => (
  <Screen>
    <FavoritesSection />
  </Screen>
);
export const ReminderSettings = () => (
  <Screen>
    <RemindersSection />
    <PrivacyRow />
  </Screen>
);
export const AiSettings = () => (
  <Screen>
    <LlmSettingsSection />
  </Screen>
);
