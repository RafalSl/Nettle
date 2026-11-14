import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { suggestAllergens } from '@/core/model/allergens';
import { ALLERGENS, type Allergen, type Meal } from '@/core/model/types';
import { estimateIngredients } from '@/core/usecases/llm';
import { logMeal } from '@/core/usecases/logMeal';
import { pickPhotoUris } from '@/adapters/photos/pickPhotos';
import { currentLanguage, errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { Button, Chips, Heading, Hint, Label, Screen, TimeField, styles } from '@/ui/components';

/** IN-1: manual meal entry. */
export default function MealScreen() {
  const { deps } = useServices();
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState<string[]>(['']);
  const [allergens, setAllergens] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [unsure, setUnsure] = useState<string | null>(null);
  const [at, setAt] = useState<Date | null>(null);
  const [recent, setRecent] = useState<Meal[]>([]);

  const reload = useCallback(() => {
    deps.repo.listMeals().then((m) => setRecent(m.slice(0, 5)));
  }, [deps]);
  useFocusEffect(reload);

  const setIngredient = (i: number, v: string) =>
    setIngredients((list) => list.map((x, j) => (j === i ? v : x)));

  /** IN-3: pick a photo, confirm that it is sent (LL-5), then fill the form with suggestions to review. */
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
                setIngredients(est.names.length > 0 ? est.names : ['']);
                setAllergens(new Set(suggestAllergens(est.names)));
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

  async function save() {
    try {
      await logMeal(deps, { description, ingredients, allergens: [...allergens] as Allergen[], note, at: at ?? undefined });
      setDescription('');
      setIngredients(['']);
      setAllergens(new Set());
      setUnsure(null);
      setNote('');
      setAt(null);
      reload();
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }

  return (
    <Screen>
      <Heading>{t('meal.title')}</Heading>
      <Label>{t('meal.description')}</Label>
      <TextInput style={styles.input} value={description} onChangeText={setDescription} />

      <Button kind="secondary" title={t('meal.fromPhoto')} onPress={suggestFromPhoto} />
      {unsure !== null && <Hint>{t('meal.suggested')} {t('meal.unsure', { text: unsure })}</Hint>}
      <Label>{t('meal.ingredients')}</Label>
      {ingredients.map((value, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder={t('meal.ingredientPlaceholder')}
            value={value}
            onChangeText={(v) => setIngredient(i, v)}
          />
          {ingredients.length > 1 && (
            <Button
              kind="secondary"
              title="−"
              accessibilityLabel={t('meal.removeIngredient')}
              onPress={() => setIngredients((l) => l.filter((_, j) => j !== i))}
            />
          )}
        </View>
      ))}
      <Button kind="secondary" title={t('meal.addIngredient')} onPress={() => setIngredients((l) => [...l, ''])} />

      <Label>{t('meal.allergens')}</Label>
      <Chips
        items={ALLERGENS.map((a) => ({ id: a, label: t(`allergens.${a}`) }))}
        selected={allergens}
        onToggle={(id) =>
          setAllergens((cur) => {
            const next = new Set(cur);
            if (!next.delete(id)) next.add(id);
            return next;
          })
        }
      />
      <Button kind="secondary" title={t('meal.suggestAllergens')} onPress={() => setAllergens(new Set(suggestAllergens(ingredients)))} />
      <Hint>{t('meal.allergensHint')}</Hint>

      <TimeField value={at ?? new Date()} onChange={setAt} />
      <Label>{t('common.note')}</Label>
      <TextInput style={styles.input} value={note} onChangeText={setNote} />
      <Button title={t('common.save')} onPress={save} />

      <Label>{t('common.recent')}</Label>
      {recent.length === 0 && <Hint>{t('common.nothingYet')}</Hint>}
      {recent.map((m) => (
        <View key={m.id} style={styles.row}>
          <Text style={styles.rowText}>
            {new Date(m.at.utc).toLocaleString()} · {m.description}
          </Text>
          {m.ingredients.length > 0 && <Hint>{m.ingredients.join(', ')}</Hint>}
        </View>
      ))}
    </Screen>
  );
}
