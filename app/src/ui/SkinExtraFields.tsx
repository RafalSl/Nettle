import { TextInput } from '@/ui/themed';
import { NettleError } from '@/core/model/errors';
import { MAX_SIZE_MM } from '@/core/model/types';
import { t } from '@/i18n';
import { Button, Hint, styles } from '@/ui/components';
import { SwitchRow } from '@/ui/SwitchRow';

/** SK-3: the size text is empty (unset) or a whole number of millimetres from 1 to 500. */
export const parseSizeText = (text: string): { ok: true; value: number | null } | { ok: false } => {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: true, value: null };
  const n = Number(trimmed);
  return /^\d+$/.test(trimmed) && n >= 1 && n <= MAX_SIZE_MM ? { ok: true, value: n } : { ok: false };
};

/** SK-3: the size to save; an invalid text is `invalid_size`, never silently saved as "no size". */
export function sizeToSave(text: string): number | null {
  const parsed = parseSizeText(text);
  if (!parsed.ok) throw new NettleError('invalid_size');
  return parsed.value;
}

/**
 * SK-3: the "Cracks or open wounds" switch and the optional size in mm, shared by the Skin form and the edit form.
 * The switch is always visible; the size sits behind a Details row (the form keeps density low, UX-4), which the
 * caller opens by itself only when the area already has a size.
 */
export function SkinExtraFields({
  cracks,
  onCracks,
  sizeText,
  onSizeText,
  open,
  onToggleOpen,
}: {
  cracks: boolean;
  onCracks: (v: boolean) => void;
  sizeText: string;
  onSizeText: (v: string) => void;
  open: boolean;
  onToggleOpen: () => void;
}) {
  return (
    <>
      <SwitchRow title={t('skin.cracks')} value={cracks} onChange={onCracks} />
      <Button kind="secondary" title={`${t('skin.details')} ${open ? '▾' : '▸'}`} accessibilityLabel={t('skin.details')} onPress={onToggleOpen} />
      {open && (
        <>
          <TextInput
            style={styles.input}
            accessibilityLabel={t('skin.sizeMm')}
            placeholder={t('skin.sizeMm')}
            keyboardType="number-pad"
            value={sizeText}
            onChangeText={onSizeText}
          />
          <Hint>{t('skin.sizeHint')}</Hint>
          {!parseSizeText(sizeText).ok && <Hint>{t('errors.invalid_size')}</Hint>}
        </>
      )}
    </>
  );
}
