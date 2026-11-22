/* eslint-disable @typescript-eslint/no-require-imports -- screens are loaded lazily, after the harness mocks are in place */
import { create, mockRouter, mockParams, mockScreen, mount, lastTree, press, type, hasText, nowDeps, flush } from './harness';
import { ActionSheetIOS, Alert } from 'react-native';
import { logMeal } from '@/core/usecases/logMeal';
import { addArea, logNailEntry, logSkinEntry } from '@/core/usecases/skin';
import { logStool, saveCheckIn } from '@/core/usecases/checkin';
import { logDrink, logMedication } from '@/core/usecases/intake';
import { applyTreatment, logChangeEvent, logReaction } from '@/core/usecases/events';
import { addListItem } from '@/core/usecases/lists';
import { localDay } from '@/core/model/time';
import en from '@/i18n/en.json';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { syntheticScores as scores } from '../helpers/fixtures';

describe('Edit entry (EN-1, UX-3)', () => {
  let sheet: jest.SpyInstance;
  beforeEach(() => {
    sheet = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation((_o, cb) => cb(0));
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockRouter.push.mockClear();
    mockRouter.back.mockClear();
    mockScreen.options = undefined;
  });
  afterEach(() => jest.restoreAllMocks());
  const edit = () => require('@/app/form/edit');
  /** Presses a button of the header that the form put into Stack.Screen options. */
  const header = async (side: 'headerLeft' | 'headerRight', label: string) => {
    let rendered!: ReactTestRenderer;
    await act(async () => {
      rendered = side === 'headerRight' ? lastTree() : create(mockScreen.options![side]!());
    });
    const node = rendered.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0]!;
    await act(async () => {
      await node.props.onPress();
    });
    return node.props.accessibilityState as { disabled?: boolean } | undefined;
  };

  it('EN-1 a log row offers Edit, which opens the edit form with the kind and id', async () => {
    const deps = nowDeps();
    const meal = await logMeal(deps, { description: 'Synthetic oats', ingredients: [], at: new Date(Date.now() - 3600_000) });
    const { tree } = await mount(() => require('@/app/(tabs)/today/index'), deps);
    await flush();
    await press(
      tree,
      tree.root.findAll((n) => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.includes('Synthetic oats'))[0]!
        .props.accessibilityLabel,
    );
    await flush();
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/form/edit', params: { kind: 'meals', id: meal.id } });
    expect(await deps.repo.listRecords('meals')).toHaveLength(1); // Edit deleted nothing
  });

  it('EN-1, UX-3 editing a meal keeps its id, Save is disabled while the description is empty, and saving closes the form', async () => {
    const deps = nowDeps();
    const meal = await logMeal(deps, { description: 'Synthetic oats', ingredients: ['oats'], at: new Date(Date.now() - 3600_000) });
    mockParams.current = { kind: 'meals', id: meal.id };
    const { tree } = await mount(edit, deps);
    await flush();
    await type(tree, en.meal.description, '');
    expect(hasText(tree, en.edit.missing.replace('{{what}}', en.edit.description))).toBe(true);
    expect(mockScreen.options!.gestureEnabled).toBe(false); // changed: swiping down is guarded
    const state = await header('headerRight', en.common.save);
    expect(state?.disabled).toBe(true);
    expect(mockRouter.back).not.toHaveBeenCalled();
    await type(tree, en.meal.description, 'Synthetic porridge');
    await header('headerRight', en.common.save);
    await flush();
    expect(await deps.repo.listRecords('meals')).toMatchObject([{ id: meal.id, description: 'Synthetic porridge' }]);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('UX-3, UX-9 Cancel after a change asks before discarding; without a change it just closes', async () => {
    const deps = nowDeps();
    const stool = await deps.repo
      .addRecord('stoolEntries', { id: 'st1', at: { utc: new Date().toISOString(), tz: 'Europe/Warsaw' }, bristol: 4, note: null })
      .then(() => 'st1');
    mockParams.current = { kind: 'stoolEntries', id: stool };
    const { tree } = await mount(edit, deps);
    await flush();
    await header('headerLeft', en.common.cancel);
    expect(sheet).not.toHaveBeenCalled();
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    await press(tree, '6');
    sheet.mockImplementation((_o, cb) => cb(1)); // Cancel in the sheet: keep editing
    await header('headerLeft', en.common.cancel);
    expect((sheet.mock.calls[0] as [{ options: string[] }])[0].options).toEqual([en.edit.discard, en.common.cancel]);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    sheet.mockImplementation((_o, cb) => cb(0)); // Discard Changes
    await header('headerLeft', en.common.cancel);
    expect(mockRouter.back).toHaveBeenCalledTimes(2);
    expect((await deps.repo.listRecords('stoolEntries'))[0]!.bristol).toBe(4);
  });

  it('EN-1 every kind in the day log opens in its form and saves unchanged under its own id', async () => {
    const deps = nowDeps();
    const at = new Date(Date.now() - 3600_000);
    const nail = await addArea(deps, 'Synthetic thumb', 'nail');
    const cream = await addListItem(deps, 'treatments', 'Synthetic cream');
    const meal = await logMeal(deps, { description: 'Synthetic oats', ingredients: ['oats'], at });
    const ids: [string, string][] = [
      ['meals', meal.id],
      ['skinEntries', (await logSkinEntry(deps, { areaId: 'area-chin', scores, at })).id],
      ['nailEntries', (await logNailEntry(deps, { areaId: nail.id, stage: 'white', extent: 'none', at })).id],
      ['checkIns', (await saveCheckIn(deps, { at, values: { 'item-wellbeing': 5 }, confirmEmptyDay: true })).id],
      ['stoolEntries', (await logStool(deps, { bristol: 3, at })).id],
      ['treatmentApplications', (await applyTreatment(deps, { treatmentId: cream.id, areaIds: ['area-chin'], at })).id],
      ['changeEvents', (await logChangeEvent(deps, { action: 'started', category: 'cat-product', name: 'Synthetic soap', at })).id],
      ['reactions', (await logReaction(deps, { mealId: meal.id, symptoms: ['hives'], at: new Date(at.getTime() + 600_000) })).id],
      ['drinks', (await logDrink(deps, { name: 'Synthetic beer', amountMl: 500, at })).id],
      ['medicationEntries', (await logMedication(deps, { category: 'medication', name: 'Synthetic pill', at })).id],
    ];
    for (const [kind, id] of ids) {
      mockRouter.back.mockClear();
      mockParams.current = { kind, id };
      const { tree } = await mount(edit, deps);
      await flush();
      expect(tree.toJSON()).not.toBeNull();
      await header('headerRight', en.common.save);
      await flush();
      expect(mockRouter.back).toHaveBeenCalledTimes(1);
      const all = [
        ...(await deps.repo.listRecords('meals')),
        ...(await deps.repo.listRecords('skinEntries')),
        ...(await deps.repo.listRecords('nailEntries')),
        ...(await deps.repo.listRecords('checkIns')),
        ...(await deps.repo.listRecords('stoolEntries')),
        ...(await deps.repo.listRecords('treatmentApplications')),
        ...(await deps.repo.listRecords('changeEvents')),
        ...(await deps.repo.listRecords('reactions')),
        ...(await deps.repo.listRecords('drinks')),
        ...(await deps.repo.listRecords('medicationEntries')),
      ];
      expect(all.filter((r) => r.id === id)).toHaveLength(1);
      expect(all).toHaveLength(ids.length);
    }
  });

  it('EN-1 an entry that no longer exists shows a message instead of a form', async () => {
    mockParams.current = { kind: 'meals', id: 'gone' };
    const { tree } = await mount(edit, nowDeps());
    await flush();
    expect(hasText(tree, en.edit.unavailable)).toBe(true);
  });
});

describe('Cracks and size on a skin entry (SK-3, SK-8, EN-1)', () => {
  const sc = { severity: 4, itch: 3, pain: 2, dryness: 1, scaling: 0 };
  beforeEach(() => {
    mockRouter.back.mockClear();
    mockParams.current = {};
    mockScreen.options = undefined;
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
  const switchOf = (tree: ReactTestRenderer, label: string) =>
    tree.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onValueChange === 'function')[0]!;
  const sizeInput = (tree: ReactTestRenderer) =>
    tree.root.findAll((n) => n.props.accessibilityLabel === en.skin.sizeMm && typeof n.props.onChangeText === 'function');

  it('SK-3, UX-4 the cracks switch is always there and the size sits behind Details, which stays closed for an area without a size', async () => {
    const deps = nowDeps();
    const { tree } = await mount(() => require('@/app/form/skin'), deps);
    await flush();
    expect(switchOf(tree, en.skin.cracks).props.value).toBe(false);
    expect(sizeInput(tree)).toHaveLength(0);
    await press(tree, en.skin.details);
    expect(sizeInput(tree).length).toBeGreaterThan(0);
  });

  it('SK-3 a new entry saves the cracks flag and the size, and an invalid size disables Save and says what is wrong', async () => {
    const deps = nowDeps();
    const { tree } = await mount(() => require('@/app/form/skin'), deps);
    await flush();
    await act(async () => switchOf(tree, en.skin.cracks).props.onValueChange(true));
    await press(tree, en.skin.details);
    await type(tree, en.skin.sizeMm, '12.5');
    expect(hasText(tree, en.errors.invalid_size)).toBe(true);
    expect(hasText(tree, en.edit.missing.replace('{{what}}', en.skin.sizeMissing))).toBe(true);
    expect((await headerSave())?.disabled).toBe(true);
    expect(await deps.repo.listRecords('skinEntries')).toEqual([]); // even a forced press saves nothing: an invalid size is an error, not "no size"
    await type(tree, en.skin.sizeMm, '14');
    await headerSave();
    expect(await deps.repo.listRecords('skinEntries')).toMatchObject([{ cracks: true, sizeMm: 14 }]);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('SK-3 an empty size field saves no size, and the entry is not marked cracked unless the switch is on', async () => {
    const deps = nowDeps();
    await mount(() => require('@/app/form/skin'), deps);
    await flush();
    await headerSave();
    expect(await deps.repo.listRecords('skinEntries')).toMatchObject([{ cracks: false, sizeMm: null }]);
  });

  it('SK-3 an area with an earlier size opens Details by itself, prefills both, and "No change" carries them', async () => {
    const deps = nowDeps();
    await logSkinEntry(deps, { areaId: 'area-chin', scores: sc, cracks: true, sizeMm: 22, at: new Date(Date.now() - 86_400_000) });
    const { tree } = await mount(() => require('@/app/form/skin'), deps);
    await flush();
    await press(tree, 'Chin');
    await flush();
    expect(switchOf(tree, en.skin.cracks).props.value).toBe(true);
    expect(sizeInput(tree)[0]!.props.value).toBe('22'); // Details opened without a tap
    await press(tree, en.skin.noChange);
    await flush();
    expect(await deps.repo.listRecords('skinEntries')).toMatchObject([
      { cracks: true, sizeMm: 22 },
      { cracks: true, sizeMm: 22 },
    ]);
    // another area without a size shows no Details content
    const { tree: second } = await mount(() => require('@/app/form/skin'), nowDeps());
    await flush();
    expect(sizeInput(second)).toHaveLength(0);
  });

  it('EN-1, SK-3 the edit form shows the saved flag and size, changes them, and clears the size with an empty field', async () => {
    const deps = nowDeps();
    const entry = await logSkinEntry(deps, {
      areaId: 'area-chin',
      scores: sc,
      cracks: true,
      sizeMm: 30,
      at: new Date(Date.now() - 3600_000),
    });
    mockParams.current = { kind: 'skinEntries', id: entry.id };
    const { tree } = await mount(() => require('@/app/form/edit'), deps);
    await flush();
    expect(switchOf(tree, en.skin.cracks).props.value).toBe(true);
    expect(sizeInput(tree)[0]!.props.value).toBe('30');
    await act(async () => switchOf(tree, en.skin.cracks).props.onValueChange(false));
    await type(tree, en.skin.sizeMm, '');
    await headerSave();
    expect(await deps.repo.listRecords('skinEntries')).toMatchObject([{ id: entry.id, cracks: false, sizeMm: null }]);
  });

  it('SK-8, UX-2 the timeline line and the day log row say cracks and size, and the chart gets a Size choice only where a size is logged', async () => {
    const deps = nowDeps();
    await logSkinEntry(deps, { areaId: 'area-chin', scores: sc, cracks: true, sizeMm: 18, at: new Date(Date.now() - 3 * 3600_000) });
    await logSkinEntry(deps, { areaId: 'area-neck', scores: sc, at: new Date(Date.now() - 3 * 3600_000) });
    mockParams.current = { id: 'area-chin' };
    const chin = await mount(() => require('@/app/(tabs)/review/area'), deps);
    await flush();
    expect(hasText(chin.tree, `${en.log.cracks}, ${en.log.sizeMm.replace('{{n}}', '18')}`)).toBe(true);
    await press(chin.tree, en.review.sizeChip);
    expect(
      hasText(
        chin.tree,
        en.review.trendSummary
          .replace('{{label}}', en.review.sizeChip)
          .replace('{{first}}', '18')
          .replace('{{last}}', '18')
          .replace('{{min}}', '18')
          .replace('{{max}}', '18')
          .replace('{{from}}', localDay(new Date(Date.now() - 3 * 3600_000).toISOString(), 'Europe/Warsaw'))
          .replace('{{to}}', localDay(new Date(Date.now() - 3 * 3600_000).toISOString(), 'Europe/Warsaw')),
      ),
    ).toBe(true);
    mockParams.current = { id: 'area-neck' };
    const neck = await mount(() => require('@/app/(tabs)/review/area'), deps);
    await flush();
    expect(hasText(neck.tree, en.review.sizeChip)).toBe(false);
    expect(hasText(neck.tree, en.log.cracks)).toBe(false);
    mockParams.current = {};
    const today = await mount(() => require('@/app/(tabs)/today/index'), deps);
    await flush();
    expect(hasText(today.tree, en.log.sizeMm.replace('{{n}}', '18'))).toBe(true);
  });
});

describe('Reaction after applying a treatment, and the new tags (IN-11, IN-6)', () => {
  beforeEach(() => {
    mockRouter.back.mockClear();
    mockParams.current = {};
    mockScreen.options = undefined;
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());
  const headerSave = async () => {
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
  const selected = (tree: ReactTestRenderer, label: string) =>
    tree.root.findAll((n) => n.props.accessibilityLabel === label && n.props.accessibilityState)[0]!.props.accessibilityState.selected;

  it('IN-11 the edit screen sets the reaction afterwards, a second tap clears it, and an untouched application stays not recorded', async () => {
    const deps = nowDeps();
    const cream = await addListItem(deps, 'treatments', 'Synthetic cream');
    const app = await applyTreatment(deps, { treatmentId: cream.id, areaIds: ['area-chin'], at: new Date(Date.now() - 3600_000) });
    mockParams.current = { kind: 'treatmentApplications', id: app.id };
    const { tree } = await mount(() => require('@/app/form/edit'), deps);
    await flush();
    for (const x of ['none', 'mild', 'strong'] as const) expect(selected(tree, en.treatmentReaction[x])).toBe(false); // empty by default
    expect(hasText(tree, en.treatmentReaction.hint)).toBe(true);
    await press(tree, en.treatmentReaction.strong);
    expect(selected(tree, en.treatmentReaction.strong)).toBe(true);
    await headerSave();
    expect((await deps.repo.listRecords('treatmentApplications'))[0]).toMatchObject({ id: app.id, reaction: 'strong' });
    // reopen: shown as chosen; the day log says so; a tap on the chosen one clears it
    const again = await mount(() => require('@/app/form/edit'), deps);
    await flush();
    expect(selected(again.tree, en.treatmentReaction.strong)).toBe(true);
    await press(again.tree, en.treatmentReaction.strong);
    await headerSave();
    expect((await deps.repo.listRecords('treatmentApplications'))[0]!.reaction).toBeNull();
  });

  it('IN-11 the day log row names a recorded reaction, and the quick path never asks for one', async () => {
    const deps = nowDeps();
    const cream = await addListItem(deps, 'treatments', 'Synthetic cream');
    await applyTreatment(deps, { treatmentId: cream.id, areaIds: ['area-chin'], reaction: 'mild', at: new Date(Date.now() - 3600_000) });
    const today = await mount(() => require('@/app/(tabs)/today/index'), deps);
    await flush();
    expect(hasText(today.tree, en.treatmentReaction.row.replace('{{reaction}}', en.treatmentReaction.mild))).toBe(true);
    expect(hasText(today.tree, en.treatmentReaction.title)).toBe(false);
  });

  it('IN-6 Daily health offers the two new tags as yes/no switches', async () => {
    const deps = nowDeps();
    const { tree } = await mount(() => require('@/app/form/checkin'), deps);
    await flush();
    for (const id of ['tag-hot-shower', 'tag-intimate-friction'] as const) {
      expect(hasText(tree, en.tags[id])).toBe(true);
    }
  });
});
