import { IntakeSection } from '@/ui/IntakeSection';
import { NailSection } from '@/ui/NailSection';
import { TreatmentSection } from '@/ui/TreatmentSection';
import { Screen } from '@/ui/components';

/** SK-10 nails and IN-11 treatments. Change events and reactions have no screen yet. */
export default function MoreScreen() {
  return (
    <Screen>
      <IntakeSection />
      <NailSection />
      <TreatmentSection />
    </Screen>
  );
}
