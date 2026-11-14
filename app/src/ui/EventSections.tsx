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
import { FormModal, useField, useForm } from '@/ui/FormModal';
import { useFormTime } from '@/ui/useFormTime';
import { Chips, Hint, Label, TimeField, styles } from '@/ui/components';

const toggled = (set: Set<string>, id: string) => {
  const next = new Set(set);
  if (!next.delete(id)) next.add(id);
  return next;
};

/** IN-12: "started" or "stopped" a product, medication or diet, on a date. */
export function ChangeEventSection() {
  const { deps } = useServices();
  const f = useForm();
  const [action, setAction] = useField<ChangeAction>('started', f.touch);
  const [category, setCategory] = useField<ChangeCategory>('product', f.touch);
  const [name, setName] = useField('', f.touch);
  const time = useFormTime(f.touch);
  return (
    <FormModal
      dirty={f.dirty}
      missing={name.trim() ? null : t('edit.name')}
      onSave={async () => {
        await logChangeEvent(deps, { action, category, name, at: time.atForSave });
      }}>
      <Chips items={CHANGE_ACTIONS.map((a) => ({ id: a, label: t(`change.actions.${a}`) }))} selected={new Set([action])} onToggle={(id) => setAction(id as ChangeAction)} />
      <Chips items={CHANGE_CATEGORIES.map((c) => ({ id: c, label: t(`change.categories.${c}`) }))} selected={new Set([category])} onToggle={(id) => setCategory(id as ChangeCategory)} />
      <TextInput style={styles.input} accessibilityLabel={t('more.changeName')} placeholder={t('more.changeName')} value={name} onChangeText={setName} />
      <TimeField value={time.value} onChange={time.set} />
    </FormModal>
  );
}

/** IN-13: symptoms within about two hours of a meal, linked to that meal. Always shows the urgent-care advice. */
export function ReactionSection() {
  const { deps } = useServices();
  const f = useForm();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [mealId, setMealId] = useField<string | null>(null, f.touch);
  const [symptoms, setSymptoms] = useField<Set<string>>(new Set(), f.touch);
  const time = useFormTime(f.touch);

  const reload = useCallback(() => {
    deps.repo
      .listMeals()
      .then((m) => setMeals(m.slice(0, 5)))
      .catch((e) => Alert.alert(errorMessage(e)));
  }, [deps]);
  useFocusEffect(reload);
  const selected = mealId && meals.some((m) => m.id === mealId) ? mealId : (meals[0]?.id ?? null);

  const missing = !selected ? t('edit.meal') : symptoms.size === 0 ? t('edit.symptoms') : null;
  return (
    <FormModal
      dirty={f.dirty}
      missing={missing}
      onSave={async () => {
        await logReaction(deps, { mealId: selected!, symptoms: [...symptoms] as Symptom[], at: time.atForSave });
      }}>
      <Text style={{ color: '#c0392b', fontWeight: '600' }}>{t('more.reactionUrgent')}</Text>
      {meals.length === 0 ? (
        <Hint>{t('more.reactionNoMeals')}</Hint>
      ) : (
        <>
          <Label>{t('more.reactionMeal')}</Label>
          <Chips
            items={meals.map((m) => ({ id: m.id, label: `${new Date(m.at.utc).toLocaleString()} · ${m.description.slice(0, 30)}` }))}
            selected={new Set(selected ? [selected] : [])}
            onToggle={setMealId}
          />
          <Label>{t('more.reactionSymptoms')}</Label>
          <Chips items={SYMPTOMS.map((s) => ({ id: s, label: t(`symptoms.${s}`) }))} selected={symptoms} onToggle={(id) => setSymptoms(toggled(symptoms, id))} />
          <Label>{t('more.reactionOnset')}</Label>
          <TimeField value={time.value} onChange={time.set} />
        </>
      )}
    </FormModal>
  );
}
