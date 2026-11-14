import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { suggestAllergens } from '@/core/model/allergens';
import { defaultPreferences, type Preferences } from '@/core/model/preferences';
import { mealHistory, rankSuggestions, type Suggestion } from '@/core/model/suggestions';
import { atOnDay, localDay } from '@/core/model/time';
import { ALLERGENS, type Allergen } from '@/core/model/types';
import { estimateIngredients } from '@/core/usecases/llm';
import { logMeal } from '@/core/usecases/logMeal';
import { getPreferences, toggleFavoriteMeal } from '@/core/usecases/preferences';
import { pickPhotoUris } from '@/adapters/photos/pickPhotos';
import { currentLanguage, errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { confirmDestructive } from '@/ui/actionSheet';
import { FormModal } from '@/ui/FormModal';
import { Button, Chips, Hint, Label, TimeField, styles } from '@/ui/components';

/** What a pick fills into the review form: the latest use of the meal, or a favorite's snapshot. */
interface MealDraft {
  description: string;
  ingredients: string[];
  allergens: Allergen[];
}

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
  const [phase, setPhase] = useState<'choose' | 'review'>('choose');
  const [meals, setMeals] = useState<ReturnType<typeof mealHistory>>([]);
  const [prefs, setPrefs] = useState<Preferences>(defaultPreferences());
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState<string[]>(['']);
  const [allergens, setAllergens] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [unsure, setUnsure] = useState<string | null>(null);
  const [at, setAt] = useState<Date | null>(null);
  const [edited, setEdited] = useState(false);

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
    meals.map((h) => ({ ...h, payload: { description: h.payload.description, ingredients: h.payload.ingredients, allergens: h.payload.allergens } })),
    prefs.favorites.meals.map((f) => ({ key: f.key, label: f.description, payload: { description: f.description, ingredients: f.ingredients, allergens: f.allergens } })),
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
    setEdited(false);
    setPhase('review');
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

  /** IN-3: pick a photo, confirm that it is sent (LL-5), then add the suggestions to the list, never replacing what is typed. */
  function suggestFromPhoto() {
    const send = async (source: 'camera' | 'library') => {
      try {
        const uri = (await pickPhotoUris(source))[0];
        if (!uri) return;
        Alert.alert(t('meal.photoConfirmTitle'), t('meal.photoConfirmBody'), [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('meal.photoSend'),
            onPress: async () => {
              try {
                const data = await deps.photos.compress(uri, 1024);
                const est = await estimateIngredients(deps, { image: { mimeType: 'image/jpeg', data }, language: currentLanguage() });
                setIngredients((cur) => {
                  const have = new Set(cur.map((x) => x.trim().toLowerCase()));
                  const added = est.names.filter((n) => !have.has(n.trim().toLowerCase()));
                  return [...cur.filter((x) => x.trim()), ...added, ''];
                });
                setEdited(true); // LLM allergen tags stay unselected until the user selects them (IN-10)
                setUnsure(est.uncertainty);
              } catch (e) {
                Alert.alert(errorMessage(e));
              }
            },
          },
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

  const key = description.trim().toLowerCase().replace(/\s+/g, ' ');
  const isFavorite = prefs.favorites.meals.some((m) => m.key === key);
  async function star() {
    try {
      await toggleFavoriteMeal(deps, { description: description.trim(), ingredients: ingredients.map((i) => i.trim()).filter(Boolean), allergens: [...allergens] as Allergen[] });
      setPrefs(await getPreferences(deps));
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }

  const missing = phase === 'choose' ? t('meal.reviewFirst') : description.trim() ? null : t('edit.description');
  return (
    <FormModal
      dirty={phase === 'choose' ? description.trim().length > 0 : edited}
      missing={missing}
      onSave={async () => {
        await logMeal(deps, { description, ingredients, allergens: [...allergens] as Allergen[], note, at: at ?? (day ? defaultAt : undefined) });
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
          <Hint>{t('meal.chooseHint')}</Hint>
        </>
      ) : (
        <>
          <Button kind="secondary" title={t('meal.changeMeal')} onPress={() => void changeMeal()} />
          <Label>{t('meal.description')}</Label>
          <TextInput style={styles.input} accessibilityLabel={t('meal.description')} value={description} onChangeText={touch(setDescription)} />
          <Button kind="secondary" title={isFavorite ? t('meal.unfavorite') : t('meal.favorite')} onPress={() => void star()} />

          <Button kind="secondary" title={t('meal.fromPhoto')} onPress={suggestFromPhoto} />
          {unsure !== null && <Hint>{t('meal.suggested')} {t('meal.unsure', { text: unsure })}</Hint>}
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
