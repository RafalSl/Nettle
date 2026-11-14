import { ChangeEventSection, ReactionSection } from '@/ui/EventSections';
import { IntakeSection } from '@/ui/IntakeSection';
import { NailSection } from '@/ui/NailSection';
import { TreatmentSection } from '@/ui/TreatmentSection';
import { Screen } from '@/ui/components';

/** One entry form per modal route; the sections keep their own Save button until the forms are unified. */
export const IntakeForm = () => (
  <Screen>
    <IntakeSection />
  </Screen>
);
export const TreatmentForm = () => (
  <Screen>
    <TreatmentSection />
  </Screen>
);
export const NailForm = () => (
  <Screen>
    <NailSection />
  </Screen>
);
export const ChangeForm = () => (
  <Screen>
    <ChangeEventSection />
  </Screen>
);
export const ReactionForm = () => (
  <Screen>
    <ReactionSection />
  </Screen>
);
