import { IntakeSection } from '@/ui/IntakeSection';
import { ChangeEventSection, ReactionSection } from '@/ui/EventSections';
import { ListSection } from '@/ui/ListSection';
import { RemindersSection } from '@/ui/RemindersSection';
import { NailSection } from '@/ui/NailSection';
import { TreatmentSection } from '@/ui/TreatmentSection';
import { Screen } from '@/ui/components';

/** Everything that is not a meal, a skin entry or the daily check-in. */
export default function MoreScreen() {
  return (
    <Screen>
      <IntakeSection />
      <NailSection />
      <TreatmentSection />
      <ChangeEventSection />
      <ReactionSection />
      <ListSection kind="dailyTags" />
      <ListSection kind="treatments" />
      <RemindersSection />
    </Screen>
  );
}
