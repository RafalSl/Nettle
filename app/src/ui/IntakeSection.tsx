import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, Text, TextInput } from 'react-native';
import { defaultPreferences, type Preferences } from '@/core/model/preferences';
import { drinkHistory, medicationHistory, rankSuggestions, type Suggestion } from '@/core/model/suggestions';
import { MEDICATION_CATEGORIES, type MedicationCategory } from '@/core/model/types';
import { lookupProduct } from '@/core/usecases/barcode';
import { typedSource } from '@/core/model/source';
import { localDay } from '@/core/model/time';
import { logDrink, logMedication } from '@/core/usecases/intake';
import { getPreferences, type DrinkSnapshot } from '@/core/usecases/preferences';
import { errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { FormModal, useField, useForm } from '@/ui/FormModal';
import { DrinkFields, draftFromDrink, drinkInput, drinkMissing, emptyDrinkDraft, type DrinkDraft } from '@/ui/DrinkFields';
import { useFormTime } from '@/ui/useFormTime';
import { BarcodeScanner } from '@/ui/BarcodeScanner';
import { Button, Chips, Hint, Label, TimeField, styles } from '@/ui/components';

const rowText = (s: Suggestion<unknown>) => `${s.favorite ? '★ ' : ''}${s.label}${s.count >= 2 ? ` ×${s.count}` : ''}`;

/** IN-14, UX-5: suggestions of an intake form. A tap fills the form, or with "save on tap" saves at once and closes. */
function useSuggestions<P>(load: (deps: ReturnType<typeof useServices>['deps'], p: Preferences) => Promise<Suggestion<P>[]>) {
  const { deps } = useServices();
  const [prefs, setPrefs] = useState<Preferences>(defaultPreferences());
  const [list, setList] = useState<Suggestion<P>[]>([]);
  const refresh = useCallback(() => {
    (async () => {
      const p = await getPreferences(deps);
      setPrefs(p);
      setList(await load(deps, p));
    })().catch((e) => Alert.alert(errorMessage(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps]);
  useFocusEffect(refresh);
  return { list, saveOnTap: prefs.suggestions.saveOnTap };
}

/** IN-4, IN-10: a drink with an alcohol switch and optional ingredients and allergen tags. */
export function DrinkSection() {
  const { deps } = useServices();
  const router = useRouter();
  const f = useForm();
  const [draft, setDraft] = useField<DrinkDraft>(emptyDrinkDraft(), f.touch);
  const time = useFormTime(f.touch);
  const { list, saveOnTap } = useSuggestions<DrinkSnapshot>(async (d, p) => {
    const options = { rows: p.suggestions.rows, windowDays: p.suggestions.windowDays };
    const snap = (x: DrinkSnapshot): DrinkSnapshot => ({ name: x.name, amountMl: x.amountMl, alcohol: x.alcohol, ingredients: x.ingredients, allergens: x.allergens, barcode: x.barcode, source: x.source });
    return rankSuggestions(
      drinkHistory(await d.repo.listRecords('drinks')).map((h) => ({ ...h, payload: snap(h.payload) })),
      p.favorites.drinks.map((x) => ({ key: x.key, label: `${x.name} ${x.amountMl} ml`, payload: snap(x) })),
      d.clock.now(),
      options,
    );
  });

  // IN-2: a packaged drink is scanned like a meal; the result only fills this form.
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState('');
  const [looking, setLooking] = useState(false);
  const [scanNote, setScanNote] = useState<string | null>(null);
  async function handleCode(raw: string) {
    setLooking(true);
    try {
      const found = await lookupProduct(deps, raw);
      const fill = () => {
        const h = found.history;
        const p = found.product;
        const base = draftFromDrink({ name: '', amountMl: 0, alcohol: false, ingredients: [], allergens: [], barcode: found.barcode, source: typedSource() });
        if (h) {
          // IN-2: the diary knows this code: its confirmed ingredients and tags (pre-selected) fill the form.
          setDraft({ ...draftFromDrink({ ...h, amountMl: 0, alcohol: false, barcode: found.barcode }), name: h.name, amount: draft.amount, alcohol: draft.alcohol });
          setScanNote(t('meal.scanFromHistory', { date: localDay(h.at, deps.clock.timeZone()) }));
        } else if (p) {
          // IN-16: the database is the source; its tags stay unselected until the user selects them (IN-10).
          setDraft({ ...base, name: p.name, amount: draft.amount, alcohol: draft.alcohol, ingredients: p.ingredients.join(', '), source: { kind: 'open_food_facts', edited: false, llm: null }, filled: { ingredients: p.ingredients, allergens: p.allergens } });
          setScanNote(found.incomplete ? t('meal.scanIncomplete') : t('meal.scanFromDb'));
        } else {
          setDraft({ ...base, name: draft.name, amount: draft.amount, alcohol: draft.alcohol });
          setScanNote(t('meal.scanNotFound'));
        }
        setScanning(false);
      };
      if ((found.product || found.history) && found.inStore) {
        Alert.alert(t('meal.scanInStoreTitle'), t('meal.scanInStoreBody'), [
          { text: t('common.cancel'), style: 'cancel', onPress: () => setScanning(false) },
          { text: t('meal.scanUse'), onPress: fill },
        ]);
      } else fill();
    } catch (e) {
      Alert.alert(errorMessage(e));
      setScanning(false); // IN-8: the source is out of reach, so enter the drink by hand
    } finally {
      setLooking(false);
    }
  }

  // IN-10: a pick comes from the diary's own history, so its tags are shown pre-selected and count as confirmed.
  async function pick(s: DrinkSnapshot) {
    if (!saveOnTap) {
      setDraft(draftFromDrink(s));
      return;
    }
    try {
      await logDrink(deps, { ...s, at: time.atForSave });
      router.back();
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }

  return (
    <FormModal dirty={f.dirty} missing={drinkMissing(draft)} onSave={async () => void (await logDrink(deps, { ...drinkInput(draft), at: time.atForSave }))}>
      {list.length > 0 && <Label>{t('meal.suggestions')}</Label>}
      {list.map((s) => (
        <Pressable key={s.key} accessibilityRole="button" accessibilityLabel={s.label} onPress={() => void pick(s.payload)} style={{ paddingVertical: 8 }}>
          <Text style={styles.rowText}>{rowText(s)}</Text>
        </Pressable>
      ))}
      {scanning ? (
        <>
          <BarcodeScanner onCode={(c) => void handleCode(c)} />
          <Label>{t('meal.scanOrType')}</Label>
          <TextInput style={styles.input} accessibilityLabel={t('meal.scanCode')} placeholder={t('meal.scanCode')} keyboardType="number-pad" value={code} onChangeText={setCode} />
          <Button title={t('meal.scanLookup')} disabled={!code.trim() || looking} onPress={() => void handleCode(code)} />
          {looking && <Hint>{t('meal.scanLooking')}</Hint>}
          <Button kind="secondary" title={t('meal.scanCancel')} onPress={() => setScanning(false)} />
        </>
      ) : (
        <Button kind="secondary" title={t('meal.scan')} onPress={() => setScanning(true)} />
      )}
      {scanNote && <Hint>{scanNote}</Hint>}
      <DrinkFields draft={draft} onChange={setDraft} />
      <TimeField value={time.value} onChange={time.set} />
    </FormModal>
  );
}

/** IN-5: a medication or supplement with an optional dose. */
export function MedicationSection() {
  const { deps } = useServices();
  const router = useRouter();
  const f = useForm();
  const [category, setCategory] = useField<MedicationCategory>('medication', f.touch);
  const [name, setName] = useField('', f.touch);
  const [dose, setDose] = useField('', f.touch);
  const time = useFormTime(f.touch);
  type Med = { category: MedicationCategory; name: string; dose: string | null };
  const { list, saveOnTap } = useSuggestions<Med>(async (d, p) => {
    const options = { rows: p.suggestions.rows, windowDays: p.suggestions.windowDays };
    return rankSuggestions(
      medicationHistory(await d.repo.listRecords('medicationEntries')).map((h) => ({ ...h, payload: { category: h.payload.category, name: h.payload.name, dose: h.payload.dose } })),
      p.favorites.medications.map((x) => ({ key: x.key, label: x.dose ? `${x.name} ${x.dose}` : x.name, payload: { category: x.category, name: x.name, dose: x.dose } })),
      d.clock.now(),
      options,
    );
  });

  async function pick(s: Med) {
    if (!saveOnTap) {
      setCategory(s.category);
      setName(s.name);
      setDose(s.dose ?? '');
      return;
    }
    try {
      await logMedication(deps, { category: s.category, name: s.name, dose: s.dose ?? undefined, at: time.atForSave });
      router.back();
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }

  return (
    <FormModal
      dirty={f.dirty}
      missing={name.trim() ? null : t('edit.name')}
      onSave={async () => void (await logMedication(deps, { category, name, dose, at: time.atForSave }))}>
      {list.length > 0 && <Label>{t('meal.suggestions')}</Label>}
      {list.map((s) => (
        <Pressable key={s.key} accessibilityRole="button" accessibilityLabel={s.label} onPress={() => void pick(s.payload)} style={{ paddingVertical: 8 }}>
          <Text style={styles.rowText}>{rowText(s)}</Text>
        </Pressable>
      ))}
      <Chips
        items={MEDICATION_CATEGORIES.map((k) => ({ id: k, label: t(k === 'medication' ? 'more.medKindMedication' : 'more.medKindSupplement') }))}
        selected={new Set([category])}
        onToggle={(id) => setCategory(id as MedicationCategory)}
      />
      <TextInput style={styles.input} accessibilityLabel={t('more.medName')} placeholder={t('more.medName')} value={name} onChangeText={setName} />
      <TextInput style={styles.input} accessibilityLabel={t('more.medDose')} placeholder={t('more.medDose')} value={dose} onChangeText={setDose} />
      <TimeField value={time.value} onChange={time.set} />
    </FormModal>
  );
}
