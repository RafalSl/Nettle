import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Switch, Text, TextInput, View } from 'react-native';
import { joinIngredients, splitIngredients } from '@/core/model/allergens';
import { ALLERGENS, CHANGE_ACTIONS, CHANGE_CATEGORIES, MEDICATION_CATEGORIES, NAIL_EXTENTS, NAIL_STAGES, SCORE_KEYS, SYMPTOMS } from '@/core/model/types';
import type { Allergen, ListItem, MedicationCategory, RecordKind, SkinArea } from '@/core/model/types';
import {
  editDrink,
  editChangeEvent,
  editCheckIn,
  editFlareMarker,
  editMeal,
  editMedication,
  editNailEntry,
  editReaction,
  editSkinEntry,
  editStool,
  editTreatmentApplication,
  getEntry,
} from '@/core/usecases/entries';
import { LOG_KINDS, type LogRow } from '@/core/usecases/dayLog';
import { areaLabel, itemLabel, t } from '@/i18n';
import { useServices } from '@/services';
import { FormModal, useField, useForm } from '@/ui/FormModal';
import { DrinkFields, draftFromDrink, drinkInput, drinkMissing, type DrinkDraft } from '@/ui/DrinkFields';
import { PhotoStrip } from '@/ui/PhotoStrip';
import { Chips, Hint, Label, OptionalScoreStepper, ScoreStepper, TimeField, styles } from '@/ui/components';

type Rec<K extends LogKind> = Extract<LogRow, { kind: K }>['record'];
type LogKind = (typeof LOG_KINDS)[number];

const one = (id: string | null) => new Set(id ? [id] : []);
const toggled = (set: Set<string>, id: string) => {
  const next = new Set(set);
  if (!next.delete(id)) next.add(id);
  return next;
};

/** Time and note, the two fields every entry has. `at` stays null until the user changes the time, which keeps the original stamp. */
function useCommon(initialNote: string | null, touch: () => void) {
  const [at, setAt] = useField<Date | null>(null, touch);
  const [note, setNote] = useField(initialNote ?? '', touch);
  return { at, setAt, note, setNote };
}
function CommonFields({ c, original }: { c: ReturnType<typeof useCommon>; original: string }) {
  return (
    <>
      <TimeField value={c.at ?? new Date(original)} onChange={c.setAt} />
      <Label>{t('common.note')}</Label>
      <TextInput style={styles.input} accessibilityLabel={t('common.note')} value={c.note} onChangeText={c.setNote} />
    </>
  );
}

function MealFields({ r }: { r: Rec<'meals'> }) {
  const { deps } = useServices();
  const f = useForm();
  const c = useCommon(r.note, f.touch);
  const [description, setDescription] = useField(r.description, f.touch);
  const [ingredients, setIngredients] = useField(joinIngredients(r.ingredients), f.touch);
  const [allergens, setAllergens] = useField<Set<string>>(new Set(r.allergens), f.touch);
  return (
    <FormModal
      dirty={f.dirty}
      missing={description.trim() ? null : t('edit.description')}
      onSave={async () => {
        await editMeal(deps, r.id, {
          description,
          ingredients: splitIngredients(ingredients),
          allergens: [...allergens] as Allergen[],
          note: c.note,
          at: c.at ?? undefined,
        });
      }}>
      <Label>{t('meal.description')}</Label>
      <TextInput style={styles.input} accessibilityLabel={t('meal.description')} value={description} onChangeText={setDescription} />
      <Label>{t('meal.ingredients')}</Label>
      <TextInput style={styles.input} accessibilityLabel={t('meal.ingredients')} value={ingredients} onChangeText={setIngredients} />
      <Hint>{t('edit.ingredientsHint')}</Hint>
      <Label>{t('meal.allergens')}</Label>
      <Chips items={ALLERGENS.map((a) => ({ id: a, label: t(`allergens.${a}`) }))} selected={allergens} onToggle={(id) => setAllergens(toggled(allergens, id))} />
      <CommonFields c={c} original={r.at.utc} />
    </FormModal>
  );
}

