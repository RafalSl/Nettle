import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Switch, View } from 'react-native';
import { Text, TextInput } from '@/ui/themed';
import { CHANGE_ACTIONS, SYMPTOMS, type ChangeAction, type ListItem, type Meal, type Symptom } from '@/core/model/types';
import { itemsInUse, logChangeEvent, logReaction, type InUseItem } from '@/core/usecases/events';
import { listActiveItems } from '@/core/usecases/lists';
import { errorMessage, itemDescription, itemLabel, t } from '@/i18n';
import { useServices } from '@/services';
import { FormModal, useField, useForm } from '@/ui/FormModal';
import { useFormTime } from '@/ui/useFormTime';
import { Chips, Hint, Label, TimeField, styles } from '@/ui/components';
import { color } from '@/ui/theme';

const toggled = (set: Set<string>, id: string) => {
  const next = new Set(set);
  if (!next.delete(id)) next.add(id);
  return next;
};

/**
 * IN-12: a routine change: a product or diet started or stopped, on a date. "Stopped" offers what is in use now;
 * "Started" can say "already using, date unknown" for things begun before the diary.
 */
export function ChangeEventSection() {
  const { deps } = useServices();
  const f = useForm();
  const [action, setAction] = useField<ChangeAction>('started', f.touch);
  const [categories, setCategories] = useState<ListItem[]>([]);
  const [category, setCategory] = useField<string>('cat-product', f.touch);
  const [name, setName] = useField('', f.touch);
  const [unknown, setUnknown] = useField(false, f.touch);
  const [inUse, setInUse] = useState<InUseItem[]>([]);
  const time = useFormTime(f.touch);
  useFocusEffect(
    useCallback(() => {
      (async () => {
        setCategories(await listActiveItems(deps, 'changeCategories'));
        setInUse(await itemsInUse(deps));
      })().catch((e) => Alert.alert(errorMessage(e)));
    }, [deps]),
  );
  const selected = categories.find((c) => c.id === category);
  const description = selected ? itemDescription(selected) : null;
  const known = unknown && action === 'started';
  return (
    <FormModal
      dirty={f.dirty}
      missing={name.trim() ? null : t('edit.name')}
      onSave={async () => {
        await logChangeEvent(deps, { action, category, name, ...(known ? { dateUnknown: true } : { at: time.atForSave }) });
      }}>
      <Chips items={CHANGE_ACTIONS.map((a) => ({ id: a, label: t(`change.actions.${a}`) }))} selected={new Set([action])} onToggle={(id) => setAction(id as ChangeAction)} />
      <Chips items={categories.map((c) => ({ id: c.id, label: itemLabel(c) }))} selected={new Set([category])} onToggle={setCategory} />
      {description ? <Hint>{description}</Hint> : null}
      {action === 'stopped' && (
        <>
          <Label>{t('change.inUse')}</Label>
          {inUse.length === 0 ? (
            <Hint>{t('change.inUseNone')}</Hint>
          ) : (
            <Chips
              items={inUse.map((i) => ({ id: `${i.category}|${i.name}`, label: i.name }))}
              selected={new Set(inUse.filter((i) => i.name === name && i.category === category).map((i) => `${i.category}|${i.name}`))}
              onToggle={(id) => {
                const item = inUse.find((i) => `${i.category}|${i.name}` === id);
                if (!item) return;
                setName(item.name);
                setCategory(item.category);
              }}
            />
          )}
        </>
      )}
      <TextInput style={styles.input} accessibilityLabel={t('more.changeName')} placeholder={t('more.changeName')} value={name} onChangeText={setName} />
      {action === 'started' && (
        <View style={styles.timeRow}>
          <Text style={styles.rowText}>{t('change.dateUnknown')}</Text>
          <Switch value={unknown} onValueChange={setUnknown} accessibilityLabel={t('change.dateUnknown')} />
        </View>
      )}
      {!known && <TimeField value={time.value} onChange={time.set} />}
      {known && <Hint>{t('change.dateUnknownHint')}</Hint>}
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
      <Text style={{ color: color.alert, fontWeight: '600' }}>{t('more.reactionUrgent')}</Text>
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
