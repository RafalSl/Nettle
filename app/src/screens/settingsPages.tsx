import { AreasSection } from '@/ui/AreasSection';
import { CheckInScoresSection } from '@/ui/CheckInScoresSection';
import { FavoritesSection } from '@/ui/FavoritesSection';
import { DayStartSection } from '@/ui/DayStartSection';
import { LlmSettingsSection } from '@/ui/LlmSettingsSection';
import { ListSection } from '@/ui/ListSection';
import { RemindersSection } from '@/ui/RemindersSection';
import { Screen } from '@/ui/components';

export const LoggingSettings = () => (
  <Screen>
    <DayStartSection />
    <CheckInScoresSection />
    <ListSection kind="dailyTags" />
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
  </Screen>
);
export const AiSettings = () => (
  <Screen>
    <LlmSettingsSection />
  </Screen>
);