function SkinFields({ r, areas }: { r: Rec<'skinEntries'>; areas: SkinArea[] }) {
  const { deps } = useServices();
  const f = useForm();
  const c = useCommon(r.note, f.touch);
  const [areaId, setAreaId] = useField(r.areaId, f.touch);
  const [scores, setScores] = useField({ ...r.scores }, f.touch);
  return (
    <FormModal dirty={f.dirty} missing={null} onSave={async () => void (await editSkinEntry(deps, r.id, { areaId, scores, note: c.note, at: c.at ?? undefined }))}>
      <Chips items={areas.filter((a) => a.kind === 'skin').map((a) => ({ id: a.id, label: areaLabel(a) }))} selected={one(areaId)} onToggle={setAreaId} />
      <Label>{t('edit.scores')}</Label>
      {SCORE_KEYS.map((k) => (
        <ScoreStepper key={k} label={t(`skin.scores.${k}`)} value={scores[k]} onChange={(v) => setScores({ ...scores, [k]: v })} />
      ))}
      <CommonFields c={c} original={r.at.utc} />
      <Label>{t('edit.photos')}</Label>
      <PhotoStrip entryKind="skinEntry" entryId={r.id} />
    </FormModal>
  );
}

function NailFields({ r, areas }: { r: Rec<'nailEntries'>; areas: SkinArea[] }) {
  const { deps } = useServices();
  const f = useForm();
  const c = useCommon(r.note, f.touch);
  const [areaId, setAreaId] = useField(r.areaId, f.touch);
  const [stage, setStage] = useField<string>(r.stage, f.touch);
  const [extent, setExtent] = useField<string>(r.extent, f.touch);
  return (
    <FormModal
      dirty={f.dirty}
      missing={null}
      onSave={async () =>
        void (await editNailEntry(deps, r.id, { areaId, stage: stage as (typeof NAIL_STAGES)[number], extent: extent as (typeof NAIL_EXTENTS)[number], note: c.note, at: c.at ?? undefined }))
      }>
      <Chips items={areas.filter((a) => a.kind === 'nail').map((a) => ({ id: a.id, label: areaLabel(a) }))} selected={one(areaId)} onToggle={setAreaId} />
      <Label>{t('more.nailStage')}</Label>
      <Chips items={NAIL_STAGES.map((s) => ({ id: s, label: t(`nail.stages.${s}`) }))} selected={one(stage)} onToggle={setStage} />
      <Label>{t('more.nailExtent')}</Label>
      <Chips items={NAIL_EXTENTS.map((s) => ({ id: s, label: t(`nail.extents.${s}`) }))} selected={one(extent)} onToggle={setExtent} />
      <CommonFields c={c} original={r.at.utc} />
      <Label>{t('edit.photos')}</Label>
      <PhotoStrip entryKind="nailEntry" entryId={r.id} />
    </FormModal>
  );
}

function CheckInFields({ r, tags }: { r: Rec<'checkIns'>; tags: ListItem[] }) {
  const { deps } = useServices();
  const f = useForm();
  const c = useCommon(r.note, f.touch);
  const [v, setV] = useField({ wellbeing: r.wellbeing, stress: r.stress, sleep: r.sleep, abdominalPain: r.abdominalPain }, f.touch);
  const [bloating, setBloating] = useField(r.bloating, f.touch);
  const [picked, setPicked] = useField<Set<string>>(new Set(r.tags), f.touch);
  return (
    <FormModal dirty={f.dirty} missing={null} onSave={async () => void (await editCheckIn(deps, r.id, { ...v, bloating, tags: [...picked], note: c.note, at: c.at ?? undefined }))}>
      {(['wellbeing', 'stress', 'sleep', 'abdominalPain'] as const).map((k) => (
        <OptionalScoreStepper key={k} label={t(`today.${k}`)} value={v[k]} onChange={(n) => setV({ ...v, [k]: n })} />
      ))}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={styles.rowText}>{t('edit.bloating')}</Text>
        <Switch value={bloating} onValueChange={setBloating} accessibilityLabel={t('edit.bloating')} />
      </View>
      <Chips items={tags.map((x) => ({ id: x.id, label: itemLabel(x) }))} selected={picked} onToggle={(id) => setPicked(toggled(picked, id))} />
      <CommonFields c={c} original={r.at.utc} />
    </FormModal>
  );
}

function StoolFields({ r }: { r: Rec<'stoolEntries'> }) {
  const { deps } = useServices();
  const f = useForm();
  const c = useCommon(r.note, f.touch);
  const [type, setType] = useField(String(r.bristol), f.touch);
  return (
    <FormModal dirty={f.dirty} missing={null} onSave={async () => void (await editStool(deps, r.id, { bristol: Number(type), note: c.note, at: c.at ?? undefined }))}>
      <Chips items={[1, 2, 3, 4, 5, 6, 7].map((n) => ({ id: String(n), label: String(n) }))} selected={one(type)} onToggle={setType} />
      <CommonFields c={c} original={r.at.utc} />
    </FormModal>
  );
}

