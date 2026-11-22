import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/ui/themed';
import { type Meal, type Symptom } from '@/core/model/types';
import { logReaction } from '@/core/usecases/events';
import { t } from '@/i18n';
import { useServices } from '@/services';
import { FormModal, useField, useForm } from '@/ui/FormModal';
import { useFormTime } from '@/forms/useFormTime';
import { Button, Chips, Hint, Label, TimeField } from '@/ui/components';
import { color } from '@/ui/theme';
import { SymptomChips } from '@/forms/reaction/SymptomChips';
import { useFocusLoad } from '@/ui/useFocusLoad';

/** IN-13: symptoms within about two hours of a meal, linked to that meal. Always shows the urgent-care advice. */
export default function ReactionForm() {
  const { deps } = useServices();
  const router = useRouter();
  const f = useForm();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [mealId, setMealId] = useField<string | null>(null, f.touch);
  const [symptoms, setSymptoms] = useField<Set<Symptom>>(new Set(), f.touch);
  const time = useFormTime(f.touch);

  useFocusLoad(
    () => deps.repo.listRecords('meals'),
    [deps],
    (m) => setMeals(m.slice(0, 5)),
  );
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
        await logReaction(deps, { mealId: selected!, symptoms: [...symptoms], at: time.atForSave });
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
          <SymptomChips selected={symptoms} onChange={setSymptoms} />
          <Label>{t('more.reactionOnset')}</Label>
          <TimeField value={time.value} onChange={time.set} />
        </>
      )}
    </FormModal>
  );
}
