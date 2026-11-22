import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable } from 'react-native';
import { Text, TextInput } from '@/ui/themed';
import { drinkHistory, drinkKey, rankSuggestions } from '@/core/model/suggestions';
import { type Allergen } from '@/core/model/types';
import { lookupProduct } from '@/core/usecases/barcode';
import { addIngredients, joinIngredients, splitIngredients } from '@/core/model/allergens';
import { typedSource } from '@/core/model/source';
import { localDay } from '@/core/model/time';
import { ingredientNameHistory } from '@/core/usecases/llm';
import { logDrink } from '@/core/usecases/intake';
import { toggleFavoriteDrink, type DrinkSnapshot } from '@/core/usecases/preferences';
import { t } from '@/i18n';
import { useServices } from '@/services';
import { FormModal, useField, useForm } from '@/ui/FormModal';
import { DrinkFields, draftFromDrink, drinkInput, drinkMissing, emptyDrinkDraft, type DrinkDraft } from '@/forms/drink/DrinkFields';
import { useFormTime } from '@/forms/useFormTime';
import { BarcodeScanner } from '@/ui/BarcodeScanner';
import { AllergenAiControls, useAllergenAi } from '@/ui/useAllergenAi';
import { IngredientRunPanel, SOURCE_OF, useIngredientRun, type Run } from '@/ui/useIngredientRun';
import { Button, Hint, Label, TimeField, styles } from '@/ui/components';
import { showError } from '@/ui/showError';
import { rowText, useSuggestions } from '@/forms/intakeSuggestions';
import { useFocusLoad } from '@/ui/useFocusLoad';