function TreatmentFields({ r, areas, treatments }: { r: Rec<'treatmentApplications'>; areas: SkinArea[]; treatments: ListItem[] }) {
  const { deps } = useServices();
  const f = useForm();
  const c = useCommon(r.note, f.touch);
  const [treatmentId, setTreatmentId] = useField(r.treatmentId, f.touch);
  const [areaIds, setAreaIds] = useField<Set<string>>(new Set(r.areaIds), f.touch);
  return (
    <FormModal
      dirty={f.dirty}
      missing={areaIds.size === 0 ? t('edit.areas') : null}
      onSave={async () => void (await editTreatmentApplication(deps, r.id, { treatmentId, areaIds: [...areaIds], note: c.note, at: c.at ?? undefined }))}>
      <Chips items={treatments.map((x) => ({ id: x.id, label: itemLabel(x) }))} selected={one(treatmentId)} onToggle={setTreatmentId} />
      <Label>{t('more.treatmentAreas')}</Label>
      <Chips items={areas.map((a) => ({ id: a.id, label: areaLabel(a) }))} selected={areaIds} onToggle={(id) => setAreaIds(toggled(areaIds, id))} />
      <CommonFields c={c} original={r.at.utc} />
    </FormModal>
  );
}

function ChangeFields({ r }: { r: Rec<'changeEvents'> }) {
  const { deps } = useServices();
  const f = useForm();
  const c = useCommon(r.note, f.touch);
  const [action, setAction] = useField<string>(r.action, f.touch);
  const [category, setCategory] = useField<string>(r.category, f.touch);
  const [name, setName] = useField(r.name, f.touch);
  return (
    <FormModal
      dirty={f.dirty}
      missing={name.trim() ? null : t('edit.name')}
      onSave={async () =>
        void (await editChangeEvent(deps, r.id, {
          action: action as (typeof CHANGE_ACTIONS)[number],
          category: category as (typeof CHANGE_CATEGORIES)[number],
          name,
          note: c.note,
          at: c.at ?? undefined,
        }))
      }>
      <Chips items={CHANGE_ACTIONS.map((a) => ({ id: a, label: t(`change.actions.${a}`) }))} selected={one(action)} onToggle={setAction} />
      <Chips items={CHANGE_CATEGORIES.map((a) => ({ id: a, label: t(`change.categories.${a}`) }))} selected={one(category)} onToggle={setCategory} />
      <TextInput style={styles.input} placeholder={t('more.changeName')} value={name} onChangeText={setName} />
      <CommonFields c={c} original={r.at.utc} />
    </FormModal>
  );
}

function ReactionFields({ r }: { r: Rec<'reactions'> }) {
  const { deps } = useServices();
  const f = useForm();
  const c = useCommon(r.note, f.touch);
  const [symptoms, setSymptoms] = useField<Set<string>>(new Set(r.symptoms), f.touch);
  return (
    <FormModal
      dirty={f.dirty}
      missing={symptoms.size === 0 ? t('edit.symptoms') : null}
      onSave={async () => void (await editReaction(deps, r.id, { mealId: r.mealId, symptoms: [...symptoms] as (typeof SYMPTOMS)[number][], note: c.note, at: c.at ?? undefined }))}>
      <Hint>{t('more.reactionUrgent')}</Hint>
      <Chips items={SYMPTOMS.map((s) => ({ id: s, label: t(`symptoms.${s}`) }))} selected={symptoms} onToggle={(id) => setSymptoms(toggled(symptoms, id))} />
      <CommonFields c={c} original={r.at.utc} />
    </FormModal>
  );
}

function DrinkEdit({ r }: { r: Rec<'drinks'> }) {
  const { deps } = useServices();
  const f = useForm();
  const c = useCommon(r.note, f.touch);
  const [draft, setDraft] = useField<DrinkDraft>(draftFromDrink(r), f.touch);
  return (
    <FormModal dirty={f.dirty} missing={drinkMissing(draft)} onSave={async () => void (await editDrink(deps, r.id, { ...drinkInput(draft), note: c.note, at: c.at ?? undefined }))}>
      <DrinkFields draft={draft} onChange={setDraft} />
      <CommonFields c={c} original={r.at.utc} />
    </FormModal>
  );
}

