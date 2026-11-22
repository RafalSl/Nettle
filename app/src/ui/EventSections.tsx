import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Text, TextInput } from '@/ui/themed';
import { CHANGE_ACTIONS, SYMPTOMS, type ChangeAction, type ListItem, type Meal, type Symptom } from '@/core/model/types';
import { itemsInUse, logChangeEvent, logReaction, type InUseItem } from '@/core/usecases/events';
import { listActiveItems } from '@/core/usecases/lists';
import { itemDescription, itemLabel, t } from '@/i18n';
import { useServices } from '@/services';
import { FormModal, useField, useForm } from '@/ui/FormModal';
import { useFormTime } from '@/ui/useFormTime';
import { Button, Chips, Hint, Label, TimeField, styles } from '@/ui/components';
import { color } from '@/ui/theme';
import { SwitchRow } from '@/ui/SwitchRow';
import { RadioRow } from '@/ui/RadioRow';
import { showError } from '@/ui/showError';
import { toggled } from '@/ui/sets';

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
      })().catch((e) => showError(e));
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
      }}
    >
      <Chips
        items={CHANGE_ACTIONS.map((a) => ({ id: a, label: t(`change.actions.${a}`) }))}
        selected={new Set([action])}
        onToggle={(id) => setAction(id as ChangeAction)}
      />
      <Chips items={categories.map((c) => ({ id: c.id, label: itemLabel(c) }))} selected={new Set([category])} onToggle={setCategory} />
      {description ? <Hint>{description}</Hint> : null}
      {action === 'stopped' && (
        <>
          <Label>{t('change.inUse')}</Label>
          {inUse.length === 0 ? (
            <Hint>{t('change.inUseNone')}</Hint>
          ) : (
            <View style={{ gap: 8 }}>
              {inUse.map((i) => (
                <RadioRow
                  key={`${i.category}|${i.name}`}
                  icon="change"
                  title={i.name}
                  detail={categories.find((c) => c.id === i.category) ? itemLabel(categories.find((c) => c.id === i.category)!) : undefined}
                  selected={i.name === name && i.category === category}
                  onPress={() => {
                    setName(i.name);
                    setCategory(i.category);
                  }}
                />
              ))}
            </View>
          )}
        </>
      )}
      <TextInput
        style={styles.input}
        accessibilityLabel={t('more.changeName')}
        placeholder={t('more.changeName')}
        value={name}
        onChangeText={setName}
      />
      {action === 'started' && <SwitchRow title={t('change.dateUnknown')} value={unknown} onChange={setUnknown} />}
      {!known && <TimeField value={time.value} onChange={time.set} />}
      {known && <Hint>{t('change.dateUnknownHint')}</Hint>}
    </FormModal>
  );
}

/** IN-13: symptoms within about two hours of a meal, linked to that meal. Always shows the urgent-care advice. */
export function ReactionSection() {
  const { deps } = useServices();
  const router = useRouter();
  const f = useForm();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [mealId, setMealId] = useField<string | null>(null, f.touch);
  const [symptoms, setSymptoms] = useField<Set<string>>(new Set(), f.touch);
  const time = useFormTime(f.touch);

  const reload = useCallback(() => {
    deps.repo
      .listRecords('meals')
      .then((m) => setMeals(m.slice(0, 5)))
      .catch((e) => showError(e));
  }, [deps]);
  useFocusEffect(reload);
  const selected = mealId && meals.some((m) => m.id === mealId) ? mealId : (meals[0]?.id ?? null);

  const missing = !selected ? t('edit.meal') : symptoms.size === 0 ? t('edit.symptoms') : null;
  return (
    <FormModal
      dirty={f.dirty}
      missing={missing}
      banner={
        // IN-13: the urgent-care advice is always visible and stays under the header while the form scrolls.
        <View
          style={{
            marginHorizontal: 20,
            marginTop: 4,
            padding: 14,
            borderRadius: 22,
            backgroundColor: color.alertSoft,
            borderWidth: 1,
            borderColor: color.alertLine,
          }}
        >
          <Text style={{ color: color.alert, fontWeight: '600', fontSize: 14.5 }}>{t('more.reactionUrgent')}</Text>
        </View>
      }
      onSave={async () => {
        await logReaction(deps, { mealId: selected!, symptoms: [...symptoms] as Symptom[], at: time.atForSave });
      }}
    >
      {meals.length === 0 ? (
        <>
          <Text style={{ fontSize: 20, fontWeight: '800', letterSpacing: -0.4 }}>{t('more.reactionLogMealFirst')}</Text>
          <Hint>{t('more.reactionNoMeals')}</Hint>
          <Button kind="secondary" title={t('cards.firstMeal')} onPress={() => router.push('/form/meal')} />
        </>
      ) : (
        <>
          <Label>{t('more.reactionMeal')}</Label>
          <Chips
            items={meals.map((m) => ({ id: m.id, label: `${new Date(m.at.utc).toLocaleString()} · ${m.description.slice(0, 30)}` }))}
            selected={new Set(selected ? [selected] : [])}
            onToggle={setMealId}
          />
          <Label>{t('more.reactionSymptoms')}</Label>
          <Chips
            items={SYMPTOMS.map((s) => ({ id: s, label: t(`symptoms.${s}`) }))}
            selected={symptoms}
            onToggle={(id) => setSymptoms(toggled(symptoms, id))}
          />
          <Label>{t('more.reactionOnset')}</Label>
          <TimeField value={time.value} onChange={time.set} />
        </>
      )}
    </FormModal>
  );
}