/** IN-4, IN-10: a drink with an alcohol switch and optional ingredients and allergen tags. */
export default function DrinkForm() {
  const { deps } = useServices();
  const router = useRouter();
  const f = useForm();
  const [draft, setDraft] = useField<DrinkDraft>(emptyDrinkDraft(), f.touch);
  const time = useFormTime(f.touch);
  const { list, saveOnTap, prefs, refresh } = useSuggestions<DrinkSnapshot>(async (d, p) => {
    const options = { rows: p.suggestions.rows, windowDays: p.suggestions.windowDays };
    const snap = (x: DrinkSnapshot): DrinkSnapshot => ({
      name: x.name,
      amountMl: x.amountMl,
      alcohol: x.alcohol,
      ingredients: x.ingredients,
      allergens: x.allergens,
      barcode: x.barcode,
      source: x.source,
    });
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
        const base = draftFromDrink({
          name: '',
          amountMl: 0,
          alcohol: false,
          ingredients: [],
          allergens: [],
          barcode: found.barcode,
          source: typedSource(),
        });
        if (h) {
          // IN-2: the diary knows this code: its confirmed ingredients and tags (pre-selected) fill the form.
          setDraft({
            ...draftFromDrink({ ...h, amountMl: 0, alcohol: false, barcode: found.barcode }),
            name: h.name,
            amount: draft.amount,
            alcohol: draft.alcohol,
          });
          setScanNote(t('meal.scanFromHistory', { date: localDay(h.at, deps.clock.timeZone(), deps.dayStart.get()) }));
        } else if (p) {
          // IN-16: the database is the source; its tags stay unselected until the user selects them (IN-10).
          setDraft({
            ...base,
            name: p.name,
            amount: draft.amount,
            alcohol: draft.alcohol,
            ingredients: joinIngredients(p.ingredients),
            source: { kind: 'open_food_facts', edited: false, llm: null, aiTags: false },
            filled: { ingredients: p.ingredients, allergens: p.allergens },
          });
          setScanNote(found.incomplete ? t('meal.scanIncomplete') : p.translated ? t('meal.scanFromDbTranslated') : t('meal.scanFromDb'));
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
      showError(e);
      setScanning(false); // IN-8: the source is out of reach, so enter the drink by hand
    } finally {
      setLooking(false);
    }
  }

  // IN-3, IN-15: a label scan or photo estimate adds names to the list; its tags stay unselected (IN-10).
  const run = useIngredientRun();
  const [names, setNames] = useState<string[]>([]);
  useFocusLoad(
    () => ingredientNameHistory(deps),
    [deps],
    setNames,
    () => undefined,
  );
  const [pendingTags, setPendingTags] = useState<Allergen[]>([]);
  const [pendingHint, setPendingHint] = useState('meal.labelTagsHint');
  const [pendingAi, setPendingAi] = useState(false);
  const allergenAi = useAllergenAi((tags, note) => {
    setPendingTags(tags);
    setPendingHint('meal.aiAllergensHint');
    setPendingAi(true);
    setScanNote([tags.length === 0 ? t('meal.aiAllergensNone') : '', note ?? ''].filter(Boolean).join(' ') || null);
  });
  function addRun(names: string[], r: Extract<Run, { status: 'ready' }>) {
    const current = splitIngredients(draft.ingredients);
    const merged = addIngredients(current, names).filter(Boolean);
    const tags = r.label ? [...new Set([...r.label.allergens, ...r.label.traces])] : [];
    const typed = draft.source.kind === 'typed';
    setDraft({
      ...draft,
      ingredients: joinIngredients(merged),
      ...(typed
        ? {
            source: { kind: SOURCE_OF[r.kind], edited: false, llm: r.provenance, aiTags: false },
            filled: { ingredients: merged, allergens: r.label ? tags : [...draft.allergens] },
          }
        : {}),
    });
    setPendingTags(tags);
    setPendingHint('meal.labelTagsHint');
    setPendingAi(true); // label tags are AI-read
    run.dismiss();
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
      showError(e);
    }
  }

  return (
    <FormModal
      dirty={f.dirty}
      missing={drinkMissing(draft)}
      onSave={async () => void (await logDrink(deps, { ...drinkInput(draft), at: time.atForSave }))}
    >
      {list.length > 0 && <Label>{t('meal.suggestions')}</Label>}
      {list.map((s) => (
        <Pressable
          key={s.key}
          accessibilityRole="button"
          accessibilityLabel={s.label}
          onPress={() => void pick(s.payload)}
          style={{ paddingVertical: 8 }}
        >
          <Text style={styles.rowText}>{rowText(s)}</Text>
        </Pressable>
      ))}
      {scanning ? (
        <>
          <BarcodeScanner onCode={(c) => void handleCode(c)} />
          <Label>{t('meal.scanOrType')}</Label>
          <TextInput
            style={styles.input}
            accessibilityLabel={t('meal.scanCode')}
            placeholder={t('meal.scanCode')}
            keyboardType="number-pad"
            value={code}
            onChangeText={setCode}
          />
          <Button title={t('meal.scanLookup')} disabled={!code.trim() || looking} onPress={() => void handleCode(code)} />
          {looking && <Hint>{t('meal.scanLooking')}</Hint>}
          <Button kind="secondary" title={t('meal.scanCancel')} onPress={() => setScanning(false)} />
        </>
      ) : (
        <Button kind="secondary" title={t('meal.scan')} onPress={() => setScanning(true)} />
      )}
      <Button kind="secondary" title={t('meal.fromLabel')} onPress={() => run.start('label')} />
      {draft.name.trim() !== '' && <Button kind="secondary" title={t('meal.fromName')} onPress={() => void run.startName(draft.name)} />}
      <IngredientRunPanel hook={run} onAdd={addRun} />
      {scanNote && <Hint>{scanNote}</Hint>}
      {pendingTags.length > 0 && draft.allergens.size < pendingTags.length && (
        <>
          <Hint>{t(pendingHint, { list: pendingTags.map((a) => t(`allergens.${a}`)).join(', ') })}</Hint>
          <Button
            kind="secondary"
            title={t('meal.scanSelectTags')}
            onPress={() =>
              setDraft({
                ...draft,
                allergens: new Set([...draft.allergens, ...pendingTags]),
                ...(pendingAi ? { source: { ...draft.source, aiTags: true } } : {}),
              })
            }
          />
        </>
      )}
      <DrinkFields draft={draft} onChange={setDraft} names={names} />
      <AllergenAiControls hook={allergenAi} ingredients={splitIngredients(draft.ingredients)} />
      {/* IN-14: a star keeps a snapshot of the drink (amount, alcohol switch, ingredients, tags) as a favorite. */}
      <Button
        kind="secondary"
        title={
          prefs.favorites.drinks.some((x) => x.key === drinkKey({ name: draft.name.trim(), amountMl: Number(draft.amount) }))
            ? t('meal.unfavorite')
            : t('meal.favorite')
        }
        disabled={!draft.name.trim() || !(Number(draft.amount) > 0)}
        onPress={() => {
          const { name, amountMl, alcohol, ingredients, allergens, barcode, source } = drinkInput(draft);
          toggleFavoriteDrink(deps, { name: name.trim(), amountMl, alcohol, ingredients, allergens, barcode, source }).then(refresh, (e) =>
            showError(e),
          );
        }}
      />
      <TimeField value={time.value} onChange={time.set} />
    </FormModal>
  );
}
