import { ChangeEventSection, ReactionSection } from '@/ui/EventSections';
import { DrinkSection, MedicationSection } from '@/ui/IntakeSection';
import { MedicalEventSection } from '@/ui/MedicalFields';
import { NailSection } from '@/ui/NailSection';
import { TreatmentSection } from '@/ui/TreatmentSection';

/** One entry form per modal route. Each is a `FormModal`: Cancel and Save in the header, Save disabled until complete. */
export const DrinkForm = DrinkSection;
export const MedicationForm = MedicationSection;
export const TreatmentForm = TreatmentSection;
export const NailForm = NailSection;
export const ChangeForm = ChangeEventSection;
export const ReactionForm = ReactionSection;
export const MedicalForm = MedicalEventSection;
