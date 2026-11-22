import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { Text, TextInput } from '@/ui/themed';
import { medicationHistory, normalizeText, rankSuggestions } from '@/core/model/suggestions';
import { MEDICATION_CATEGORIES, type MedicationCategory } from '@/core/model/types';
import { logMedication } from '@/core/usecases/intake';
import { addRegularMedication } from '@/core/usecases/regular';
import { toggleFavoriteMedication } from '@/core/usecases/preferences';
import { t } from '@/i18n';
import { useServices } from '@/services';
import { FormModal, useField, useForm } from '@/ui/FormModal';
import { useFormTime } from '@/forms/useFormTime';
import { Button, Chips, Label, TimeField, styles } from '@/ui/components';
import { SwitchRow } from '@/ui/SwitchRow';
import { showError } from '@/ui/showError';
import { rowText, useSuggestions } from '@/forms/intakeSuggestions';

/** IN-5: a medication or supplement with an optional dose. */
export default function MedicationForm() {
  const { deps } = useServices();
  const router = useRouter();
  const f = useForm();
  const [category, setCategory] = useField<MedicationCategory>('medication', f.touch);
  const [name, setName] = useField('', f.touch);
  const [dose, setDose] = useField('', f.touch);
  const [regular, setRegular] = useField(false, f.touch);
  const time = useFormTime(f.touch);
  type Med = { category: MedicationCategory; name: string; dose: string | null };
  const { list, saveOnTap, prefs, refresh } = useSuggestions<Med>(async (d, p) => {
    const options = { rows: p.suggestions.rows, windowDays: p.suggestions.windowDays };
    return rankSuggestions(
      medicationHistory(await d.repo.listRecords('medicationEntries')).map((h) => ({
        ...h,
        payload: { category: h.payload.category, name: h.payload.name, dose: h.payload.dose },
      })),
      p.favorites.medications.map((x) => ({
        key: x.key,
        label: x.dose ? `${x.name} ${x.dose}` : x.name,
        payload: { category: x.category, name: x.name, dose: x.dose },
      })),
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
      showError(e);
    }
  }

  return (
    <FormModal
      dirty={f.dirty}
      missing={name.trim() ? null : t('edit.name')}
      onSave={async () => {
        await logMedication(deps, { category, name, dose, at: time.atForSave });
        if (regular) await addRegularMedication(deps, { category, name, dose }); // IN-17
      }}
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
      <Chips
        items={MEDICATION_CATEGORIES.map((k) => ({
          id: k,
          label: t(k === 'medication' ? 'more.medKindMedication' : 'more.medKindSupplement'),
        }))}
        selected={new Set([category])}
        onToggle={(id) => setCategory(id as MedicationCategory)}
      />
      <TextInput
        style={styles.input}
        accessibilityLabel={t('more.medName')}
        placeholder={t('more.medName')}
        value={name}
        onChangeText={setName}
      />
      <TextInput
        style={styles.input}
        accessibilityLabel={t('more.medDose')}
        placeholder={t('more.medDose')}
        value={dose}
        onChangeText={setDose}
      />
      <Button
        kind="secondary"
        title={
          prefs.favorites.medications.some((x) => x.key === `${category}|${normalizeText(name)}|${normalizeText(dose)}`)
            ? t('meal.unfavorite')
            : t('meal.favorite')
        }
        disabled={!name.trim()}
        onPress={() =>
          toggleFavoriteMedication(deps, { category, name: name.trim(), dose: dose.trim() || null }).then(refresh, (e) => showError(e))
        }
      />
      <SwitchRow title={t('regular.switch')} hint={regular ? t('regular.switchHint') : undefined} value={regular} onChange={setRegular} />
      <TimeField value={time.value} onChange={time.set} />
    </FormModal>
  );
}
