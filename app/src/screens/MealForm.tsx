import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, Pressable, type ScrollViewInstance, useWindowDimensions, View } from 'react-native';
import { Text, TextInput } from '@/ui/themed';
import { addIngredients, matchIngredientNames, suggestAllergens } from '@/core/model/allergens';
import { NettleError } from '@/core/model/errors';
import { defaultPreferences, type Preferences } from '@/core/model/preferences';
import { mealHistory, rankSuggestions, type Suggestion } from '@/core/model/suggestions';
import { atOnDay, localDay } from '@/core/model/time';
import { afterEdit, sameIngredients, typedSource, type IngredientSource } from '@/core/model/source';
import { ALLERGENS, type Allergen } from '@/core/model/types';
import { lookupProduct } from '@/core/usecases/barcode';
import { ingredientNameHistory } from '@/core/usecases/llm';
import { logMeal } from '@/core/usecases/logMeal';
import { getPreferences, toggleFavoriteMeal } from '@/core/usecases/preferences';
import { errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { confirmDestructive } from '@/ui/actionSheet';
import { BarcodeScanner } from '@/ui/BarcodeScanner';
import { FormModal } from '@/ui/FormModal';
import { AllergenAiControls, useAllergenAi } from '@/ui/useAllergenAi';
import { FillLaterSwitch } from '@/ui/FillLaterSwitch';
import { IngredientRunPanel, SOURCE_OF, useIngredientRun, type Run } from '@/ui/useIngredientRun';
import { Button, Chips, Hint, Label, TimeField, styles } from '@/ui/components';
import { GlassSurface } from '@/ui/GlassSurface';
import { Icon } from '@/ui/Icon';
import { Sheet, SheetRow } from '@/ui/Sheet';
import { color } from '@/ui/theme';

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
  /** IN-8: a code the database does not know: the scan screen offers the label or manual entry. */
  const [notFound, setNotFound] = useState<string | null>(null);
  /** IN-2: an in-store code asks for a confirmation of the match first. */
  const [inStore, setInStore] = useState<{ name: string; fill: () => void } | null>(null);
  // IN-2, IN-10: what a barcode lookup said, and the allergen tags it only suggests.
  const [fromCode, setFromCode] = useState<{ note: string; tags: Allergen[]; hintKey?: string; ai?: boolean } | null>(null);
  const [meals, setMeals] = useState<ReturnType<typeof mealHistory>>([]);
  const [prefs, setPrefs] = useState<Preferences>(defaultPreferences());
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState<string[]>(['']);
  // Adding an ingredient grows the form; scroll so Add ingredient stays just above the keyboard and the floating Save.
  const scrollRef = useRef<ScrollViewInstance>(null);
  const addBottom = useRef(0);
  const prevCount = useRef(1);
  const windowHeight = useWindowDimensions().height;
  // The new row takes focus (autoFocus), so the keyboard slides out when it was hidden: scroll once its height is known.
  const [focusNew, setFocusNew] = useState<number | null>(null);
  useEffect(() => {
    const grew = ingredients.length > prevCount.current;
    prevCount.current = ingredients.length;
    if (!grew) return;
    const scrollTo = (kb: number) => {
      const visible = windowHeight - kb - 190; // header and the floating Save
      setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, addBottom.current + 52 - visible), animated: true }), 50);
    };
    if (Keyboard.isVisible()) {
      scrollTo(Keyboard.metrics()?.height ?? 0);
      return;
    }
    const sub = Keyboard.addListener('keyboardDidShow', (e) => {
      sub.remove();
      scrollTo(e.endCoordinates.height);
    });
    const give = setTimeout(() => sub.remove(), 2000);
    return () => {
      clearTimeout(give);
      sub.remove();
    };
  }, [ingredients.length, windowHeight]);
  const [allergens, setAllergens] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [fillLater, setFillLater] = useState(false);
  const ingredientRun = useIngredientRun();
  // IN-10: the AI's allergen suggestion lands as a hint with a select button; nothing is selected by itself.
  const allergenAi = useAllergenAi((tags, note) =>
    setFromCode({ note: [tags.length === 0 ? t('meal.aiAllergensNone') : '', note ?? ''].filter(Boolean).join(' '), tags, hintKey: 'meal.aiAllergensHint', ai: true }),
  );
  const [at, setAt] = useState<Date | null>(null);
  const [edited, setEdited] = useState(false);
  const [origin, setOrigin] = useState<Origin>(typedOrigin());
  const [names, setNames] = useState<string[]>([]);
  const [focused, setFocused] = useState<number | null>(null);
  const [dateHint, setDateHint] = useState<string | null>(null);

  const load = useCallback(() => {
    (async () => {
      setMeals(mealHistory(await deps.repo.listMeals()));
      setPrefs(await getPreferences(deps));
      setNames(await ingredientNameHistory(deps));
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
        if (!p) return setNotFound(found.barcode); // IN-8: neither the diary nor the database knows it
        // IN-16: what the database lists is the source; its tags are suggestions and the baseline for later edits.
        review({
          description: p?.name ?? '',
          ingredients: p?.ingredients ?? [],
          allergens: [],
          barcode: found.barcode,
          source: p ? { kind: 'open_food_facts', edited: false, llm: null, aiTags: false } : typedSource(),
          sourceAllergens: p?.allergens ?? [],
        });
        setFromCode({ note: !p ? t('meal.scanNotFound') : found.incomplete ? t('meal.scanIncomplete') : p.translated ? t('meal.scanFromDbTranslated') : t('meal.scanFromDb'), tags: p?.allergens ?? [] });
      };
      if ((found.product || found.history) && found.inStore) {
        // IN-2: an in-store code is ambiguous; the user confirms the match or goes back.
        setInStore({ name: found.history?.name ?? found.product?.name ?? '', fill });
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
        source: { kind: SOURCE_OF[r.kind], edited: false, llm: r.provenance, aiTags: false },
        filled: { ingredients: next.map((i) => i.trim()).filter(Boolean), allergens: r.label ? tags : [...allergens] },
      });
    }
    if (tags.length > 0) setFromCode({ note: t('meal.labelTagsHint', { list: tags.map((a) => t(`allergens.${a}`)).join(', ') }), tags, ai: true });
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
      scrollRef={scrollRef}
      dirty={phase === 'review' ? edited : description.trim().length > 0}
      missing={missing}
      hideSave={phase !== 'review'}
      onSave={async () => {
        ingredientRun.cancel(); // Save uses the fields as they are and drops a running call
        await logMeal(deps, { description, ...saveFields(), fillLater, note, at: at ?? (day ? defaultAt : undefined) });
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
          {notFound && (
            <GlassSurface style={{ borderRadius: 26, padding: 16, gap: 10, alignItems: 'center' }}>
              <Icon name="scan" size={40} tint={color.accent} />
              <Text style={{ fontSize: 20, fontWeight: '800', letterSpacing: -0.4 }}>{t('meal.scanNotFoundTitle')}</Text>
              <Text style={{ fontSize: 15, color: color.soft, textAlign: 'center' }}>{t('meal.scanNotFound')}</Text>
              <Text style={{ fontSize: 13, color: color.muted }}>{t('meal.scanBarcode', { code: notFound })}</Text>
              <Button
                title={t('meal.scanReadLabel')}
                onPress={() => {
                  review({ description: '', ingredients: [], allergens: [], barcode: notFound });
                  setNotFound(null);
                  ingredientRun.start('label');
                }}
              />
              <Button
                kind="secondary"
                title={t('meal.scanByHand')}
                onPress={() => {
                  review({ description: '', ingredients: [], allergens: [], barcode: notFound });
                  setNotFound(null);
                }}
              />
            </GlassSurface>
          )}
          <Button kind="secondary" title={t('meal.scanCancel')} onPress={() => { setNotFound(null); setPhase('choose'); }} />
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
          {description.trim() !== '' && <Button kind="secondary" title={t('meal.fromName')} onPress={() => void ingredientRun.startName(description)} />}
          <IngredientRunPanel hook={ingredientRun} onAdd={addRun} />
          <Label>{t('meal.ingredients')}</Label>
          {ingredients.map((value, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <TextInput
                  style={styles.input}
                  placeholder={t('meal.ingredientPlaceholder')}
                  value={value}
                  autoFocus={focusNew === i}
                  onChangeText={(v) => setIngredient(i, v)}
                  onFocus={() => setFocused(i)}
                  onBlur={() => setFocused((f) => (f === i ? null : f))}
                />
                {/* IN-1: names from the diary that match what is being typed; a tap fills the row. */}
                {focused === i && matchIngredientNames(names, value, ingredients).length > 0 && (
                  <Chips
                    items={matchIngredientNames(names, value, ingredients).map((n) => ({ id: n, label: n }))}
                    selected={new Set()}
                    onToggle={(n) => {
                      setIngredient(i, n);
                      setFocused(null);
                    }}
                  />
                )}
              </View>
              {ingredients.length > 1 && (
                <Button kind="secondary" title="−" accessibilityLabel={t('meal.removeIngredient')} onPress={() => touch(setIngredients)(ingredients.filter((_, j) => j !== i))} />
              )}
            </View>
          ))}
          <View onLayout={(e) => (addBottom.current = e.nativeEvent.layout.y)}>
            <Button kind="secondary" title={t('meal.addIngredient')} onPress={() => {
                setFocusNew(ingredients.length);
                setIngredients((l) => [...l, '']);
              }} />
          </View>

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
              <Button kind="secondary" title={t('meal.scanSelectTags')} onPress={() => {
                  touch(setAllergens)(new Set([...allergens, ...fromCode.tags]));
                  // IN-16, EX-4: tags taken from an AI suggestion are marked as such in the entry and the exports.
                  if (fromCode.ai) setOrigin((o) => ({ ...o, source: { ...o.source, aiTags: true } }));
                }} />
            </>
          )}
          <AllergenAiControls hook={allergenAi} ingredients={ingredients} />
          <Button kind="secondary" title={t('meal.suggestAllergens')} onPress={() => touch(setAllergens)(new Set(suggestAllergens(ingredients)))} />
          <Hint>{t('meal.allergensHint')}</Hint>
          <FillLaterSwitch value={fillLater} onChange={touch(setFillLater)} />

          <TimeField value={at ?? defaultAt} onChange={touch(setAt)} />
          <Label>{t('common.note')}</Label>
          <TextInput style={styles.input} accessibilityLabel={t('common.note')} value={note} onChangeText={touch(setNote)} />
        </>
      )}
      {inStore && (
        <Sheet title={t('meal.scanInStoreTitle')} onClose={() => { setInStore(null); setPhase('choose'); }}>
          <Hint>{t('meal.scanInStoreBody')}</Hint>
          <SheetRow icon="meal" title={inStore.name || t('meal.scanInStoreTitle')} onPress={() => undefined} />
          <SheetRow outline title={t('meal.scanUse')} onPress={() => { const go = inStore.fill; setInStore(null); go(); }} />
        </Sheet>
      )}
    </FormModal>
  );
}
