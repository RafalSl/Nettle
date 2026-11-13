import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Text, TextInput } from 'react-native';
import {
  CHANGE_ACTIONS,
  CHANGE_CATEGORIES,
  SYMPTOMS,
  type ChangeAction,
  type ChangeCategory,
  type Meal,
  type Symptom,
} from '@/core/model/types';
import { logChangeEvent, logReaction } from '@/core/usecases/events';
import { errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { Button, Chips, Heading, Hint, Label, TimeField, styles } from '@/ui/components';

/** IN-12: "started" or "stopped" a product, medication or diet, on a date. */
export function ChangeEventSection() {
  const { deps } = useServices();
  const [action, setAction] = useState<ChangeAction>('started');
  const [category, setCategory] = useState<ChangeCategory>('product');
  const [name, setName] = useState('');
  const [at, setAt] = useState<Date | null>(null);

  async function save() {
    try {
      await logChangeEvent(deps, { action, category, name, at: at ?? undefined });
      setName('');
      setAt(null);
      Alert.alert(t('more.logged'));
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }

  return (
    <>
      <Heading>{t('more.changeTitle')}</Heading>
      <Chips
        items={CHANGE_ACTIONS.map((a) => ({ id: a, label: t(`change.actions.${a}`) }))}
        selected={new Set([action])}
        onToggle={(id) => setAction(id as ChangeAction)}
      />
      <Chips
        items={CHANGE_CATEGORIES.map((c) => ({ id: c, label: t(`change.categories.${c}`) }))}
        selected={new Set([category])}
        onToggle={(id) => setCategory(id as ChangeCategory)}
      />
      <TextInput style={styles.input} placeholder={t('more.changeName')} value={name} onChangeText={setName} />
      <TimeField value={at ?? new Date()} onChange={setAt} />
      <Button title={t('more.changeSave')} onPress={save} />
    </>
  );
}

/** IN-13: symptoms within about two hours of a meal, linked to that meal. Always shows the urgent-care advice. */
export function ReactionSection() {
  const { deps } = useServices();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [mealId, setMealId] = useState<string | null>(null);
  const [symptoms, setSymptoms] = useState<Set<string>>(new Set());
  const [at, setAt] = useState<Date | null>(null);

  const reload = useCallback(() => {
    deps.repo.listMeals().then((m) => {
      const recent = m.slice(0, 5);
      setMeals(recent);
      setMealId((cur) => (cur && recent.some((x) => x.id === cur) ? cur : (recent[0]?.id ?? null)));
    });
  }, [deps]);
  useFocusEffect(reload);

  async function save() {
    try {
      if (!mealId) return;
      await logReaction(deps, { mealId, symptoms: [...symptoms] as Symptom[], at: at ?? undefined });
      setSymptoms(new Set());
      setAt(null);
      Alert.alert(t('more.logged'));
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }

  return (
    <>
      <Heading>{t('more.reactionTitle')}</Heading>
      <Text style={{ color: '#c0392b', fontWeight: '600' }}>{t('more.reactionUrgent')}</Text>
      {meals.length === 0 ? (
        <Hint>{t('more.reactionNoMeals')}</Hint>
      ) : (
        <>
          <Label>{t('more.reactionMeal')}</Label>
          <Chips
            items={meals.map((m) => ({ id: m.id, label: `${new Date(m.at.utc).toLocaleString()} · ${m.description.slice(0, 30)}` }))}
            selected={new Set(mealId ? [mealId] : [])}
            onToggle={setMealId}
          />
          <Label>{t('more.reactionSymptoms')}</Label>
          <Chips
            items={SYMPTOMS.map((s) => ({ id: s, label: t(`symptoms.${s}`) }))}
            selected={symptoms}
            onToggle={(id) =>
              setSymptoms((cur) => {
                const next = new Set(cur);
                if (!next.delete(id)) next.add(id);
                return next;
              })
            }
          />
          <Label>{t('more.reactionOnset')}</Label>
          <TimeField value={at ?? new Date()} onChange={setAt} />
          <Button title={t('more.reactionSave')} onPress={save} />
        </>
      )}
    </>
  );
}
