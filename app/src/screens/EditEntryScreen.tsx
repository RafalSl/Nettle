import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { TextInput } from '@/ui/themed';
import { addIngredients, joinIngredients, splitIngredients } from '@/core/model/allergens';
import { completeSuggestion } from '@/core/usecases/aiPack';
import {
  ALLERGENS,
  CHANGE_ACTIONS,
  MEDICATION_CATEGORIES,
  NAIL_EXTENTS,
  NAIL_STAGES,
  SCORE_KEYS,
  SYMPTOMS,
  TREATMENT_REACTIONS,
} from '@/core/model/types';
import type {
  Allergen,
  ListItem,
  LocalDay,
  MedicalKind,
  MedicationCategory,
  RecordKind,
  SkinArea,
  TreatmentReaction,
} from '@/core/model/types';
import {
  editDrink,
  editChangeEvent,
  editMedicalEvent,
  editCheckIn,
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
import { FillLaterSwitch } from '@/ui/FillLaterSwitch';
import { PhotoStrip } from '@/ui/PhotoStrip';
import { SuggestionPanel } from '@/ui/SuggestionPanel';
import { rescheduleReminders } from '@/ui/rescheduleReminders';
import { MedicalFields } from '@/ui/MedicalFields';
import { parseSizeText, sizeToSave, SkinExtraFields } from '@/ui/SkinExtraFields';
import { DailyHealthFields, type DailyValues } from '@/ui/DailyHealthFields';
import { Chips, Hint, Label, ScoreInput, Segmented, TimeField, styles } from '@/ui/components';
import { SwitchRow } from '@/ui/SwitchRow';
import { toggled, one } from '@/ui/sets';

type Rec<K extends LogKind> = Extract<LogRow, { kind: K }>['record'];
type LogKind = (typeof LOG_KINDS)[number];

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

const sameList = (a: readonly string[], b: readonly string[]) => {
  // addIngredients ends the list with an empty slot for the next name; it is not content.
  const x = a.filter(Boolean);
  const y = b.filter(Boolean);
  return x.length === y.length && x.every((v, i) => v === y[i]);
};

/**
 * IN-20: the state of one suggestion that is being applied in an edit form. Adding names makes them ordinary rows;
 * the list as just filled is kept, so a later change marks the entry edited (IN-16). Nothing is stored until Save.
 */
function useSuggestionState(suggestionId: string | null) {
  const [open, setOpen] = useState(suggestionId !== null);
  const [baseline, setBaseline] = useState<string[] | null>(null);
  const [aiTags, setAiTags] = useState(false);
  return { open, setOpen, baseline, setBaseline, aiTags, setAiTags };
}

function MealFields({ r, suggestionId }: { r: Rec<'meals'>; suggestionId: string | null }) {
  const { deps } = useServices();
  const f = useForm();
  const c = useCommon(r.note, f.touch);
  const [description, setDescription] = useField(r.description, f.touch);
  const [ingredients, setIngredients] = useField(joinIngredients(r.ingredients), f.touch);
  const [allergens, setAllergens] = useField<Set<string>>(new Set(r.allergens), f.touch);
  const [fillLater, setFillLater] = useField(r.fillLater === true, f.touch);
  const sug = useSuggestionState(suggestionId);
  return (
    <FormModal
      dirty={f.dirty}
      missing={description.trim() ? null : t('edit.description')}
      onSave={async () => {
        await editMeal(deps, r.id, {
          description,
          ingredients: splitIngredients(ingredients),
          allergens: [...allergens] as Allergen[],
          fillLater,
          note: c.note,
          at: c.at ?? undefined,
        });
        // IN-20: names were added from a suggestion: the mark clears and the source reads name estimate (manual).
        if (suggestionId && sug.baseline)
          await completeSuggestion(deps, suggestionId, {
            edited: !sameList(sug.baseline, splitIngredients(ingredients)),
            aiTags: sug.aiTags,
          });
      }}
    >
      <Label>{t('meal.description')}</Label>
      <TextInput style={styles.input} accessibilityLabel={t('meal.description')} value={description} onChangeText={setDescription} />
      {suggestionId && sug.open && (
        <SuggestionPanel
          suggestionId={suggestionId}
          onAdd={(names) => {
            const next = addIngredients(splitIngredients(ingredients), names);
            setIngredients(joinIngredients(next));
            sug.setBaseline(next);
          }}
          onSelectTags={(tags) => {
            setAllergens(new Set([...allergens, ...tags]));
            sug.setAiTags(true);
          }}
          onDismissed={() => sug.setOpen(false)}
        />
      )}
      <Label>{t('meal.ingredients')}</Label>
      <TextInput style={styles.input} accessibilityLabel={t('meal.ingredients')} value={ingredients} onChangeText={setIngredients} />
      <Hint>{t('edit.ingredientsHint')}</Hint>
      <Label>{t('meal.allergens')}</Label>
      <Chips
        items={ALLERGENS.map((a) => ({ id: a, label: t(`allergens.${a}`) }))}
        selected={allergens}
        onToggle={(id) => setAllergens(toggled(allergens, id))}
      />
      <FillLaterSwitch value={fillLater} onChange={setFillLater} />
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
  const [cracks, setCracks] = useField(r.cracks, f.touch);
  const [sizeText, setSizeText] = useField(r.sizeMm === null ? '' : String(r.sizeMm), f.touch);
  const [detailsOpen, setDetailsOpen] = useState(r.sizeMm !== null);
  const size = parseSizeText(sizeText);
  return (
    <FormModal
      dirty={f.dirty}
      missing={size.ok ? null : t('skin.sizeMissing')}
      onSave={async () =>
        void (await editSkinEntry(deps, r.id, {
          areaId,
          scores,
          cracks,
          sizeMm: sizeToSave(sizeText),
          note: c.note,
          at: c.at ?? undefined,
        }))
      }
    >
      <Chips
        items={areas.filter((a) => a.kind === 'skin').map((a) => ({ id: a.id, label: areaLabel(a) }))}
        selected={one(areaId)}
        onToggle={setAreaId}
      />
      <Label>{t('edit.scores')}</Label>
      {SCORE_KEYS.map((k) => (
        <ScoreInput key={k} label={t(`skin.scores.${k}`)} value={scores[k]} onChange={(v) => setScores({ ...scores, [k]: v })} />
      ))}
      <SkinExtraFields
        cracks={cracks}
        onCracks={setCracks}
        sizeText={sizeText}
        onSizeText={setSizeText}
        open={detailsOpen}
        onToggleOpen={() => setDetailsOpen((o) => !o)}
      />
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
        void (await editNailEntry(deps, r.id, {
          areaId,
          stage: stage as (typeof NAIL_STAGES)[number],
          extent: extent as (typeof NAIL_EXTENTS)[number],
          note: c.note,
          at: c.at ?? undefined,
        }))
      }
    >
      <Chips
        items={areas.filter((a) => a.kind === 'nail').map((a) => ({ id: a.id, label: areaLabel(a) }))}
        selected={one(areaId)}
        onToggle={setAreaId}
      />
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

function CheckInFields({ r, items }: { r: Rec<'checkIns'>; items: ListItem[] }) {
  const { deps } = useServices();
  const f = useForm();
  const c = useCommon(r.note, f.touch);
  const [values, setValues] = useField<DailyValues>({ ...r.values }, f.touch);
  return (
    <FormModal
      dirty={f.dirty}
      missing={null}
      onSave={async () => {
        await editCheckIn(deps, r.id, { values, note: c.note, at: c.at ?? undefined });
        await rescheduleReminders(deps); // SK-9: a record moved to another day changes which day is skipped
      }}
    >
      <DailyHealthFields items={items} values={values} onChange={setValues} />
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
    <FormModal
      dirty={f.dirty}
      missing={null}
      onSave={async () => void (await editStool(deps, r.id, { bristol: Number(type), note: c.note, at: c.at ?? undefined }))}
    >
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
  const [reaction, setReaction] = useField<TreatmentReaction | null>(r.reaction, f.touch);
  return (
    <FormModal
      dirty={f.dirty}
      missing={areaIds.size === 0 ? t('edit.areas') : null}
      onSave={async () =>
        void (await editTreatmentApplication(deps, r.id, {
          treatmentId,
          areaIds: [...areaIds],
          reaction,
          note: c.note,
          at: c.at ?? undefined,
        }))
      }
    >
      <Chips items={treatments.map((x) => ({ id: x.id, label: itemLabel(x) }))} selected={one(treatmentId)} onToggle={setTreatmentId} />
      <Label>{t('more.treatmentAreas')}</Label>
      <Chips
        items={areas.map((a) => ({ id: a.id, label: areaLabel(a) }))}
        selected={areaIds}
        onToggle={(id) => setAreaIds(toggled(areaIds, id))}
      />
      {/* IN-11: what the skin did after applying; a tap on the chosen one clears it, because empty means not recorded. */}
      <Label>{t('treatmentReaction.title')}</Label>
      <Segmented
        items={TREATMENT_REACTIONS.map((x) => ({ id: x, label: t(`treatmentReaction.${x}`) }))}
        value={reaction ?? ''}
        onChange={(id) => setReaction(id === reaction ? null : (id as TreatmentReaction))}
      />
      <Hint>{t('treatmentReaction.hint')}</Hint>
      <CommonFields c={c} original={r.at.utc} />
    </FormModal>
  );
}

function MedicalEditFields({ r }: { r: Rec<'medicalEvents'> }) {
  const { deps } = useServices();
  const f = useForm();
  const c = useCommon(r.note, f.touch);
  const [kind, setKind] = useField<MedicalKind>(r.kind, f.touch);
  const [title, setTitle] = useField(r.title, f.touch);
  const [endDay, setEndDay] = useField<LocalDay | null>(r.endDay, f.touch);
  return (
    <FormModal
      dirty={f.dirty}
      missing={title.trim() ? null : t('edit.titleMissing')}
      onSave={async () =>
        void (await editMedicalEvent(deps, r.id, {
          kind,
          title,
          ...(kind === 'illness' ? { endDay } : {}),
          note: c.note,
          at: c.at ?? undefined,
        }))
      }
    >
      <MedicalFields kind={kind} onKind={setKind} title={title} onTitle={setTitle} endDay={endDay} onEndDay={setEndDay} />
      <CommonFields c={c} original={r.at.utc} />
    </FormModal>
  );
}

function ChangeFields({ r, categories }: { r: Rec<'changeEvents'>; categories: ListItem[] }) {
  const { deps } = useServices();
  const f = useForm();
  const c = useCommon(r.note, f.touch);
  const [action, setAction] = useField<string>(r.action, f.touch);
  const [category, setCategory] = useField<string>(r.category, f.touch);
  const [name, setName] = useField(r.name, f.touch);
  const [unknown, setUnknown] = useField(r.dateUnknown, f.touch);
  return (
    <FormModal
      dirty={f.dirty}
      missing={name.trim() ? null : t('edit.name')}
      onSave={async () =>
        void (await editChangeEvent(deps, r.id, {
          action: action as (typeof CHANGE_ACTIONS)[number],
          category,
          name,
          dateUnknown: unknown && action === 'started',
          note: c.note,
          at: c.at ?? undefined,
        }))
      }
    >
      <Chips items={CHANGE_ACTIONS.map((a) => ({ id: a, label: t(`change.actions.${a}`) }))} selected={one(action)} onToggle={setAction} />
      <Chips items={categories.map((a) => ({ id: a.id, label: itemLabel(a) }))} selected={one(category)} onToggle={setCategory} />
      <TextInput style={styles.input} placeholder={t('more.changeName')} value={name} onChangeText={setName} />
      {action === 'started' && <SwitchRow title={t('change.dateUnknown')} value={unknown} onChange={setUnknown} />}
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
      onSave={async () =>
        void (await editReaction(deps, r.id, {
          mealId: r.mealId,
          symptoms: [...symptoms] as (typeof SYMPTOMS)[number][],
          note: c.note,
          at: c.at ?? undefined,
        }))
      }
    >
      <Hint>{t('more.reactionUrgent')}</Hint>
      <Chips
        items={SYMPTOMS.map((s) => ({ id: s, label: t(`symptoms.${s}`) }))}
        selected={symptoms}
        onToggle={(id) => setSymptoms(toggled(symptoms, id))}
      />
      <CommonFields c={c} original={r.at.utc} />
    </FormModal>
  );
}

function DrinkEdit({ r, suggestionId }: { r: Rec<'drinks'>; suggestionId: string | null }) {
  const { deps } = useServices();
  const f = useForm();
  const c = useCommon(r.note, f.touch);
  const [draft, setDraft] = useField<DrinkDraft>(draftFromDrink(r), f.touch);
  const sug = useSuggestionState(suggestionId);
  return (
    <FormModal
      dirty={f.dirty}
      missing={drinkMissing(draft)}
      onSave={async () => {
        await editDrink(deps, r.id, { ...drinkInput(draft), note: c.note, at: c.at ?? undefined });
        if (suggestionId && sug.baseline)
          await completeSuggestion(deps, suggestionId, {
            edited: !sameList(sug.baseline, splitIngredients(draft.ingredients)),
            aiTags: sug.aiTags,
          });
      }}
    >
      {suggestionId && sug.open && (
        <SuggestionPanel
          suggestionId={suggestionId}
          onAdd={(names) => {
            const next = addIngredients(splitIngredients(draft.ingredients), names);
            setDraft({ ...draft, ingredients: joinIngredients(next) });
            sug.setBaseline(next);
          }}
          onSelectTags={(tags) => {
            setDraft({ ...draft, allergens: new Set([...draft.allergens, ...tags]) });
            sug.setAiTags(true);
          }}
          onDismissed={() => sug.setOpen(false)}
        />
      )}
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
      onSave={async () =>
        void (await editMedication(deps, r.id, {
          category: category as MedicationCategory,
          name,
          dose,
          note: c.note,
          at: c.at ?? undefined,
        }))
      }
    >
      <Chips
        items={MEDICATION_CATEGORIES.map((k) => ({
          id: k,
          label: t(k === 'medication' ? 'more.medKindMedication' : 'more.medKindSupplement'),
        }))}
        selected={one(category)}
        onToggle={setCategory}
      />
      <TextInput style={styles.input} placeholder={t('more.medName')} value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder={t('more.medDose')} value={dose} onChangeText={setDose} />
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
  const { kind, id, suggestion } = useLocalSearchParams<{ kind: string; id: string; suggestion?: string }>();
  const suggestionId = typeof suggestion === 'string' && suggestion ? suggestion : null; // IN-20: opened from "Suggestions to review"
  const [state, setState] = useState<
    { row: LogRow; areas: SkinArea[]; treatments: ListItem[]; tags: ListItem[]; categories: ListItem[] } | 'missing' | null
  >(null);

  useEffect(() => {
    (async () => {
      if (!(LOG_KINDS as readonly string[]).includes(kind)) return setState('missing');
      const record = await getEntry(deps, kind as RecordKind, id);
      setState({
        row: { kind, id, at: (record as { at: LogRow['at'] }).at, record } as LogRow,
        areas: await deps.repo.listAreas(),
        treatments: await deps.repo.listItems('treatments'),
        tags: await deps.repo.listItems('dailyItems'),
        categories: await deps.repo.listItems('changeCategories'),
      });
    })().catch(() => setState('missing'));
  }, [deps, kind, id]);

  if (state === null) return null;
  if (state === 'missing') return <Hint>{t('edit.unavailable')}</Hint>;
  const { row, areas, treatments, tags } = state;
  // Areas and items that are archived stay listed only when the entry already uses them.
  const usable = <T extends { id: string; archived: boolean }>(l: T[], used: string[]) =>
    l.filter((x) => !x.archived || used.includes(x.id));
  switch (row.kind) {
    case 'meals':
      return <MealFields r={row.record} suggestionId={suggestionId} />;
    case 'skinEntries':
      return <SkinFields r={row.record} areas={usable(areas, [row.record.areaId])} />;
    case 'nailEntries':
      return <NailFields r={row.record} areas={usable(areas, [row.record.areaId])} />;
    case 'checkIns':
      return <CheckInFields r={row.record} items={tags.filter((i) => !i.archived)} />;
    case 'stoolEntries':
      return <StoolFields r={row.record} />;
    case 'treatmentApplications':
      return (
        <TreatmentFields
          r={row.record}
          areas={usable(areas, row.record.areaIds)}
          treatments={usable(treatments, [row.record.treatmentId])}
        />
      );
    case 'changeEvents':
      return <ChangeFields r={row.record} categories={state.categories} />;
    case 'medicalEvents':
      return <MedicalEditFields r={row.record} />;
    case 'reactions':
      return <ReactionFields r={row.record} />;
    case 'drinks':
      return <DrinkEdit r={row.record} suggestionId={suggestionId} />;
    case 'medicationEntries':
      return <MedicationFields r={row.record} />;
  }
}
