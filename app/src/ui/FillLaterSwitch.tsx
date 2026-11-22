import { t } from '@/i18n';
import { SwitchRow } from '@/ui/SwitchRow';

/** IN-20: the "Fill later with AI" switch of a meal or drink. It only marks the entry for the next AI pack (LL-15). */
export function FillLaterSwitch({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return <SwitchRow title={t('fillLater.title')} hint={value ? t('fillLater.hint') : undefined} value={value} onChange={onChange} />;
}
