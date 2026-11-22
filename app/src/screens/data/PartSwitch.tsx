import { SwitchRow } from '@/ui/SwitchRow';

/** One part of an export or import (records, settings, CSV …) as a switch row. */
export function PartSwitch({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return <SwitchRow title={label} value={value} onChange={onChange} />;
}
