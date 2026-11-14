import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { addIngredients, suggestAllergens } from '@/core/model/allergens';
import { NettleError } from '@/core/model/errors';
import { defaultPreferences, type Preferences } from '@/core/model/preferences';
import { mealHistory, rankSuggestions, type Suggestion } from '@/core/model/suggestions';
import { atOnDay, localDay } from '@/core/model/time';
import { afterEdit, sameIngredients, typedSource, type IngredientSource, type LlmProvenance } from '@/core/model/source';
import { ALLERGENS, type Allergen } from '@/core/model/types';
import { estimateIngredients } from '@/core/usecases/llm';
import { lookupProduct } from '@/core/usecases/barcode';
import { logMeal } from '@/core/usecases/logMeal';
import { getPreferences, toggleFavoriteMeal } from '@/core/usecases/preferences';
import { pickPhotoUris } from '@/adapters/photos/pickPhotos';
import { currentLanguage, errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { confirmDestructive } from '@/ui/actionSheet';
import { BarcodeScanner } from '@/ui/BarcodeScanner';
import { FormModal } from '@/ui/FormModal';
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

const DAY_MS = 86_400_000;
/** LL-12: after this long the form says the estimate is still working. */
export const SLOW_ESTIMATE_MS = 30_000;

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
  const [fromCode, setFromCode] = useState<{ note: string; tags: Allergen[] } | null>(null);
  const [meals, setMeals] = useState<ReturnType<typeof mealHistory>>([]);
  const [prefs, setPrefs] = useState<Preferences>(defaultPreferences());
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState<string[]>(['']);
  const [allergens, setAllergens] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  type Estimate =
    | { status: 'idle' }
    | { status: 'running'; slow: boolean }
    | { status: 'ready'; names: string[]; picked: Set<string>; uncertainty: string | null; provenance: LlmProvenance }
    | { status: 'failed'; error: unknown };
  const [est, setEst] = useState<Estimate>({ status: 'idle' });
  const ctl = useRef<AbortController | null>(null);
  const photoUri = useRef<string | null>(null);
  const slowTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
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
  const defaultAt = typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) ? atOnDay(day, now, tz) : now;

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
      const days = Math.round((Date.parse(localDay(now.toISOString(), tz)) - Date.parse(localDay(s.lastAt, tz))) / DAY_MS);
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
          setDateHint(t('meal.scanFromHistory', { date: localDay(h.at, deps.clock.timeZone()) }));
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

  /** IN-3: pick a photo and confirm that it is sent (LL-5). The estimate then runs inline; the form stays editable. */
  function suggestFromPhoto() {
    const send = async (source: 'camera' | 'library') => {
      try {
        const uri = (await pickPhotoUris(source))[0];
        if (!uri) return;
        Alert.alert(t('meal.photoConfirmTitle'), t('meal.photoConfirmBody'), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('meal.photoSend'), onPress: () => void runEstimate(uri) },
        ]);
      } catch (e) {
        Alert.alert(errorMessage(e));
      }
    };
    Alert.alert(t('meal.fromPhoto'), undefined, [
      { text: t('photos.camera'), onPress: () => send('camera') },
      { text: t('photos.library'), onPress: () => send('library') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }

  /**
   * LL-12: runs inline and can be cancelled; after 30 seconds the form says it is still working. Cancel, a
   * failure, saving and leaving the form all store nothing; a failure offers a one-tap retry.
   */
  async function runEstimate(uri: string) {
    ctl.current?.abort();
    const controller = new AbortController();
    ctl.current = controller;
    photoUri.current = uri;
    clearTimeout(slowTimer.current);
    setEst({ status: 'running', slow: false });
    slowTimer.current = setTimeout(() => setEst((e) => (e.status === 'running' ? { status: 'running', slow: true } : e)), SLOW_ESTIMATE_MS);
    try {
      const data = await deps.photos.compress(uri, 1024);
      const result = await estimateIngredients(deps, { image: { mimeType: 'image/jpeg', data }, language: currentLanguage(), signal: controller.signal });
      if (controller.signal.aborted) return;
      setEst({ status: 'ready', names: result.names, picked: new Set(), uncertainty: result.uncertainty, provenance: result.provenance });
    } catch (e) {
      if (controller.signal.aborted || (e instanceof NettleError && e.code === 'llm_cancelled')) return setEst({ status: 'idle' });
      setEst({ status: 'failed', error: e });
    } finally {
      if (ctl.current === controller) {
        clearTimeout(slowTimer.current);
        ctl.current = null;
      }
    }
  }
  const cancelEstimate = () => {
    ctl.current?.abort();
    setEst({ status: 'idle' });
  };
  // Leaving the form aborts a running estimate.
  useEffect(() => () => ctl.current?.abort(), []);

  /** IN-3: the chosen names become ordinary rows of the list, editable and removable; allergen tags stay as they are (IN-10). */
  function addEstimate(names: string[]) {
    const next = addIngredients(ingredients, names);
    touch(setIngredients)(next);
    // IN-16: an estimate on a typed meal becomes its source; the list as just filled is the baseline for edits.
    if (est.status === 'ready' && origin.source.kind === 'typed') {
      setOrigin({ barcode: origin.barcode, source: { kind: 'photo_estimate', edited: false, llm: est.provenance }, filled: { ingredients: next.map((i) => i.trim()).filter(Boolean), allergens: [...allergens] } });
    }
    setEst({ status: 'idle' });
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
        ctl.current?.abort(); // Save uses the fields as they are and drops a running estimate
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

          <Button kind="secondary" title={t('meal.fromPhoto')} onPress={suggestFromPhoto} />
          {est.status === 'running' && (
            <>
              <Hint>{est.slow ? t('meal.estimateSlow') : t('meal.estimating')}</Hint>
              {est.slow && <Button kind="secondary" title={t('meal.estimateCancel')} onPress={cancelEstimate} />}
            </>
          )}
          {est.status === 'ready' && (
            <>
              <Hint>{t('meal.suggested')}</Hint>
              {est.uncertainty !== null && <Hint>{t('meal.unsure', { text: est.uncertainty })}</Hint>}
              <Chips
                items={est.names.map((n) => ({ id: n, label: n }))}
                selected={est.picked}
                onToggle={(id) => {
                  const picked = new Set(est.picked);
                  if (!picked.delete(id)) picked.add(id);
                  setEst({ ...est, picked });
                }}
              />
              <Button title={t('meal.estimateAddAll')} onPress={() => addEstimate(est.names)} />
              {est.picked.size > 0 && <Button kind="secondary" title={t('meal.estimateAddPicked')} onPress={() => addEstimate([...est.picked])} />}
              <Button kind="secondary" title={t('meal.estimateDismiss')} onPress={() => setEst({ status: 'idle' })} />
            </>
          )}
          {est.status === 'failed' && (
            <>
              <Hint>{`${errorMessage(est.error)} ${t('meal.estimateFailed')}`}</Hint>
              <Button title={t('meal.estimateRetry')} onPress={() => photoUri.current && void runEstimate(photoUri.current)} />
              <Button kind="secondary" title={t('meal.estimateDismiss')} onPress={() => setEst({ status: 'idle' })} />
            </>
          )}
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
              <Hint>{t('meal.scanTagsHint', { list: fromCode.tags.map((a) => t(`allergens.${a}`)).join(', ') })}</Hint>
              <Button kind="secondary" title={t('meal.scanSelectTags')} onPress={() => touch(setAllergens)(new Set([...allergens, ...fromCode.tags]))} />
            </>
          )}
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
