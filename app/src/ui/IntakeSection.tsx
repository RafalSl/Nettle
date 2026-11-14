import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { defaultPreferences, type Preferences } from '@/core/model/preferences';
import { alcoholHistory, medicationHistory, rankSuggestions, type Suggestion } from '@/core/model/suggestions';
import type { MedicationCategory } from '@/core/model/types';
import { getPreferences } from '@/core/usecases/preferences';
import { logAlcohol, logMedication } from '@/core/usecases/intake';
import { errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { Button, Chips, Heading, Label, TimeField, styles } from '@/ui/components';

/** IN-4 alcohol and IN-5 medications and supplements: short forms, time editable. */
export function IntakeSection() {
  const { deps } = useServices();
  const [drink, setDrink] = useState('');
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [category, setCategory] = useState<MedicationCategory>('medication');
  const [at, setAt] = useState<Date | null>(null);
  const [prefs, setPrefs] = useState<Preferences>(defaultPreferences());
  const [drinks, setDrinks] = useState<Suggestion<{ drink: string; amountMl: number }>[]>([]);
  const [meds, setMeds] = useState<Suggestion<{ category: MedicationCategory; name: string; dose: string | null }>[]>([]);

  // IN-14: suggestions come from the diary's own history; favorites first. The form stays below for anything new.
  const load = useCallback(() => {
    (async () => {
      const p = await getPreferences(deps);
      setPrefs(p);
      const options = { rows: p.suggestions.rows, windowDays: p.suggestions.windowDays };
      const now = deps.clock.now();
      setDrinks(
        rankSuggestions(
          alcoholHistory(await deps.repo.listRecords('alcoholEntries')).map((h) => ({ ...h, payload: { drink: h.payload.drink, amountMl: h.payload.amountMl } })),
          p.favorites.alcohol.map((f) => ({ key: f.key, label: `${f.drink} ${f.amountMl} ml`, payload: { drink: f.drink, amountMl: f.amountMl } })),
          now,
          options,
        ),
      );
      setMeds(
        rankSuggestions(
          medicationHistory(await deps.repo.listRecords('medicationEntries')).map((h) => ({ ...h, payload: { category: h.payload.category, name: h.payload.name, dose: h.payload.dose } })),
          p.favorites.medications.map((f) => ({ key: f.key, label: f.dose ? `${f.name} ${f.dose}` : f.name, payload: { category: f.category, name: f.name, dose: f.dose } })),
          now,
          options,
        ),
      );
    })().catch((e) => Alert.alert(errorMessage(e)));
  }, [deps]);
  useFocusEffect(load);

  /** UX-5: with "save on tap" a suggestion saves at once, at the current time; otherwise it fills the form below. */
  async function pickDrink(s: { drink: string; amountMl: number }) {
    if (!prefs.suggestions.saveOnTap) {
      setDrink(s.drink);
      setAmount(String(s.amountMl));
      return;
    }
    try {
      await logAlcohol(deps, { drink: s.drink, amountMl: s.amountMl });
      Alert.alert(t('more.logged'));
      load();
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }
  async function pickMedication(s: { category: MedicationCategory; name: string; dose: string | null }) {
    if (!prefs.suggestions.saveOnTap) {
      setCategory(s.category);
      setName(s.name);
      setDose(s.dose ?? '');
      return;
    }
    try {
      await logMedication(deps, { category: s.category, name: s.name, dose: s.dose ?? undefined });
      Alert.alert(t('more.logged'));
      load();
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }

  async function saveAlcohol() {
    try {
      await logAlcohol(deps, { drink, amountMl: Number(amount), at: at ?? undefined });
      setDrink('');
      setAmount('');
      setAt(null);
      Alert.alert(t('more.logged'));
      load();
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }

  async function saveMedication() {
    try {
      await logMedication(deps, { category, name, dose, at: at ?? undefined });
      setName('');
      setDose('');
      setAt(null);
      Alert.alert(t('more.logged'));
      load();
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }

  return (
    <>
      <TimeField value={at ?? new Date()} onChange={setAt} />
      <Heading>{t('more.alcoholTitle')}</Heading>
      {drinks.length > 0 && <Label>{t('meal.suggestions')}</Label>}
      {drinks.map((s) => (
        <Pressable key={s.key} accessibilityRole="button" accessibilityLabel={s.label} onPress={() => void pickDrink(s.payload)} style={{ paddingVertical: 8 }}>
          <Text style={styles.rowText}>{`${s.favorite ? '★ ' : ''}${s.label}${s.count >= 2 ? ` ×${s.count}` : ''}`}</Text>
        </Pressable>
      ))}
      <TextInput style={styles.input} placeholder={t('more.alcoholDrink')} value={drink} onChangeText={setDrink} />
      <TextInput style={styles.input} placeholder={t('more.alcoholAmount')} keyboardType="number-pad" value={amount} onChangeText={setAmount} />
      <Button title={t('more.alcoholSave')} onPress={saveAlcohol} />

      <Heading>{t('more.medTitle')}</Heading>
      {meds.length > 0 && <Label>{t('meal.suggestions')}</Label>}
      {meds.map((s) => (
        <Pressable key={s.key} accessibilityRole="button" accessibilityLabel={s.label} onPress={() => void pickMedication(s.payload)} style={{ paddingVertical: 8 }}>
          <Text style={styles.rowText}>{`${s.favorite ? '★ ' : ''}${s.label}${s.count >= 2 ? ` ×${s.count}` : ''}`}</Text>
        </Pressable>
      ))}
      <Chips
        items={[
          { id: 'medication', label: t('more.medKindMedication') },
          { id: 'supplement', label: t('more.medKindSupplement') },
        ]}
        selected={new Set([category])}
        onToggle={(id) => setCategory(id as MedicationCategory)}
      />
      <View style={{ gap: 8 }}>
        <TextInput style={styles.input} placeholder={t('more.medName')} value={name} onChangeText={setName} />
        <TextInput style={styles.input} placeholder={t('more.medDose')} value={dose} onChangeText={setDose} />
      </View>
      <Button title={t('more.medSave')} onPress={saveMedication} />
    </>
  );
}
