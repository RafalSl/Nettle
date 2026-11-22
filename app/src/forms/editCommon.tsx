import { useState } from 'react';
import { t } from '@/i18n';
import { useField } from '@/ui/FormModal';
import { Label, TimeField, styles } from '@/ui/components';
import { TextInput } from '@/ui/themed';

/** EN-1: time and note, the two fields every entry has. `at` stays null until the user changes the time, which keeps the original stamp. */
export function useEditCommon(initialNote: string | null, touch: () => void) {
  const [at, setAt] = useField<Date | null>(null, touch);
  const [note, setNote] = useField(initialNote ?? '', touch);
  return { at, setAt, note, setNote, atForSave: at ?? undefined };
}

export function EditCommonFields({ c, original }: { c: ReturnType<typeof useEditCommon>; original: string }) {
  return (
    <>
      <TimeField value={c.at ?? new Date(original)} onChange={c.setAt} />
      <Label>{t('common.note')}</Label>
      <TextInput style={styles.input} accessibilityLabel={t('common.note')} value={c.note} onChangeText={c.setNote} />
    </>
  );
}

/** Two ingredient lists are the same, ignoring the empty slot `addIngredients` leaves at the end for the next name. */
export const sameList = (a: readonly string[], b: readonly string[]) => {
  const x = a.filter(Boolean);
  const y = b.filter(Boolean);
  return x.length === y.length && x.every((v, i) => v === y[i]);
};

/**
 * IN-20: the state of one suggestion that is being applied in an edit form. Adding names makes them ordinary rows;
 * the list as just filled is kept, so a later change marks the entry edited (IN-16). Nothing is stored until Save.
 */
export function useSuggestionState(suggestionId: string | null) {
  const [open, setOpen] = useState(suggestionId !== null);
  const [baseline, setBaseline] = useState<string[] | null>(null);
  const [aiTags, setAiTags] = useState(false);
  return { open, setOpen, baseline, setBaseline, aiTags, setAiTags };
}