function MedicationFields({ r }: { r: Rec<'medicationEntries'> }) {
  const { deps } = useServices();
  const f = useForm();
  const c = useCommon(r.note, f.touch);
  const [category, setCategory] = useField<string>(r.category, f.touch);
  const [name, setName] = useField(r.name, f.touch);
  const [dose, setDose] = useField(r.dose ?? '', f.touch);
  return (
    <FormModal
      dirty={f.dirty}
      missing={name.trim() ? null : t('edit.name')}
      onSave={async () => void (await editMedication(deps, r.id, { category: category as MedicationCategory, name, dose, note: c.note, at: c.at ?? undefined }))}>
      <Chips
        items={MEDICATION_CATEGORIES.map((k) => ({ id: k, label: t(k === 'medication' ? 'more.medKindMedication' : 'more.medKindSupplement') }))}
        selected={one(category)}
        onToggle={setCategory}
      />
      <TextInput style={styles.input} placeholder={t('more.medName')} value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder={t('more.medDose')} value={dose} onChangeText={setDose} />
      <CommonFields c={c} original={r.at.utc} />
    </FormModal>
  );
}

function FlareFields({ r }: { r: Rec<'flareMarkers'> }) {
  const { deps } = useServices();
  const f = useForm();
  const c = useCommon(r.note, f.touch);
  return (
    <FormModal dirty={f.dirty} missing={null} onSave={async () => void (await editFlareMarker(deps, r.id, { note: c.note, at: c.at ?? undefined }))}>
      <Label>{t(r.kind === 'start' ? 'skin.flareStart' : 'skin.flareEnd')}</Label>
      <CommonFields c={c} original={r.at.utc} />
    </FormModal>
  );
}

/**
 * EN-1: edit one entry of the day's log. The route carries the record kind and id; the form for the kind loads
 * the record and saves through the matching `edit*` use case, which keeps the id and applies the edit rules.
 * Only the fields the entry has are shown, in the unified modal (UX-3).
 */
export default function EditEntryScreen() {
  const { deps } = useServices();
  const { kind, id } = useLocalSearchParams<{ kind: string; id: string }>();
  const [state, setState] = useState<{ row: LogRow; areas: SkinArea[]; treatments: ListItem[]; tags: ListItem[] } | 'missing' | null>(null);

  useEffect(() => {
    (async () => {
      if (!(LOG_KINDS as readonly string[]).includes(kind)) return setState('missing');
      const record = await getEntry(deps, kind as RecordKind, id);
      setState({
        row: { kind, id, at: (record as { at: LogRow['at'] }).at, record } as LogRow,
        areas: await deps.repo.listAreas(),
        treatments: await deps.repo.listItems('treatments'),
        tags: await deps.repo.listItems('dailyTags'),
      });
    })().catch(() => setState('missing'));
  }, [deps, kind, id]);

  if (state === null) return null;
  if (state === 'missing') return <Hint>{t('edit.unavailable')}</Hint>;
  const { row, areas, treatments, tags } = state;
  // Areas and items that are archived stay listed only when the entry already uses them.
  const usable = <T extends { id: string; archived: boolean }>(l: T[], used: string[]) => l.filter((x) => !x.archived || used.includes(x.id));
  switch (row.kind) {
    case 'meals': return <MealFields r={row.record} />;
    case 'skinEntries': return <SkinFields r={row.record} areas={usable(areas, [row.record.areaId])} />;
    case 'nailEntries': return <NailFields r={row.record} areas={usable(areas, [row.record.areaId])} />;
    case 'checkIns': return <CheckInFields r={row.record} tags={usable(tags, row.record.tags)} />;
    case 'stoolEntries': return <StoolFields r={row.record} />;
    case 'treatmentApplications':
      return <TreatmentFields r={row.record} areas={usable(areas, row.record.areaIds)} treatments={usable(treatments, [row.record.treatmentId])} />;
    case 'changeEvents': return <ChangeFields r={row.record} />;
    case 'reactions': return <ReactionFields r={row.record} />;
    case 'drinks': return <DrinkEdit r={row.record} />;
    case 'medicationEntries': return <MedicationFields r={row.record} />;
    case 'flareMarkers': return <FlareFields r={row.record} />;
  }
}
