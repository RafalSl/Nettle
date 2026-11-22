import { addIngredients, joinIngredients, splitIngredients } from '@/core/model/allergens';
import { completeSuggestion } from '@/core/usecases/aiPack';
import { editDrink } from '@/core/usecases/entries';
import { DrinkFields, draftFromDrink, drinkInput, drinkMissing, type DrinkDraft } from '@/forms/drink/DrinkFields';
import { sameList, useSuggestionState, EditCommonFields, useEditCommon } from '@/forms/editCommon';
import { SuggestionPanel } from '@/forms/SuggestionPanel';
import { useServices } from '@/services';
import { FormModal, useField, useForm } from '@/ui/FormModal';
import type { EditProps } from '@/forms/editProps';

/** EN-1, IN-20: edit a drink; opened from "Suggestions to review", the suggestion panel helps fill it. */
export function EditDrink({ r, suggestionId }: EditProps<'drinks'> & { suggestionId: string | null }) {
  const { deps } = useServices();
  const f = useForm();
  const c = useEditCommon(r.note, f.touch);
  const [draft, setDraft] = useField<DrinkDraft>(draftFromDrink(r), f.touch);
  const sug = useSuggestionState(suggestionId);
  return (
    <FormModal
      dirty={f.dirty}
      missing={drinkMissing(draft)}
      onSave={async () => {
        await editDrink(deps, r.id, { ...drinkInput(draft), note: c.note, at: c.atForSave });
        if (suggestionId && sug.baseline) {
          await completeSuggestion(deps, suggestionId, {
            edited: !sameList(sug.baseline, splitIngredients(draft.ingredients)),
            aiTags: sug.aiTags,
          });
        }
      }}
    >
      {suggestionId && sug.open && (
        <SuggestionPanel
          suggestionId={suggestionId}
          onAdd={(names) => {
            const next = addIngredients(splitIngredients(draft.ingredients), names);
            setDraft({ ...draft, ingredients: joinIngredients(next) });
            sug.setBaseline(next);
          }}
          onSelectTags={(tags) => {
            setDraft({ ...draft, allergens: new Set([...draft.allergens, ...tags]) });
            sug.setAiTags(true);
          }}
          onDismissed={() => sug.setOpen(false)}
        />
      )}
      <DrinkFields draft={draft} onChange={setDraft} />
      <EditCommonFields c={c} original={r.at.utc} />
    </FormModal>
  );
}
