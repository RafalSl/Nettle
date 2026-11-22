/* eslint-disable @typescript-eslint/no-require-imports -- screens are loaded lazily, after the harness mocks are in place */
import {
  create,
  mockRouter,
  mockParams,
  mockPicker,
  mockScreen,
  mount,
  lastTree,
  press,
  type,
  hasText,
  nowDeps,
  toggle,
  flush,
} from './harness';
import { ActionSheetIOS, Alert } from 'react-native';
import { logMeal } from '@/core/usecases/logMeal';
import { addArea, logNailEntry, logSkinEntry } from '@/core/usecases/skin';
import { logDrink, logMedication } from '@/core/usecases/intake';
import { toggleFavoriteDrink, updateSuggestionSettings } from '@/core/usecases/preferences';
import { logChangeEvent, logMedicalEvent } from '@/core/usecases/events';
import { addListItem } from '@/core/usecases/lists';
import { localDay } from '@/core/model/time';
import en from '@/i18n/en.json';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { syntheticScores as scores } from '../helpers/fixtures';

describe('Photos in the Skin and Nails forms (SK-4)', () => {
  beforeEach(() => {
    mockRouter.back.mockClear();
    mockParams.current = {};
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    require('@/adapters/photos/pickPhotos').pickPhotoUris.mockResolvedValue(['file:///synthetic-skin.jpg']);
  });
  afterEach(() => {
    require('@/adapters/photos/pickPhotos').pickPhotoUris.mockResolvedValue([]);
    jest.restoreAllMocks();
  });
  const save = async () => {
    let rendered!: ReactTestRenderer;
    await act(async () => {
      rendered = lastTree();
    });
    await act(async () => {
      await rendered.root
        .findAll((n) => n.props.accessibilityLabel === en.common.save && typeof n.props.onPress === 'function')[0]!
        .props.onPress();
    });
    await flush();
  };

  it('SK-4 photos picked in the Skin form are saved with the entry, and dropped ones are not', async () => {
    const deps = nowDeps();
    const { tree } = await mount(() => require('@/app/form/skin'), deps);
    await flush();
    await press(tree, en.photos.library);
    await press(tree, en.photos.library);
    await press(tree, `${en.photos.drop} 2`);
    await save();
    const [entry] = await deps.repo.listRecords('skinEntries');
    const photos = await deps.repo.listRecords('photos');
    expect(photos).toMatchObject([{ entryKind: 'skinEntry', entryId: entry!.id }]);
    expect(photos[0]!.at.utc).toBe(entry!.at.utc);
  });

  it('SK-4 "No change" plus a photo is a photo-only update with the same scores', async () => {
    const deps = nowDeps();
    const scores = { severity: 4, itch: 3, pain: 2, dryness: 1, scaling: 0 };
    await logSkinEntry(deps, { areaId: 'area-chin', scores, at: new Date(Date.now() - 86_400_000) });
    const { tree } = await mount(() => require('@/app/form/skin'), deps);
    await flush();
    await press(tree, 'Chin'); // the area that has an earlier entry
    await flush(); // its last scores load
    await press(tree, en.photos.library);
    await press(tree, en.skin.noChange);
    await flush();
    const entries = await deps.repo.listRecords('skinEntries');
    expect(entries).toHaveLength(2);
    expect(entries[0]!.scores).toEqual(scores);
    expect(await deps.repo.listRecords('photos')).toMatchObject([{ entryKind: 'skinEntry', entryId: entries[0]!.id }]);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('SK-4 cancelling the form keeps no photo', async () => {
    const deps = nowDeps();
    const { tree } = await mount(() => require('@/app/form/skin'), deps);
    await flush();
    await press(tree, en.photos.library);
    expect(await deps.repo.listRecords('photos')).toEqual([]);
    expect(await deps.repo.listRecords('skinEntries')).toEqual([]);
  });

  it('SK-4 the Nails form attaches photos to the nail entry too', async () => {
    const deps = nowDeps();
    const nail = await addArea(deps, 'Synthetic thumb', 'nail');
    const { tree } = await mount(() => require('@/app/form/nails'), deps);
    await flush();
    await press(tree, en.nail.stages.white);
    await press(tree, en.nail.extents.none);
    await press(tree, en.photos.camera);
    await save();
    const [entry] = await deps.repo.listRecords('nailEntries');
    expect(entry!.areaId).toBe(nail.id);
    expect(await deps.repo.listRecords('photos')).toMatchObject([{ entryKind: 'nailEntry', entryId: entry!.id }]);
  });
});

describe('Routine change form (IN-12, UX-11)', () => {
  beforeEach(() => {
    mockRouter.back.mockClear();
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());
  const form = () => require('@/app/form/change');

  it('IN-12 "Stopped" offers what is in use now, and "Started" can be saved as already using with an unknown date', async () => {
    const deps = nowDeps();
    const { tree } = await mount(form, deps);
    await flush();
    expect(hasText(tree, en.tags['cat-product'])).toBe(true);
    expect(hasText(tree, en.tags['cat-diet'])).toBe(true);
    expect(hasText(tree, en.itemDescriptions['cat-product'])).toBe(true); // UX-11: the description of the chosen category
    const save = async () => {
      let rendered!: ReactTestRenderer;
      await act(async () => {
        rendered = lastTree();
      });
      await act(async () => {
        await rendered.root
          .findAll((n) => n.props.accessibilityLabel === en.common.save && typeof n.props.onPress === 'function')[0]!
          .props.onPress();
      });
      await flush();
    };
    await act(async () => {
      tree.root.findAll((n) => n.props.placeholder === en.more.changeName)[0]!.props.onChangeText('Synthetic cream');
    });
    await toggle(tree, en.change.dateUnknown);
    await save();
    const [started] = await deps.repo.listRecords('changeEvents');
    expect(started).toMatchObject({ action: 'started', category: 'cat-product', name: 'Synthetic cream', dateUnknown: true });
    const stop = await mount(form, deps);
    await flush();
    await press(stop.tree, en.change.actions.stopped);
    expect(hasText(stop.tree, en.change.inUse)).toBe(true);
    await press(stop.tree, 'Synthetic cream');
    await save();
    const events = await deps.repo.listRecords('changeEvents');
    expect(events.map((e) => [e.action, e.name, e.dateUnknown]).sort()).toEqual([
      ['started', 'Synthetic cream', true],
      ['stopped', 'Synthetic cream', false],
    ]);
  });
});

describe('Create forms on the unified modal (UX-3)', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockRouter.back.mockClear();
    mockParams.current = {};
    mockScreen.options = undefined;
  });
  afterEach(() => jest.restoreAllMocks());
  /** The Save button of the header the form put into Stack.Screen options: its state, and a press. */
  const headerSave = async (press = true) => {
    let rendered!: ReactTestRenderer;
    await act(async () => {
      rendered = lastTree();
    });
    const node = rendered.root.findAll((n) => n.props.accessibilityLabel === en.common.save && typeof n.props.onPress === 'function')[0]!;
    if (press) {
      await act(async () => {
        await node.props.onPress();
      });
    }
    return node.props.accessibilityState as { disabled?: boolean };
  };

  it('UX-3, IN-11 the treatment form keeps Save disabled until a treatment and an area are chosen, then saves and closes', async () => {
    const deps = nowDeps();
    const cream = await addListItem(deps, 'treatments', 'Synthetic cream');
    const { tree } = await mount(() => require('@/app/form/treatment'), deps);
    await flush();
    expect((await headerSave(false)).disabled).toBe(true);
    expect(hasText(tree, en.edit.missing.replace('{{what}}', en.edit.areas))).toBe(true);
    await press(tree, en.areas['area-chin']);
    expect((await headerSave(false)).disabled).toBe(false);
    await headerSave();
    await flush();
    expect(await deps.repo.listRecords('treatmentApplications')).toMatchObject([{ treatmentId: cream.id, areaIds: ['area-chin'] }]);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('UX-2 a treatment opened for a past day is stamped on that day', async () => {
    const deps = nowDeps();
    await addListItem(deps, 'treatments', 'Synthetic cream');
    mockParams.current = { day: '2026-01-10' };
    const { tree } = await mount(() => require('@/app/form/treatment'), deps);
    await flush();
    await press(tree, en.areas['area-neck']);
    await headerSave();
    await flush();
    const [a] = await deps.repo.listRecords('treatmentApplications');
    expect(localDay(a!.at.utc, a!.at.tz)).toBe('2026-01-10');
  });

  it('SK-10, SK-3 the nail form needs an area, a stage and an extent; "No change" repeats the last one and closes', async () => {
    const deps = nowDeps();
    const nail = await addArea(deps, 'Synthetic thumb', 'nail');
    await logNailEntry(deps, { areaId: nail.id, stage: 'yellow', extent: 'up_to_half', at: new Date(Date.now() - 86_400_000) });
    const { tree } = await mount(() => require('@/app/form/nails'), deps);
    await flush();
    expect(hasText(tree, en.edit.missing.replace('{{what}}', en.edit.stage))).toBe(true);
    await press(tree, en.nail.stages.white);
    expect(hasText(tree, en.edit.missing.replace('{{what}}', en.edit.extent))).toBe(true);
    await press(tree, en.nail.extents.none);
    await headerSave();
    await flush();
    expect((await deps.repo.listRecords('nailEntries'))[0]).toMatchObject({ stage: 'white', extent: 'none' });
    mockRouter.back.mockClear();
    await press(tree, en.skin.noChange);
    await flush();
    expect(await deps.repo.listRecords('nailEntries')).toHaveLength(3);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('IN-12, IN-13 the change and reaction forms save from the header', async () => {
    const deps = nowDeps();
    const change = await mount(() => require('@/app/form/change'), deps);
    expect((await headerSave(false)).disabled).toBe(true);
    await type(change.tree, en.more.changeName, 'Synthetic soap');
    await headerSave();
    await flush();
    expect(await deps.repo.listRecords('changeEvents')).toMatchObject([{ name: 'Synthetic soap', action: 'started' }]);
    const meal = await logMeal(deps, { description: 'Synthetic oats', ingredients: [], at: new Date(Date.now() - 3600_000) });
    const reaction = await mount(() => require('@/app/form/reaction'), deps);
    await flush();
    expect((await headerSave(false)).disabled).toBe(true);
    await press(reaction.tree, en.symptoms.hives);
    await headerSave();
    await flush();
    expect(await deps.repo.listRecords('reactions')).toMatchObject([{ mealId: meal.id, symptoms: ['hives'] }]);
  });

  it('SK-3, UX-3 the skin form saves from the header; "No change for all areas" saves every area with a history and says which need a first entry', async () => {
    const deps = nowDeps();
    const { tree } = await mount(() => require('@/app/form/skin'), deps);
    await flush();
    await press(tree, `${en.common.increase} ${en.skin.scores.itch}`);
    await headerSave();
    await flush();
    expect(await deps.repo.listRecords('skinEntries')).toMatchObject([{ areaId: 'area-behind-ears', scores: { itch: 1 } }]);
    mockRouter.back.mockClear();
    await press(tree, en.skin.noChangeAll);
    await flush();
    expect(await deps.repo.listRecords('skinEntries')).toHaveLength(2); // only the area that had an entry
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('UX-3 a form with a change asks before Cancel throws it away, a clean one just closes', async () => {
    const sheet = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation((_o, cb) => cb(1));
    const deps = nowDeps();
    const { tree } = await mount(() => require('@/app/form/drink'), deps);
    await flush();
    expect(mockScreen.options!.gestureEnabled).toBe(true);
    await type(tree, en.more.drinkName, 'Synthetic beer');
    expect(mockScreen.options!.gestureEnabled).toBe(false);
    let rendered!: ReactTestRenderer;
    await act(async () => {
      rendered = create(mockScreen.options!.headerLeft!());
    });
    await act(async () => {
      await rendered.root
        .findAll((n) => n.props.accessibilityLabel === en.common.cancel && typeof n.props.onPress === 'function')[0]!
        .props.onPress();
    });
    expect((sheet.mock.calls[0] as unknown as [{ options: string[] }])[0].options).toEqual([en.edit.discard, en.common.cancel]);
    expect(mockRouter.back).not.toHaveBeenCalled();
  });
});

describe('Medical events (IN-18, UX-2, UX-11, SK-8)', () => {
  beforeEach(() => {
    mockRouter.back.mockClear();
    mockParams.current = {};
    mockScreen.options = undefined;
    mockPicker.last = undefined;
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());
  const headerSave = async () => {
    let rendered!: ReactTestRenderer;
    await act(async () => {
      rendered = lastTree();
    });
    const node = rendered.root.findAll((n) => n.props.accessibilityLabel === en.common.save && typeof n.props.onPress === 'function')[0]!;
    await act(async () => {
      await node.props.onPress();
    });
    await flush();
    return node.props.accessibilityState as { disabled?: boolean } | undefined;
  };
  const inDays = (n: number) => new Date(Date.now() + n * 86_400_000);
  const dayOf = (d: Date) => localDay(d.toISOString(), 'Europe/Warsaw');

  it('IN-18 the form saves a visit with a title and a note, and Save stays off until there is a title', async () => {
    const deps = nowDeps();
    const { tree } = await mount(() => require('@/app/form/medical'), deps);
    expect(hasText(tree, en.medical.endDay)).toBe(false); // only an illness has an end date
    expect(hasText(tree, en.edit.missing.replace('{{what}}', en.edit.titleMissing))).toBe(true);
    expect((await headerSave())?.disabled).toBe(true);
    await type(tree, en.medical.title, 'Synthetic dermatology visit');
    await type(tree, en.common.note, 'a cream was prescribed');
    await headerSave();
    expect(await deps.repo.listRecords('medicalEvents')).toMatchObject([
      { kind: 'visit', title: 'Synthetic dermatology visit', note: 'a cream was prescribed', endDay: null },
    ]);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('IN-18 an illness offers an end date, which can be set, cleared and left empty; other kinds drop it', async () => {
    const deps = nowDeps();
    const { tree } = await mount(() => require('@/app/form/medical'), deps);
    await press(tree, en.medical.kinds.illness);
    expect(hasText(tree, en.medical.endNone)).toBe(true);
    await type(tree, en.medical.title, 'Synthetic throat infection');
    await press(tree, en.medical.endSet);
    const end = dayOf(inDays(3));
    await act(async () => mockPicker.last!.onValueChange({}, new Date(`${end}T12:00:00`)));
    expect(hasText(tree, end)).toBe(true);
    await press(tree, en.medical.endClear);
    expect(hasText(tree, en.medical.endNone)).toBe(true);
    await press(tree, en.medical.endSet);
    await act(async () => mockPicker.last!.onValueChange({}, new Date(`${end}T12:00:00`)));
    await press(tree, en.medical.kinds.visit); // switching away from illness drops the end date
    await headerSave();
    expect(await deps.repo.listRecords('medicalEvents')).toMatchObject([{ kind: 'visit', endDay: null }]);
    const second = await mount(() => require('@/app/form/medical'), deps);
    await press(second.tree, en.medical.kinds.illness);
    await type(second.tree, en.medical.title, 'Synthetic flu');
    await press(second.tree, en.medical.endSet);
    await act(async () => mockPicker.last!.onValueChange({}, new Date(`${end}T12:00:00`)));
    await headerSave();
    expect((await deps.repo.listRecords('medicalEvents')).find((e) => e.title === 'Synthetic flu')).toMatchObject({
      kind: 'illness',
      endDay: end,
    });
  });

  it('IN-18, EN-1 a log row names the kind and title (and until when), and the edit form changes and clears the end date', async () => {
    const deps = nowDeps();
    const e = await logMedicalEvent(deps, {
      kind: 'illness',
      title: 'Synthetic cold',
      at: new Date(Date.now() - 3600_000),
      endDay: dayOf(inDays(2)),
    });
    const today = await mount(() => require('@/app/(tabs)/today/index'), deps);
    await flush();
    expect(hasText(today.tree, en.log.medical.replace('{{kind}}', en.medical.kinds.illness).replace('{{title}}', 'Synthetic cold'))).toBe(
      true,
    );
    expect(hasText(today.tree, en.log.medicalUntil.replace('{{day}}', dayOf(inDays(2))))).toBe(true);
    mockParams.current = { kind: 'medicalEvents', id: e.id };
    const { tree } = await mount(() => require('@/app/form/edit'), deps);
    await flush();
    expect(hasText(tree, dayOf(inDays(2)))).toBe(true);
    await press(tree, en.medical.endClear);
    await type(tree, en.medical.title, 'Synthetic cold, ended');
    await headerSave();
    expect(await deps.repo.listRecords('medicalEvents')).toMatchObject([{ id: e.id, title: 'Synthetic cold, ended', endDay: null }]);
  });

  it('UX-2, UX-11 Medical event is listed in More with its hint, and "Where do I log…?" has a visit row and the two ways to log an illness', async () => {
    const deps = nowDeps();
    const more = await mount(() => require('@/app/(tabs)/today/more'), deps);
    await flush();
    expect(hasText(more.tree, en.entry.medical.title)).toBe(true);
    expect(hasText(more.tree, en.entry.medical.hint)).toBe(true);
    await press(more.tree, en.entry.medical.title);
    expect(mockRouter.push).toHaveBeenLastCalledWith('/form/medical');
    const guide = await mount(() => require('@/app/guide'), deps);
    await press(guide.tree, en.guide.items.visit);
    expect(mockRouter.push).toHaveBeenLastCalledWith('/form/medical');
    expect(hasText(guide.tree, en.guide.notes.ill)).toBe(true);
    await press(guide.tree, en.guide.items.illQuick);
    expect(mockRouter.push).toHaveBeenLastCalledWith('/form/checkin');
  });

  it('SK-8 an area timeline shows the medical event markers next to the entries', async () => {
    const deps = nowDeps();
    await logSkinEntry(deps, { areaId: 'area-chin', scores, at: new Date('2026-01-12T08:00:00.000Z') });
    await logMedicalEvent(deps, {
      kind: 'illness',
      title: 'Synthetic cold',
      at: new Date('2026-01-12T07:00:00.000Z'),
      endDay: '2026-01-14',
    });
    mockParams.current = { id: 'area-chin' };
    const { tree } = await mount(() => require('@/app/(tabs)/review/area'), deps);
    await flush();
    expect(hasText(tree, en.review.medicalStart.replace('{{kind}}', en.medical.kinds.illness).replace('{{title}}', 'Synthetic cold'))).toBe(
      true,
    );
    expect(hasText(tree, en.review.medicalEnd.replace('{{title}}', 'Synthetic cold'))).toBe(true);
    mockParams.current = {};
  });
});

describe('Forms: floating Save (UX-3, UX-12)', () => {
  beforeEach(() => {
    mockScreen.options = undefined;
    mockRouter.back.mockClear();
  });
  it('UX-3 Save floats in the form, is disabled with a line saying what is missing, and the header has no Save', async () => {
    const { tree } = await mount(() => require('@/app/form/drink'), nowDeps());
    await flush();
    const saves = tree.root.findAll((n) => n.props.accessibilityLabel === en.common.save && n.props.accessibilityState !== undefined);
    expect(saves.length).toBeGreaterThan(0);
    expect(saves.every((n) => n.props.accessibilityState.disabled === true)).toBe(true);
    expect(hasText(tree, en.edit.missing.replace('{{what}}', ''))).toBe(true);
    expect(mockScreen.options!.headerRight).toBeUndefined();
    expect(mockScreen.options!.headerLeft).toBeDefined(); // Cancel stays in the header
  });

  it('UX-3 Save saves and closes the form once the form is complete', async () => {
    const deps = nowDeps();
    const { tree } = await mount(() => require('@/app/form/stool'), deps);
    await flush();
    await press(tree, '4');
    await press(tree, en.common.save);
    await flush();
    expect(await deps.repo.listRecords('stoolEntries')).toHaveLength(1);
    expect(mockRouter.back).toHaveBeenCalled();
  });
});

describe('Entry forms (IN-12, IN-13, IN-17, UX-3)', () => {
  beforeEach(() => {
    mockScreen.options = undefined;
    mockRouter.push.mockClear();
  });
  it('IN-13 the urgent-care advice is always shown; without a meal the form says to log one first and Save stays disabled', async () => {
    const { tree } = await mount(() => require('@/app/form/reaction'), nowDeps());
    await flush();
    expect(hasText(tree, en.more.reactionUrgent)).toBe(true);
    expect(hasText(tree, en.more.reactionLogMealFirst)).toBe(true);
    const saves = tree.root.findAll((n) => n.props.accessibilityLabel === en.common.save && n.props.accessibilityState !== undefined);
    expect(saves.every((n) => n.props.accessibilityState.disabled === true)).toBe(true);
    await press(tree, en.cards.firstMeal);
    expect(mockRouter.push).toHaveBeenLastCalledWith('/form/meal');
  });

  it('IN-12 Stopped lists what is in use now as a single choice and fills the name', async () => {
    const deps = nowDeps();
    await logChangeEvent(deps, {
      action: 'started',
      category: 'cat-product',
      name: 'Synthetic soap',
      at: new Date(Date.now() - 86_400_000),
    });
    const { tree } = await mount(() => require('@/app/form/change'), deps);
    await flush();
    await press(tree, en.change.actions.stopped);
    await press(tree, 'Synthetic soap');
    const radios = tree.root.findAll((n) => n.props.accessibilityRole === 'radio' && n.props.accessibilityLabel === 'Synthetic soap');
    expect(radios.some((n) => n.props.accessibilityState.checked === true)).toBe(true);
  });

  it('IN-17 the Regular switch is one glass row that explains itself once it is on', async () => {
    const { tree } = await mount(() => require('@/app/form/medication'), nowDeps());
    await flush();
    expect(hasText(tree, en.regular.switchHint)).toBe(false);
    await toggle(tree, en.regular.switch);
    expect(hasText(tree, en.regular.switchHint)).toBe(true);
    expect(
      tree.root.findAll((n) => n.props.accessibilityRole === 'switch' && n.props.accessibilityLabel === en.regular.switch).length,
    ).toBeGreaterThan(0);
  });
});

describe('Alcohol and medication suggestions (IN-14, UX-5)', () => {
  beforeEach(() => {
    mockRouter.back.mockClear();
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());
  const alcohol = () => require('@/app/form/drink');
  const medication = () => require('@/app/form/medication');
  const at = (h: number) => new Date(Date.now() - h * 3600_000);

  it('IN-14 a suggestion fills the form and saves nothing while "save on tap" is off', async () => {
    const deps = nowDeps();
    await logDrink(deps, { name: 'Synthetic beer', amountMl: 500, at: at(30) });
    await logDrink(deps, { name: 'Synthetic beer', amountMl: 500, at: at(10) });
    await logMedication(deps, { category: 'supplement', name: 'Synthetic vitamin', dose: '1 tablet', at: at(5) });
    const { tree } = await mount(alcohol, deps);
    await flush();
    expect(hasText(tree, 'Synthetic beer 500 ml ×2')).toBe(true);
    await press(tree, 'Synthetic beer 500 ml');
    const drink = tree.root.findAll((n) => n.props.placeholder === en.more.drinkName)[0]!;
    expect(drink.props.value).toBe('Synthetic beer');
    const meds = await mount(medication, deps);
    await flush();
    await press(meds.tree, 'Synthetic vitamin 1 tablet');
    expect(meds.tree.root.findAll((n) => n.props.placeholder === en.more.medName)[0]!.props.value).toBe('Synthetic vitamin');
    expect(await deps.repo.listRecords('drinks')).toHaveLength(2);
    expect(await deps.repo.listRecords('medicationEntries')).toHaveLength(1);
  });

  it('UX-5 with "save on tap" a suggestion saves at once, as a new entry', async () => {
    const deps = nowDeps();
    await logDrink(deps, { name: 'Synthetic beer', amountMl: 500, at: at(10) });
    await logMedication(deps, { category: 'medication', name: 'Synthetic pill', at: at(5) });
    await updateSuggestionSettings(deps, { saveOnTap: true });
    const { tree } = await mount(alcohol, deps);
    await flush();
    await press(tree, 'Synthetic beer 500 ml');
    const meds = await mount(medication, deps);
    await flush();
    await press(meds.tree, 'Synthetic pill');
    await flush();
    expect(mockRouter.back).toHaveBeenCalledTimes(2); // a tap that saves closes the form
    expect((await deps.repo.listRecords('drinks')).map((e) => e.amountMl)).toEqual([500, 500]);
    expect(await deps.repo.listRecords('medicationEntries')).toHaveLength(2);
  });

  it('IN-14 a star on the drink and medication forms keeps a favorite, and a second tap removes it', async () => {
    const deps = nowDeps();
    const drink = await mount(alcohol, deps);
    await flush();
    await type(drink.tree, en.more.drinkName, 'Synthetic coffee');
    await type(drink.tree, en.more.drinkAmount, '200');
    await type(drink.tree, en.more.drinkIngredients, 'coffee, milk');
    await press(drink.tree, en.meal.favorite);
    await flush();
    expect((await deps.repo.getPreferences())!.favorites.drinks).toMatchObject([
      { name: 'Synthetic coffee', amountMl: 200, alcohol: false, ingredients: ['coffee', 'milk'] },
    ]);
    expect(hasText(drink.tree, en.meal.unfavorite)).toBe(true);
    await press(drink.tree, en.meal.unfavorite);
    await flush();
    expect((await deps.repo.getPreferences())!.favorites.drinks).toEqual([]);

    const meds = await mount(medication, deps);
    await flush();
    await type(meds.tree, en.more.medName, 'Synthetic vitamin');
    await type(meds.tree, en.more.medDose, '1 tablet');
    await press(meds.tree, en.meal.favorite);
    await flush();
    expect((await deps.repo.getPreferences())!.favorites.medications).toMatchObject([{ name: 'Synthetic vitamin', dose: '1 tablet' }]);
    expect(hasText(meds.tree, en.meal.unfavorite)).toBe(true);
  });

  it('IN-14 favorites come first, even without history', async () => {
    const deps = nowDeps();
    await logDrink(deps, { name: 'Synthetic beer', amountMl: 500, at: at(10) });
    await toggleFavoriteDrink(deps, {
      name: 'Synthetic wine',
      amountMl: 150,
      alcohol: true,
      ingredients: [],
      allergens: [],
      barcode: null,
      source: { kind: 'typed', edited: false, llm: null, aiTags: false },
    });
    const { tree } = await mount(alcohol, deps);
    await flush();
    const labels = [
      ...new Set(
        tree.root
          .findAll((n) => n.props.accessibilityRole === 'button' && /ml$/.test(n.props.accessibilityLabel ?? ''))
          .map((n) => n.props.accessibilityLabel as string),
      ),
    ];
    expect(labels).toEqual(['Synthetic wine 150 ml', 'Synthetic beer 500 ml']);
  });
});

describe('Storage error keeps the form open (NF-3)', () => {
  it('NF-3 a failed save shows a coral banner, keeps the form and the input, and a retry works', async () => {
    mockRouter.back.mockClear();
    const deps = nowDeps();
    const add = jest.spyOn(deps.repo, 'addRecord').mockRejectedValueOnce(new Error('disk full'));
    const { tree } = await mount(() => require('@/app/form/stool'), deps);
    await flush();
    await press(tree, '4');
    await press(tree, en.common.save);
    await flush();
    expect(hasText(tree, en.errors.generic)).toBe(true);
    expect(hasText(tree, en.edit.keptOpen)).toBe(true);
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(await deps.repo.listRecords('stoolEntries')).toEqual([]);
    await press(tree, en.common.save); // the input is still there: one tap saves
    await flush();
    expect(hasText(tree, en.edit.keptOpen)).toBe(false);
    expect(await deps.repo.listRecords('stoolEntries')).toHaveLength(1);
    expect(mockRouter.back).toHaveBeenCalled();
    add.mockRestore();
  });
});
