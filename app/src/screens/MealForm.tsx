import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { addIngredients, suggestAllergens } from '@/core/model/allergens';
import { NettleError } from '@/core/model/errors';
import { defaultPreferences, type Preferences } from '@/core/model/preferences';
import { mealHistory, rankSuggestions, type Suggestion } from '@/core/model/suggestions';
import { atOnDay, localDay } from '@/core/model/time';
import { afterEdit, sameIngredients, typedSource, type IngredientSource } from '@/core/model/source';
import { ALLERGENS, type Allergen } from '@/core/model/types';
import { lookupProduct } from '@/core/usecases/barcode';
import { logMeal } from '@/core/usecases/logMeal';
import { getPreferences, toggleFavoriteMeal } from '@/core/usecases/preferences';
import { errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { confirmDestructive } from '@/ui/actionSheet';
import { BarcodeScanner } from '@/ui/BarcodeScanner';
import { FormModal } from '@/ui/FormModal';
import { AllergenAiControls, useAllergenAi } from '@/ui/useAllergenAi';
import { IngredientRunPanel, SOURCE_OF, useIngredientRun, type Run } from '@/ui/useIngredientRun';
import { Button, Chips, Hint, Label, TimeField, styles } from '@/ui/components';

/** What a pick fills into the review form: the latest use of the meal, or a favorite's snapshot. */
interface MealDraft {
  description: string;
  ingredients: string[];
  allergens: Allergen[];
  /** IN-2, IN-16: kept from the entry the draft was copied from; a new meal is typed. */
  barcode?: string | null;
  source?: IngredientSource;
  /** The tags the source itself listed, to tell later edits from the source's own tags (defaults to `allergens`). */
  sourceAllergens?: Allergen[];
}

/** IN-16: where the form's lists came from, and the lists as they were filled in. */
interface Origin {
  barcode: string | null;
  source: IngredientSource;
  filled: { ingredients: string[]; allergens: string[] };
}
const typedOrigin = (): Origin => ({ barcode: null, source: typedSource(), filled: { ingredients: [], allergens: [] } });

export { SLOW_ESTIMATE_MS } from '@/ui/useIngredientRun';

const DAY_MS = 86_400_000;

/**
 * IN-1, IN-7, IN-14: the meal form has two phases. Choose: suggestions from the diary's own history (favorites,
 * frequent, recent; typing filters all of it) above a description field. Review: description, ingredients and
 * allergen tags, all editable. A pick fills the review form but never saves; the result is a new, independent
 * entry. Tags that come from the diary's history are pre-selected and visible, so they count as confirmed
 * (IN-10); tags guessed from ingredient text or by the LLM stay unselected until the user selects them.
 */
export default function MealScreen() {
  const { deps } = useServices();
  const { day } = useLocalSearchParams<{ day?: string }>();
  const [phase, setPhase] = useState<'choose' | 'scan' | 'review'>('choose');
  const [code, setCode] = useState('');
  const [looking, setLooking] = useState(false);
  // IN-2, IN-10: what a barcode lookup said, and the allergen tags it only suggests.
  const [fromCode, setFromCode] = useState<{ note: string; tags: Allergen[]; hintKey?: string } | null>(null);
  const [meals, setMeals] = useState<ReturnType<typeof mealHistory>>([]);
  const [prefs, setPrefs] = useState<Preferences>(defaultPreferences());
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState<string[]>(['']);
  const [allergens, setAllergens] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const ingredientRun = useIngredientRun();
  // IN-10: the AI's allergen suggestion lands as a hint with a select button; nothing is selected by itself.
  const allergenAi = useAllergenAi((tags, note) =>
    setFromCode({ note: [tags.length === 0 ? t('meal.aiAllergensNone') : '', note ?? ''].filter(Boolean).join(' '), tags, hintKey: 'meal.aiAllergensHint' }),
  );
  const [at, setAt] = useState<Date | null>(null);
  const [edited, setEdited] = useState(false);
  const [origin, setOrigin] = useState<Origin>(typedOrigin());
  const [dateHint, setDateHint] = useState<string | null>(null);

  const load = useCallback(() => {
    (async () => {
      setMeals(mealHistory(await deps.repo.listMeals()));
      setPrefs(await getPreferences(deps));
    })().catch((e) => Alert.alert(errorMessage(e)));
  }, [deps]);
  useFocusEffect(load);

  const now = deps.clock.now();
  const tz = deps.clock.timeZone();
  // UX-2: a new entry for a past day gets the current clock time on that day.
  const defaultAt = typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) ? atOnDay(day, now, tz, deps.dayStart.get()) : now;

  const suggestions: Suggestion<MealDraft>[] = rankSuggestions(
    meals.map((h) => ({ ...h, payload: { description: h.payload.description, ingredients: h.payload.ingredients, allergens: h.payload.allergens, barcode: h.payload.barcode, source: h.payload.source } })),
    prefs.favorites.meals.map((f) => ({ key: f.key, label: f.description, payload: { description: f.description, ingredients: f.ingredients, allergens: f.allergens, barcode: f.barcode, source: f.source } })),
    now,
    { rows: prefs.suggestions.rows, windowDays: prefs.suggestions.windowDays, query: description },
  );

  const hint = (s: Suggestion<MealDraft>) => {
    const parts: string[] = [];
    if (s.favorite) parts.push(t('meal.hintFavorite'));
    if (s.count >= 2) parts.push(t('meal.hintCount', { n: s.count }));
    if (s.lastAt) {
      const days = Math.round((Date.parse(localDay(now.toISOString(), tz, deps.dayStart.get())) - Date.parse(localDay(s.lastAt, tz, deps.dayStart.get()))) / DAY_MS);
      parts.push(days <= 0 ? t('meal.hintToday') : days === 1 ? t('meal.hintYesterday') : t('meal.hintDays', { n: days }));
    }
    return parts.join(' · ');
  };

  function review(draft: MealDraft) {
    setDescription(draft.description);
    setIngredients(draft.ingredients.length > 0 ? [...draft.ingredients] : ['']);
    setAllergens(new Set(draft.allergens)); // from the diary's history: visible and pre-selected, so confirmed
    setOrigin({
      barcode: draft.barcode ?? null,
      source: draft.source ?? typedSource(),
      filled: { ingredients: [...draft.ingredients], allergens: [...(draft.sourceAllergens ?? draft.allergens)] },
    });
    setDateHint(null);
    setEdited(false);
    setFromCode(null);
    setPhase('review');
  }

  /** IN-2, IN-8, IN-9: look the code up; whatever comes back only fills the review form, and manual entry is always possible. */
  async function handleCode(raw: string) {
    setLooking(true);
    try {
      const found = await lookupProduct(deps, raw);
      const fill = () => {
        const h = found.history;
        if (h) {
          // IN-2: a barcode the diary knows fills the review from its latest use, tags pre-selected (confirmed).
          review({ description: h.name, ingredients: h.ingredients, allergens: h.allergens, barcode: found.barcode, source: h.source });
          setDateHint(t('meal.scanFromHistory', { date: localDay(h.at, deps.clock.timeZone(), deps.dayStart.get()) }));
          return;
        }
        const p = found.product;
        // IN-16: what the database lists is the source; its tags are suggestions and the baseline for later edits.
        review({
          description: p?.name ?? '',
          ingredients: p?.ingredients ?? [],
          allergens: [],
          barcode: found.barcode,
          source: p ? { kind: 'open_food_facts', edited: false, llm: null } : typedSource(),
          sourceAllergens: p?.allergens ?? [],
        });
        setFromCode({ note: !p ? t('meal.scanNotFound') : found.incomplete ? t('meal.scanIncomplete') : t('meal.scanFromDb'), tags: p?.allergens ?? [] });
      };
      if ((found.product || found.history) && found.inStore) {
        // IN-2: an in-store code is ambiguous; the user confirms the match or enters the product by hand.
        Alert.alert(t('meal.scanInStoreTitle'), t('meal.scanInStoreBody'), [
          { text: t('common.cancel'), style: 'cancel', onPress: () => setPhase('choose') },
          { text: t('meal.scanUse'), onPress: fill },
        ]);
      } else fill();
    } catch (e) {
      Alert.alert(errorMessage(e));
      if (e instanceof NettleError && e.code === 'barcode_lookup_failed') {
        review({ description: '', ingredients: [], allergens: [] }); // IN-8: the source is out of reach, so enter it by hand
      }
    } finally {
      setLooking(false);
    }
  }

  /** A new meal: just the typed description; nothing is pre-selected. */
  const newMeal = () => review({ description: description.trim(), ingredients: [], allergens: [] });

  async function changeMeal() {
    if (edited && !(await confirmDestructive({ title: t('meal.discardTitle'), action: t('meal.discard') }))) return;
    setPhase('choose');
    setEdited(false);
  }

  const touch = <T,>(set: (v: T) => void) => (v: T) => {
    setEdited(true);
    set(v);
  };
  const setIngredient = (i: number, v: string) => touch(setIngredients)(ingredients.map((x, j) => (j === i ? v : x)));

  /**
   * IN-3, IN-15: the chosen names become ordinary rows of the list, editable and removable. IN-16: a run on a typed
   * meal becomes its source, with the list as just filled as the baseline for later edits. Allergen tags the label
   * lists stay unselected until the user selects them (IN-10).
   */
  function addRun(names: string[], r: Extract<Run, { status: 'ready' }>) {
    const next = addIngredients(ingredients, names);
    touch(setIngredients)(next);
    const tags = r.label ? [...new Set([...r.label.allergens, ...r.label.traces])] : [];
    if (origin.source.kind === 'typed') {
      setOrigin({
        barcode: origin.barcode,
        source: { kind: SOURCE_OF[r.kind], edited: false, llm: r.provenance },
        filled: { ingredients: next.map((i) => i.trim()).filter(Boolean), allergens: r.label ? tags : [...allergens] },
      });
    }
    if (tags.length > 0) setFromCode({ note: t('meal.labelTagsHint', { list: tags.map((a) => t(`allergens.${a}`)).join(', ') }), tags });
    ingredientRun.dismiss();
  }

  /** What is saved from the lists: cleaned, with the barcode and the source (marked edited when the lists differ from how they were filled). */
  function saveFields() {
    const list = ingredients.map((i) => i.trim()).filter(Boolean);
    const tags = [...allergens] as Allergen[];
    return { ingredients: list, allergens: tags, barcode: origin.barcode, source: afterEdit(origin.source, !sameIngredients(origin.filled, { ingredients: list, allergens: tags })) };
  }

  const key = description.trim().toLowerCase().replace(/\s+/g, ' ');
  const isFavorite = prefs.favorites.meals.some((m) => m.key === key);
  async function star() {
    try {
      await toggleFavoriteMeal(deps, { description: description.trim(), ...saveFields() });
      setPrefs(await getPreferences(deps));
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }

  const missing = phase !== 'review' ? t('meal.reviewFirst') : description.trim() ? null : t('edit.description');
  return (
    <FormModal
      dirty={phase === 'review' ? edited : description.trim().length > 0}
      missing={missing}
      onSave={async () => {
        ingredientRun.cancel(); // Save uses the fields as they are and drops a running call
        await logMeal(deps, { description, ...saveFields(), note, at: at ?? (day ? defaultAt : undefined) });
      }}>
      {phase === 'choose' ? (
        <>
          <Label>{t('meal.chooseTitle')}</Label>
          <TextInput style={styles.input} accessibilityLabel={t('meal.description')} placeholder={t('meal.description')} value={description} onChangeText={setDescription} />
          {suggestions.length > 0 && <Label>{t('meal.suggestions')}</Label>}
          {suggestions.map((s) => (
            <Pressable
              key={s.key}
              accessibilityRole="button"
              accessibilityLabel={s.label}
              onPress={() => review(s.payload)}
              style={({ pressed }) => [{ paddingVertical: 10 }, pressed && { opacity: 0.6 }]}>
              <Text style={styles.rowText}>{s.label}</Text>
              {hint(s) ? <Hint>{hint(s)}</Hint> : null}
            </Pressable>
          ))}
          <Button title={t('meal.continue')} disabled={!description.trim()} onPress={newMeal} />
          <Button kind="secondary" title={t('meal.scan')} onPress={() => setPhase('scan')} />
          <Hint>{t('meal.chooseHint')}</Hint>
        </>
      ) : phase === 'scan' ? (
        <>
          <BarcodeScanner onCode={(c) => void handleCode(c)} />
          <Label>{t('meal.scanOrType')}</Label>
          <TextInput style={styles.input} accessibilityLabel={t('meal.scanCode')} placeholder={t('meal.scanCode')} keyboardType="number-pad" value={code} onChangeText={setCode} />
          <Button title={t('meal.scanLookup')} disabled={!code.trim() || looking} onPress={() => void handleCode(code)} />
          {looking && <Hint>{t('meal.scanLooking')}</Hint>}
          <Button kind="secondary" title={t('meal.scanCancel')} onPress={() => setPhase('choose')} />
        </>
      ) : (
        <>
          <Button kind="secondary" title={t('meal.changeMeal')} onPress={() => void changeMeal()} />
          {dateHint && <Hint>{dateHint}</Hint>}
          {fromCode && <Hint>{fromCode.note}</Hint>}
          <Label>{t('meal.description')}</Label>
          <TextInput style={styles.input} accessibilityLabel={t('meal.description')} value={description} onChangeText={touch(setDescription)} />
          <Button kind="secondary" title={isFavorite ? t('meal.unfavorite') : t('meal.favorite')} onPress={() => void star()} />

          <Button kind="secondary" title={t('meal.fromPhoto')} onPress={() => ingredientRun.start('photo')} />
          <Button kind="secondary" title={t('meal.fromLabel')} onPress={() => ingredientRun.start('label')} />
          <IngredientRunPanel hook={ingredientRun} onAdd={addRun} />
          <Label>{t('meal.ingredients')}</Label>
          {ingredients.map((value, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput style={[styles.input, { flex: 1 }]} placeholder={t('meal.ingredientPlaceholder')} value={value} onChangeText={(v) => setIngredient(i, v)} />
              {ingredients.length > 1 && (
                <Button kind="secondary" title="−" accessibilityLabel={t('meal.removeIngredient')} onPress={() => touch(setIngredients)(ingredients.filter((_, j) => j !== i))} />
              )}
            </View>
          ))}
          <Button kind="secondary" title={t('meal.addIngredient')} onPress={() => setIngredients((l) => [...l, ''])} />

          <Label>{t('meal.allergens')}</Label>
          <Chips
            items={ALLERGENS.map((a) => ({ id: a, label: t(`allergens.${a}`) }))}
            selected={allergens}
            onToggle={(id) => {
              const next = new Set(allergens);
              if (!next.delete(id)) next.add(id);
              touch(setAllergens)(next);
            }}
          />
          {fromCode && fromCode.tags.some((a) => !allergens.has(a)) && (
            <>
              <Hint>{t(fromCode.hintKey ?? 'meal.scanTagsHint', { list: fromCode.tags.map((a) => t(`allergens.${a}`)).join(', ') })}</Hint>
              <Button kind="secondary" title={t('meal.scanSelectTags')} onPress={() => touch(setAllergens)(new Set([...allergens, ...fromCode.tags]))} />
            </>
          )}
          <AllergenAiControls hook={allergenAi} ingredients={ingredients} />
          <Button kind="secondary" title={t('meal.suggestAllergens')} onPress={() => touch(setAllergens)(new Set(suggestAllergens(ingredients)))} />
          <Hint>{t('meal.allergensHint')}</Hint>

          <TimeField value={at ?? defaultAt} onChange={touch(setAt)} />
          <Label>{t('common.note')}</Label>
          <TextInput style={styles.input} accessibilityLabel={t('common.note')} value={note} onChangeText={touch(setNote)} />
        </>
      )}
    </FormModal>
  );
}
