import { DayStartSection } from '@/ui/DayStartSection';
import { LlmSettingsSection } from '@/ui/LlmSettingsSection';
import { ListSection } from '@/ui/ListSection';
import { RemindersSection } from '@/ui/RemindersSection';
import { Screen } from '@/ui/components';

export const LoggingSettings = () => (
  <Screen>
    <DayStartSection />
    <ListSection kind="dailyTags" />
    <ListSection kind="treatments" />
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
