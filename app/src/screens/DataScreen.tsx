import { ExportSections } from '@/screens/data/ExportSections';
import { ImportSection } from '@/screens/data/ImportSection';
import { DeleteSection } from '@/ui/DeleteSection';
import { Screen } from '@/ui/components';

/** EX-14, EX-1, EX-10, SE-9: Full backup, custom export, import and delete, each its own section. */
export default function DataScreen() {
  return (
    <Screen>
      <ExportSections />
      <ImportSection />
      <DeleteSection />
    </Screen>
  );
}
