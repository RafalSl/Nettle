import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, Text, TextInput } from 'react-native';
import { defaultPreferences, type Preferences } from '@/core/model/preferences';
import { drinkHistory, medicationHistory, rankSuggestions, type Suggestion } from '@/core/model/suggestions';
import { MEDICATION_CATEGORIES, type Drink, type MedicationCategory } from '@/core/model/types';
import { logDrink, logMedication } from '@/core/usecases/intake';
import { getPreferences } from '@/core/usecases/preferences';
import { errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { FormModal, useField, useForm } from '@/ui/FormModal';
import { DrinkFields, draftFromDrink, drinkInput, drinkMissing, emptyDrinkDraft, type DrinkDraft } from '@/ui/DrinkFields';
import { useFormTime } from '@/ui/useFormTime';
import { Chips, Label, TimeField, styles } from '@/ui/components';

const rowText = (s: Suggestion<unknown>) => `${s.favorite ? '★ ' : ''}${s.label}${s.count >= 2 ? ` ×${s.count}` : ''}`;

/** IN-14, UX-5: suggestions of an intake form. A tap fills the form, or with "save on tap" saves at once and closes. */
function useSuggestions<P>(load: (deps: ReturnType<typeof useServices>['deps'], p: Preferences) => Promise<Suggestion<P>[]>) {
  const { deps } = useServices();
  const [prefs, setPrefs] = useState<Preferences>(defaultPreferences());
  const [list, setList] = useState<Suggestion<P>[]>([]);
  const refresh = useCallback(() => {
    (async () => {
      const p = await getPreferences(deps);
      setPrefs(p);
      setList(await load(deps, p));
    })().catch((e) => Alert.alert(errorMessage(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps]);
  useFocusEffect(refresh);
  return { list, saveOnTap: prefs.suggestions.saveOnTap };
}

/** IN-4, IN-10: a drink with an alcohol switch and optional ingredients and allergen tags. */
export function DrinkSection() {
  const { deps } = useServices();
  const router = useRouter();
  const f = useForm();
  const [draft, setDraft] = useField<DrinkDraft>(emptyDrinkDraft(), f.touch);
  const time = useFormTime(f.touch);
  const { list, saveOnTap } = useSuggestions<DrinkSnapshot>(async (d, p) => {
    const options = { rows: p.suggestions.rows, windowDays: p.suggestions.windowDays };
    const snap = (x: DrinkSnapshot): DrinkSnapshot => ({ name: x.name, amountMl: x.amountMl, alcohol: x.alcohol, ingredients: x.ingredients, allergens: x.allergens });
    return rankSuggestions(
      drinkHistory(await d.repo.listRecords('drinks')).map((h) => ({ ...h, payload: snap(h.payload) })),
      p.favorites.drinks.map((x) => ({ key: x.key, label: `${x.name} ${x.amountMl} ml`, payload: snap(x) })),
      d.clock.now(),
      options,
    );
  });

  // IN-10: a pick comes from the diary's own history, so its tags are shown pre-selected and count as confirmed.
  async function pick(s: DrinkSnapshot) {
    if (!saveOnTap) {
      setDraft(draftFromDrink(s));
      return;
    }
    try {
      await logDrink(deps, { ...s, at: time.atForSave });
      router.back();
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }

  return (
    <FormModal dirty={f.dirty} missing={drinkMissing(draft)} onSave={async () => void (await logDrink(deps, { ...drinkInput(draft), at: time.atForSave }))}>
      {list.length > 0 && <Label>{t('meal.suggestions')}</Label>}
      {list.map((s) => (
        <Pressable key={s.key} accessibilityRole="button" accessibilityLabel={s.label} onPress={() => void pick(s.payload)} style={{ paddingVertical: 8 }}>
          <Text style={styles.rowText}>{rowText(s)}</Text>
        </Pressable>
      ))}
      <DrinkFields draft={draft} onChange={setDraft} />
      <TimeField value={time.value} onChange={time.set} />
    </FormModal>
  );
}

type DrinkSnapshot = Pick<Drink, 'name' | 'amountMl' | 'alcohol' | 'ingredients' | 'allergens'>;

/** IN-5: a medication or supplement with an optional dose. */
export function MedicationSection() {
  const { deps } = useServices();
  const router = useRouter();
  const f = useForm();
  const [category, setCategory] = useField<MedicationCategory>('medication', f.touch);
  const [name, setName] = useField('', f.touch);
  const [dose, setDose] = useField('', f.touch);
  const time = useFormTime(f.touch);
  type Med = { category: MedicationCategory; name: string; dose: string | null };
  const { list, saveOnTap } = useSuggestions<Med>(async (d, p) => {
    const options = { rows: p.suggestions.rows, windowDays: p.suggestions.windowDays };
    return rankSuggestions(
      medicationHistory(await d.repo.listRecords('medicationEntries')).map((h) => ({ ...h, payload: { category: h.payload.category, name: h.payload.name, dose: h.payload.dose } })),
      p.favorites.medications.map((x) => ({ key: x.key, label: x.dose ? `${x.name} ${x.dose}` : x.name, payload: { category: x.category, name: x.name, dose: x.dose } })),
      d.clock.now(),
      options,
    );
  });

  async function pick(s: Med) {
    if (!saveOnTap) {
      setCategory(s.category);
      setName(s.name);
      setDose(s.dose ?? '');
      return;
    }
    try {
      await logMedication(deps, { category: s.category, name: s.name, dose: s.dose ?? undefined, at: time.atForSave });
      router.back();
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }

  return (
    <FormModal
      dirty={f.dirty}
      missing={name.trim() ? null : t('edit.name')}
      onSave={async () => void (await logMedication(deps, { category, name, dose, at: time.atForSave }))}>
      {list.length > 0 && <Label>{t('meal.suggestions')}</Label>}
      {list.map((s) => (
        <Pressable key={s.key} accessibilityRole="button" accessibilityLabel={s.label} onPress={() => void pick(s.payload)} style={{ paddingVertical: 8 }}>
          <Text style={styles.rowText}>{rowText(s)}</Text>
        </Pressable>
      ))}
      <Chips
        items={MEDICATION_CATEGORIES.map((k) => ({ id: k, label: t(k === 'medication' ? 'more.medKindMedication' : 'more.medKindSupplement') }))}
        selected={new Set([category])}
        onToggle={(id) => setCategory(id as MedicationCategory)}
      />
      <TextInput style={styles.input} accessibilityLabel={t('more.medName')} placeholder={t('more.medName')} value={name} onChangeText={setName} />
      <TextInput style={styles.input} accessibilityLabel={t('more.medDose')} placeholder={t('more.medDose')} value={dose} onChangeText={setDose} />
      <TimeField value={time.value} onChange={time.set} />
    </FormModal>
  );
}
