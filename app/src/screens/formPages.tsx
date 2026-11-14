import { ChangeEventSection, ReactionSection } from '@/ui/EventSections';
import { AlcoholSection, MedicationSection } from '@/ui/IntakeSection';
import { NailSection } from '@/ui/NailSection';
import { TreatmentSection } from '@/ui/TreatmentSection';

/** One entry form per modal route. Each is a `FormModal`: Cancel and Save in the header, Save disabled until complete. */
export const AlcoholForm = AlcoholSection;
export const MedicationForm = MedicationSection;
export const TreatmentForm = TreatmentSection;
export const NailForm = NailSection;
export const ChangeForm = ChangeEventSection;
export const ReactionForm = ReactionSection;
