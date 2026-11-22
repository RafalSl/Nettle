import { TextInput } from '@/ui/themed';
import { joinIngredients, matchIngredientNames, splitIngredients } from '@/core/model/allergens';
import { afterEdit, sameIngredients, typedSource, type IngredientSource } from '@/core/model/source';
import { type Allergen } from '@/core/model/types';
import type { DrinkSnapshot } from '@/core/usecases/preferences';
import { t } from '@/i18n';
import { Chips, Label, styles } from '@/ui/components';
import { FillLaterSwitch } from '@/forms/FillLaterSwitch';
import { SwitchRow } from '@/ui/SwitchRow';
import { AllergenChips } from '@/forms/AllergenChips';

/** The editable part of a drink (IN-4, IN-10) as form state: amount as text, ingredients as a comma list. */
export interface DrinkDraft {
  name: string;
  amount: string;
  alcohol: boolean;
  ingredients: string;
  allergens: Set<string>;
  /** IN-2, IN-16: where the filled-in values came from, and the lists as they were filled (to tell an edit). */
  barcode: string | null;
  source: IngredientSource;
  filled: { ingredients: string[]; allergens: string[] };
  /** IN-20: wait for an AI fill. */
  fillLater: boolean;
}

export const emptyDrinkDraft = (): DrinkDraft => ({
  name: '',
  amount: '',
  alcohol: false,
  ingredients: '',
  allergens: new Set(),
  barcode: null,
  source: typedSource(),
  filled: { ingredients: [], allergens: [] },
  fillLater: false,
});

export const draftFromDrink = (d: DrinkSnapshot & { fillLater?: true }): DrinkDraft => ({
  name: d.name,
  amount: String(d.amountMl),
  alcohol: d.alcohol,
  ingredients: joinIngredients(d.ingredients),
  allergens: new Set(d.allergens),
  barcode: d.barcode,
  source: d.source,
  filled: { ingredients: [...d.ingredients], allergens: [...d.allergens] },
  fillLater: d.fillLater === true,
});

/** Input for `logDrink` and `editDrink` from the form state. */
export const drinkInput = (d: DrinkDraft) => {
  const ingredients = splitIngredients(d.ingredients);
  const allergens = [...d.allergens] as Allergen[];
  return {
    name: d.name,
    amountMl: Number(d.amount),
    alcohol: d.alcohol,
    ingredients,
    allergens,
    barcode: d.barcode,
    source: afterEdit(d.source, !sameIngredients(d.filled, { ingredients, allergens })),
    fillLater: d.fillLater,
  };
};

export const drinkMissing = (d: DrinkDraft): string | null =>
  !d.name.trim() ? t('edit.drink') : !(Number(d.amount) > 0) ? t('edit.amount') : null;

/** IN-4: name, amount, the alcohol switch, optional ingredients and allergen tags. Setters are the form's touching ones. */
export function DrinkFields({
  draft,
  onChange,
  names = [],
}: {
  draft: DrinkDraft;
  onChange: (next: DrinkDraft) => void;
  names?: readonly string[];
}) {
  const set = <K extends keyof DrinkDraft>(k: K, v: DrinkDraft[K]) => onChange({ ...draft, [k]: v });
  return (
    <>
      <TextInput
        style={styles.input}
        accessibilityLabel={t('more.drinkName')}
        placeholder={t('more.drinkName')}
        value={draft.name}
        onChangeText={(v) => set('name', v)}
      />
      <TextInput
        style={styles.input}
        accessibilityLabel={t('more.drinkAmount')}
        placeholder={t('more.drinkAmount')}
        keyboardType="number-pad"
        value={draft.amount}
        onChangeText={(v) => set('amount', v)}
      />
      <SwitchRow title={t('more.drinkAlcohol')} value={draft.alcohol} onChange={(v) => set('alcohol', v)} />
      <TextInput
        style={styles.input}
        accessibilityLabel={t('more.drinkIngredients')}
        placeholder={t('more.drinkIngredients')}
        value={draft.ingredients}
        onChangeText={(v) => set('ingredients', v)}
      />
      {/* IN-1: the word being typed after the last comma matches names from the diary; a tap completes it. */}
      <Chips
        items={matchIngredientNames(names, lastToken(draft.ingredients), splitIngredients(draft.ingredients)).map((n) => ({
          id: n,
          label: n,
        }))}
        selected={new Set()}
        onToggle={(n) =>
          set(
            'ingredients',
            `${draft.ingredients
              .slice(0, draft.ingredients.length - lastToken(draft.ingredients).length)
              .replace(/\s*$/, ' ')
              .trimStart()}${n}, `,
          )
        }
      />
      <Label>{t('more.drinkAllergens')}</Label>
      <AllergenChips selected={draft.allergens} onChange={(next) => set('allergens', next)} />
      <FillLaterSwitch value={draft.fillLater} onChange={(v) => set('fillLater', v)} />
    </>
  );
}

/** The text after the last top-level comma: the ingredient being typed. */
export function lastToken(text: string): string {
  const parts = text.split(',');
  return (parts[parts.length - 1] ?? '').trimStart();
}
