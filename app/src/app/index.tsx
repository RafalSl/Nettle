import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import type { Meal } from '@/core/model/types';
import { logMeal } from '@/core/usecases/logMeal';
import { errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { Button, Heading, Hint, Label, Screen, TimeField, styles } from '@/ui/components';

/** IN-1: manual meal entry. */
export default function MealScreen() {
  const { deps } = useServices();
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState<string[]>(['']);
  const [note, setNote] = useState('');
  const [at, setAt] = useState<Date | null>(null);
  const [recent, setRecent] = useState<Meal[]>([]);

  const reload = useCallback(() => {
    deps.repo.listMeals().then((m) => setRecent(m.slice(0, 5)));
  }, [deps]);
  useFocusEffect(reload);

  const setIngredient = (i: number, v: string) =>
    setIngredients((list) => list.map((x, j) => (j === i ? v : x)));

  async function save() {
    try {
      await logMeal(deps, { description, ingredients, note, at: at ?? undefined });
      setDescription('');
      setIngredients(['']);
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
