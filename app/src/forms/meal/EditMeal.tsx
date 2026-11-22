import { addIngredients, joinIngredients, splitIngredients } from '@/core/model/allergens';
import type { Allergen } from '@/core/model/types';
import { completeSuggestion } from '@/core/usecases/aiPack';
import { editMeal } from '@/core/usecases/entries';
import { t } from '@/i18n';
import { AllergenChips } from '@/forms/AllergenChips';
import { sameList, useSuggestionState, EditCommonFields, useEditCommon } from '@/forms/editCommon';
import { FillLaterSwitch } from '@/forms/FillLaterSwitch';
import { SuggestionPanel } from '@/forms/SuggestionPanel';
import { Hint, Label, styles } from '@/ui/components';
import { TextInput } from '@/ui/themed';
import { useServices } from '@/services';
import { FormModal, useField, useForm } from '@/ui/FormModal';
import type { EditProps } from '@/forms/editProps';

/** EN-1, IN-20: edit a meal; opened from "Suggestions to review", the suggestion panel helps fill it. */
export function EditMeal({ r, suggestionId }: EditProps<'meals'> & { suggestionId: string | null }) {
  const { deps } = useServices();
  const f = useForm();
  const c = useEditCommon(r.note, f.touch);
  const [description, setDescription] = useField(r.description, f.touch);
  const [ingredients, setIngredients] = useField(joinIngredients(r.ingredients), f.touch);
  const [allergens, setAllergens] = useField<Set<Allergen>>(new Set(r.allergens), f.touch);
  const [fillLater, setFillLater] = useField(r.fillLater === true, f.touch);
  const sug = useSuggestionState(suggestionId);
  return (
    <FormModal
      dirty={f.dirty}
      missing={description.trim() ? null : t('edit.description')}
      onSave={async () => {
        await editMeal(deps, r.id, {
          description,
          ingredients: splitIngredients(ingredients),
          allergens: [...allergens],
          fillLater,
          note: c.note,
          at: c.atForSave,
        });
        // IN-20: names were added from a suggestion: the mark clears and the source reads name estimate (manual).
        if (suggestionId && sug.baseline) {
          await completeSuggestion(deps, suggestionId, {
            edited: !sameList(sug.baseline, splitIngredients(ingredients)),
            aiTags: sug.aiTags,
          });
        }
      }}
    >
      <Label>{t('meal.description')}</Label>
      <TextInput style={styles.input} accessibilityLabel={t('meal.description')} value={description} onChangeText={setDescription} />
      {suggestionId && sug.open && (
        <SuggestionPanel
          suggestionId={suggestionId}
          onAdd={(names) => {
            const next = addIngredients(splitIngredients(ingredients), names);
            setIngredients(joinIngredients(next));
            sug.setBaseline(next);
          }}
          onSelectTags={(tags) => {
            setAllergens(new Set([...allergens, ...tags]));
            sug.setAiTags(true);
          }}
          onDismissed={() => sug.setOpen(false)}
        />
      )}
      <Label>{t('meal.ingredients')}</Label>
      <TextInput style={styles.input} accessibilityLabel={t('meal.ingredients')} value={ingredients} onChangeText={setIngredients} />
      <Hint>{t('edit.ingredientsHint')}</Hint>
      <Label>{t('meal.allergens')}</Label>
      <AllergenChips selected={allergens} onChange={setAllergens} />
      <FillLaterSwitch value={fillLater} onChange={setFillLater} />
      <EditCommonFields c={c} original={r.at.utc} />
    </FormModal>
  );
}
