import { Switch, Text, TextInput, View } from 'react-native';
import { ALLERGENS, type Allergen, type Drink } from '@/core/model/types';
import { t } from '@/i18n';
import { Chips, Label, styles } from '@/ui/components';

/** The editable part of a drink (IN-4, IN-10) as form state: amount as text, ingredients as a comma list. */
export interface DrinkDraft {
  name: string;
  amount: string;
  alcohol: boolean;
  ingredients: string;
  allergens: Set<string>;
}

export const emptyDrinkDraft = (): DrinkDraft => ({ name: '', amount: '', alcohol: false, ingredients: '', allergens: new Set() });

export const draftFromDrink = (d: Pick<Drink, 'name' | 'amountMl' | 'alcohol' | 'ingredients' | 'allergens'>): DrinkDraft => ({
  name: d.name,
  amount: String(d.amountMl),
  alcohol: d.alcohol,
  ingredients: d.ingredients.join(', '),
  allergens: new Set(d.allergens),
});

/** Input for `logDrink` and `editDrink` from the form state. */
export const drinkInput = (d: DrinkDraft) => ({
  name: d.name,
  amountMl: Number(d.amount),
  alcohol: d.alcohol,
  ingredients: d.ingredients.split(','),
  allergens: [...d.allergens] as Allergen[],
});

export const drinkMissing = (d: DrinkDraft): string | null =>
  !d.name.trim() ? t('edit.drink') : !(Number(d.amount) > 0) ? t('edit.amount') : null;

/** IN-4: name, amount, the alcohol switch, optional ingredients and allergen tags. Setters are the form's touching ones. */
export function DrinkFields({ draft, onChange }: { draft: DrinkDraft; onChange: (next: DrinkDraft) => void }) {
  const set = <K extends keyof DrinkDraft>(k: K, v: DrinkDraft[K]) => onChange({ ...draft, [k]: v });
  return (
    <>
      <TextInput style={styles.input} accessibilityLabel={t('more.drinkName')} placeholder={t('more.drinkName')} value={draft.name} onChangeText={(v) => set('name', v)} />
      <TextInput style={styles.input} accessibilityLabel={t('more.drinkAmount')} placeholder={t('more.drinkAmount')} keyboardType="number-pad" value={draft.amount} onChangeText={(v) => set('amount', v)} />
      <View style={styles.timeRow}>
        <Text style={styles.rowText}>{t('more.drinkAlcohol')}</Text>
        <Switch value={draft.alcohol} onValueChange={(v) => set('alcohol', v)} accessibilityLabel={t('more.drinkAlcohol')} />
      </View>
      <TextInput style={styles.input} accessibilityLabel={t('more.drinkIngredients')} placeholder={t('more.drinkIngredients')} value={draft.ingredients} onChangeText={(v) => set('ingredients', v)} />
      <Label>{t('more.drinkAllergens')}</Label>
      <Chips
        items={ALLERGENS.map((a) => ({ id: a, label: t(`allergens.${a}`) }))}
        selected={draft.allergens}
        onToggle={(id) => {
          const next = new Set(draft.allergens);
          if (!next.delete(id)) next.add(id);
          set('allergens', next);
        }}
      />
    </>
  );
}
