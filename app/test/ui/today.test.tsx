/* eslint-disable @typescript-eslint/no-require-imports -- screens are loaded lazily, after the harness mocks are in place */
import { mockRouter, mount, press, type, hasText, nowDeps, toggle, flush } from './harness';
import { ActionSheetIOS, Alert } from 'react-native';
import { logMeal } from '@/core/usecases/logMeal';
import { logSkinEntry } from '@/core/usecases/skin';
import { logStool } from '@/core/usecases/checkin';
import { logDrink } from '@/core/usecases/intake';
import { addRegularMedication, setRegularTimes } from '@/core/usecases/regular';
import { pinEntryType, unpinEntryType } from '@/core/usecases/preferences';
import { applyTreatment, logReaction } from '@/core/usecases/events';
import { addListItem } from '@/core/usecases/lists';
import { localDay } from '@/core/model/time';
import en from '@/i18n/en.json';
import { act, type ReactTestRenderer } from 'react-test-renderer';

describe('Today (UX-2, UX-5, EN-1, UX-9)', () => {
  let sheet: jest.SpyInstance;
  beforeEach(() => {
    sheet = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation((_o, cb) => cb(1)); // Delete
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());
  const today = () => require('@/app/(tabs)/today/index');

  it('UX-2 shows the day log, and a row opens an action sheet that names what goes with a meal (EN-1, UX-9)', async () => {
    const deps = nowDeps();
    const meal = await logMeal(deps, { description: 'Synthetic oats', ingredients: ['oats'], at: new Date(Date.now() - 3600_000) });
    await logReaction(deps, { mealId: meal.id, symptoms: ['hives'], at: new Date(Date.now() - 1800_000) });
    const { tree } = await mount(today, deps);
    await flush();
    expect(hasText(tree, 'Synthetic oats')).toBe(true);
    const row = tree.root.findAll(
      (n) =>
        typeof n.props.accessibilityLabel === 'string' &&
        n.props.accessibilityLabel.includes('Synthetic oats') &&
        typeof n.props.onPress === 'function',
    )[0]!;
    await act(async () => row.props.onPress());
    await flush();
    const [options] = sheet.mock.calls[0] as [
      { options: string[]; destructiveButtonIndex: number[]; cancelButtonIndex: number; message: string },
    ];
    expect(options.options).toEqual([en.log.editAction, en.log.deleteAction, en.common.cancel]); // Cancel last
    expect(options.destructiveButtonIndex).toEqual([1]);
    expect(options.cancelButtonIndex).toBe(2);
    expect(options.message).toContain('1 reactions');
    expect(await deps.repo.listRecords('meals')).toEqual([]);
    expect(await deps.repo.listRecords('reactions')).toEqual([]);
    expect((await deps.repo.listTombstones()).map((x) => x.id).sort()).toHaveLength(2);
    expect(hasText(tree, 'Synthetic oats')).toBe(false);
  });

  it('UX-9 choosing Cancel in the action sheet deletes nothing', async () => {
    const deps = nowDeps();
    await logMeal(deps, { description: 'Synthetic oats', ingredients: [], at: new Date(Date.now() - 3600_000) });
    sheet.mockImplementation((_o, cb) => cb(2)); // Cancel
    const { tree } = await mount(today, deps);
    await flush();
    await press(
      tree,
      tree.root.findAll((n) => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.includes('Synthetic oats'))[0]!
        .props.accessibilityLabel,
    );
    await flush();
    expect(await deps.repo.listRecords('meals')).toHaveLength(1);
    expect(await deps.repo.listTombstones()).toEqual([]);
  });

  it('NF-2 the stool quick sheet saves a type in two taps and the row appears in the log', async () => {
    const deps = nowDeps();
    const { tree } = await mount(today, deps);
    await press(tree, en.day.stool);
    await press(tree, en.day.stoolType.replace('{{n}}', '4'));
    await flush();
    expect((await deps.repo.listRecords('stoolEntries')).map((s) => s.bristol)).toEqual([4]);
    expect(hasText(tree, en.log.stool.replace('{{n}}', '4'))).toBe(true);
  });

  it('IN-11, NF-2 a treatment shortcut logs in one tap and is disabled right after', async () => {
    const deps = nowDeps();
    const cream = await addListItem(deps, 'treatments', 'Synthetic cream');
    for (const h of [5, 4])
      await applyTreatment(deps, { treatmentId: cream.id, areaIds: ['area-chin'], at: new Date(Date.now() - h * 3600_000) });
    const { tree } = await mount(today, deps);
    await flush();
    const label = 'Synthetic cream: ' + en.areas['area-chin'];
    await press(tree, en.entry.treatment.title); // the Treatment sheet lists the often-used combinations
    expect(hasText(tree, en.sheet.often)).toBe(true);
    await press(tree, label);
    await flush();
    expect(await deps.repo.listRecords('treatmentApplications')).toHaveLength(3);
    const node = tree.root.findAll((n) => n.props.accessibilityLabel === label && n.props.accessibilityState)[0]!;
    expect(node.props.accessibilityState.disabled).toBe(true);
    await act(async () => tree.unmount());
  });

  it('UX-2 a past day shows its own log, and a quick entry there gets that day', async () => {
    const deps = nowDeps();
    const { tree } = await mount(today, deps);
    await press(tree, en.day.previous);
    await press(tree, en.day.stool);
    await press(tree, en.day.stoolType.replace('{{n}}', '3'));
    await flush();
    const [stool] = await deps.repo.listRecords('stoolEntries');
    const yesterday = new Date(Date.now() - 86_400_000);
    expect(localDay(stool!.at.utc, stool!.at.tz)).toBe(localDay(yesterday.toISOString(), deps.clock.timeZone()));
    await press(tree, en.day.backToToday);
    expect(hasText(tree, en.day.empty)).toBe(true);
  });

  it('SK-6, UX-2 an open derived flare shows one card that opens Review, and Daily health is offered for a day with no record', async () => {
    const deps = nowDeps();
    await logSkinEntry(deps, {
      areaId: 'area-chin',
      scores: { severity: 9, itch: 0, pain: 0, dryness: 0, scaling: 0 },
      at: new Date(Date.now() - 3600_000),
    });
    const { tree } = await mount(today, deps);
    await flush();
    expect(hasText(tree, en.cards.noExport)).toBe(true); // before the Daily health time (21:00 by default) the pills are the flare and the backup
    expect(hasText(tree, en.cards.notLogged)).toBe(false);
    expect(hasText(tree, 'Chin, severity 9')).toBe(true); // one area: name, latest severity and the day it started
    await press(tree, 'Flare: Chin, severity 9 since ' + localDay(new Date(Date.now() - 3600_000).toISOString(), deps.clock.timeZone()));
    expect(mockRouter.navigate).toHaveBeenLastCalledWith({ pathname: '/review', params: { view: 'areas' } });
  });
});

describe('Today log order (UX-2, UX-5)', () => {
  it('UX-5 the log shows the newest entry first, so a just-saved entry is in view', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const deps = nowDeps();
    await logMeal(deps, { description: 'Synthetic first meal', ingredients: [], at: new Date(Date.now() - 3 * 3600_000) });
    await logMeal(deps, { description: 'Synthetic second meal', ingredients: [], at: new Date(Date.now() - 2 * 3600_000) });
    await logStool(deps, { bristol: 4, at: new Date(Date.now() - 3600_000) });
    const { tree } = await mount(() => require('@/app/(tabs)/today/index'), deps);
    await flush();
    const text = JSON.stringify(tree.toJSON());
    const at = (s: string) => text.indexOf(s);
    expect(at(en.log.stool.replace('{{n}}', '4'))).toBeLessThan(at('Synthetic second meal'));
    expect(at('Synthetic second meal')).toBeLessThan(at('Synthetic first meal'));
    jest.restoreAllMocks();
  });
  it('UX-3 scroll views leave room for the navigation header instead of sliding under it', async () => {
    const { tree } = await mount(() => require('@/app/(tabs)/review/index'), nowDeps());
    const scroll = tree.root.findAll((n) => n.props.contentInsetAdjustmentBehavior !== undefined)[0];
    expect(scroll?.props.contentInsetAdjustmentBehavior).toBe('automatic');
  });
});

describe('Today: ring, quick actions and rows (UX-2, UX-12)', () => {
  let sheet: jest.SpyInstance;
  beforeEach(() => {
    sheet = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation((_o, cb) => cb(99));
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockRouter.push.mockClear();
  });
  afterEach(() => jest.restoreAllMocks());
  const today = () => require('@/app/(tabs)/today/index');
  const dotButtons = (tree: ReactTestRenderer) =>
    tree.root.findAll(
      (n) =>
        n.props.accessibilityRole === 'button' &&
        /entries on the ring/.test(String(n.props.accessibilityLabel)) &&
        typeof n.props.onPress === 'function',
    );

  it("UX-2 an entry is a dot on the ring and a tap on the dot opens that entry's action sheet; close entries merge", async () => {
    const deps = nowDeps();
    await logMeal(deps, { description: 'Synthetic oats', ingredients: [], at: new Date(Date.now() - 3 * 3600_000) });
    await logStool(deps, { bristol: 4, at: new Date(Date.now() - 2 * 3600_000) });
    const { tree } = await mount(today, deps);
    await flush();
    expect(dotButtons(tree)).toHaveLength(2); // one per track
    await act(async () => dotButtons(tree)[0]!.props.onPress());
    await flush();
    expect(sheet).toHaveBeenCalledTimes(1);
    expect((sheet.mock.calls[0] as [{ options: string[] }])[0].options).toEqual([en.log.editAction, en.log.deleteAction, en.common.cancel]);
    await logDrink(deps, { name: 'Synthetic water', amountMl: 200, at: new Date(Date.now() - 3 * 3600_000 + 600_000) });
    const again = await mount(today, deps);
    await flush();
    expect(dotButtons(again.tree)).toHaveLength(2); // the drink merged into the meal's dot
    expect(
      hasText(again.tree, '2 entries on the ring') ||
        dotButtons(again.tree).some((n) => n.props.accessibilityLabel === '2 entries on the ring'),
    ).toBe(true);
  });

  it('UX-2 a long press on a quick action opens its full form, also for the stool tile that opens a sheet on a tap', async () => {
    const { tree } = await mount(today, nowDeps());
    await flush();
    const tile = tree.root.findAll(
      (n) => n.props.accessibilityLabel === en.entry.stool.title && typeof n.props.onLongPress === 'function',
    )[0]!;
    await act(async () => tile.props.onLongPress());
    expect(mockRouter.push).toHaveBeenLastCalledWith('/form/stool');
  });

  it('UX-2 Pin to Today is disabled at five pins', async () => {
    const edit = await mount(() => require('@/app/(tabs)/today/edit'), nowDeps());
    await flush();
    const pins = edit.tree.root.findAll(
      (n) => n.props.accessibilityLabel === `${en.home.pin} ${en.entry.drink.title}` && n.props.accessibilityState !== undefined,
    );
    expect(pins.length).toBeGreaterThan(0);
    expect(pins.every((n) => n.props.accessibilityState.disabled === true)).toBe(true);
  });

  it('UX-2 a past day shows Back to Today and no pills', async () => {
    const deps = nowDeps();
    const { tree } = await mount(today, deps);
    await flush();
    expect(hasText(tree, en.day.backToToday)).toBe(false);
    await press(tree, en.day.previous);
    expect(hasText(tree, en.day.backToToday)).toBe(true);
    expect(hasText(tree, en.cards.noExport)).toBe(false);
  });
});

describe('Today states (UX-2, UX-3)', () => {
  beforeEach(() => {
    jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation((_o, cb) => cb(99));
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockRouter.push.mockClear();
  });
  afterEach(() => jest.restoreAllMocks());
  const today = () => require('@/app/(tabs)/today/index');

  it("UX-2 a merged dot lists its entries in a sheet; a tap on one opens that entry's Edit and Delete sheet", async () => {
    const deps = nowDeps();
    const at = Date.now() - 3 * 3600_000;
    await logMeal(deps, { description: 'Synthetic oats', ingredients: [], at: new Date(at) });
    await logDrink(deps, { name: 'Synthetic water', amountMl: 200, at: new Date(at + 600_000) });
    const { tree } = await mount(today, deps);
    await flush();
    const dot = tree.root.findAll(
      (n) => n.props.accessibilityLabel === en.day.dot.replace('{{n}}', '2') && typeof n.props.onPress === 'function',
    )[0]!;
    await act(async () => dot.props.onPress());
    await flush();
    expect(ActionSheetIOS.showActionSheetWithOptions).not.toHaveBeenCalled(); // the list comes first
    expect(hasText(tree, 'Synthetic oats')).toBe(true);
    expect(hasText(tree, 'Synthetic water, 200 ml')).toBe(true);
    const row = tree.root.findAll(
      (n) => n.props.accessibilityLabel === 'Synthetic water, 200 ml' && typeof n.props.onPress === 'function',
    )[0]!;
    await act(async () => row.props.onPress());
    await flush();
    expect(ActionSheetIOS.showActionSheetWithOptions).toHaveBeenCalledTimes(1);
  });

  it('UX-3, NF-2 the stool sheet saves in one tap and the tile turns into "Saved HH:MM"', async () => {
    const deps = nowDeps();
    const { tree } = await mount(today, deps);
    await flush();
    await press(tree, en.entry.stool.title);
    expect(hasText(tree, en.stoolTypes['4'])).toBe(true);
    await press(tree, en.day.stoolType.replace('{{n}}', '4'));
    await flush();
    expect((await deps.repo.listRecords('stoolEntries')).map((s) => s.bristol)).toEqual([4]);
    expect(hasText(tree, en.sheet.saved.replace('{{time}}', ''))).toBe(true);
    await press(tree, en.day.stoolType.replace('{{n}}', '4')); // a second tap on a saved tile does nothing
    await flush();
    expect(await deps.repo.listRecords('stoolEntries')).toHaveLength(1);
  });

  it('UX-3, IN-17 a regular medication row shows its reminder, and "Taken HH:MM" after the tap', async () => {
    const deps = nowDeps();
    const item = await addRegularMedication(deps, { category: 'medication', name: 'Synthetic pill', dose: '5 mg' });
    await setRegularTimes(deps, item.id, [{ hour: 8, minute: 0 }]);
    await unpinEntryType(deps, 'stool');
    await pinEntryType(deps, 'medication');
    const { tree } = await mount(today, deps);
    await flush();
    await press(tree, en.entry.medication.title);
    expect(hasText(tree, en.sheet.reminderAt.replace('{{times}}', '08:00'))).toBe(true);
    await press(tree, 'Synthetic pill 5 mg');
    await flush();
    expect(hasText(tree, en.sheet.taken.replace('{{time}}', ''))).toBe(true);
  });
});

describe('First run (UX-1, UX-2)', () => {
  beforeEach(() => mockRouter.push.mockClear());

  it('UX-1 an empty diary shows a first-run card on Today that opens the meal form or the guide, and it goes away after the first entry', async () => {
    const deps = nowDeps();
    const { tree } = await mount(() => require('@/app/(tabs)/today/index'), deps);
    await flush();
    expect(hasText(tree, en.cards.firstRun)).toBe(true);
    await press(tree, en.cards.firstMeal);
    expect(mockRouter.push).toHaveBeenLastCalledWith('/form/meal');
    await press(tree, en.nav.guide);
    expect(mockRouter.push).toHaveBeenLastCalledWith('/guide');
    await logMeal(deps, { description: 'Synthetic oats', ingredients: [], at: new Date(Date.now() - 60_000) });
    const again = await mount(() => require('@/app/(tabs)/today/index'), deps);
    await flush();
    expect(hasText(again.tree, en.cards.firstRun)).toBe(false);
  });

  it('UX-1 an empty Review explains why and leads back to Today', async () => {
    const { tree } = await mount(() => require('@/app/(tabs)/review/index'), nowDeps());
    await flush();
    expect(hasText(tree, en.review.empty)).toBe(true);
    await press(tree, en.review.goToday);
    expect(mockRouter.navigate).toHaveBeenLastCalledWith('/today');
  });
});

describe('More: search and Edit Today (UX-2, UX-11)', () => {
  beforeEach(() => mockRouter.push.mockClear());
  it('UX-11 typing filters the entry types and the situations; a hit opens the right form', async () => {
    const more = await mount(() => require('@/app/(tabs)/today/more'), nowDeps());
    await flush();
    expect(hasText(more.tree, en.home.editToday)).toBe(true); // Edit Today lives in More
    await type(more.tree, en.more.search, 'soap');
    expect(hasText(more.tree, en.guide.items.newProduct)).toBe(true);
    expect(hasText(more.tree, en.entry.meal.hint)).toBe(false);
    await press(more.tree, en.guide.items.newProduct);
    expect(mockRouter.push).toHaveBeenLastCalledWith('/form/change');
    await type(more.tree, en.more.search, 'qqqq');
    expect(hasText(more.tree, en.more.noMatch)).toBe(true);
  });

  it('UX-2 the Edit Today row opens the editor', async () => {
    const more = await mount(() => require('@/app/(tabs)/today/more'), nowDeps());
    await flush();
    await press(more.tree, en.home.editToday);
    expect(mockRouter.push).toHaveBeenLastCalledWith('/today/edit');
  });
});

describe('Suggestion settings and quick-action layout (IN-14, UX-2, UX-6)', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('IN-14 the Suggestions screen shows the defaults and stores rows, window and save on tap', async () => {
    const deps = nowDeps();
    const { tree } = await mount(() => require('@/app/settings/suggestions'), deps);
    await flush();
    expect(hasText(tree, '5')).toBe(true);
    await press(tree, en.sugg.more);
    await press(tree, en.sugg.days.replace('{{n}}', '14'));
    await toggle(tree, en.sugg.saveOnTap);
    await flush();
    expect((await deps.repo.getPreferences())!.suggestions).toEqual({ rows: 6, windowDays: 14, saveOnTap: true, knownNames: false });
  });

  it('UX-2 Edit mode on Today has On Today and In More lists; moving an entry type changes the grid and More, nothing is hidden', async () => {
    const deps = nowDeps();
    const { tree } = await mount(() => require('@/app/(tabs)/today/index'), deps);
    await flush();
    const e = en.entry;
    const grid = () =>
      tree.root
        .findAll(
          (n) =>
            n.props.accessibilityRole === 'button' &&
            [e.meal.title, e.skin.title, e.treatment.title, e.checkin.title, e.stool.title, e.drink.title, en.home.more].includes(
              n.props.accessibilityLabel,
            ),
        )
        .map((n) => n.props.accessibilityLabel as string);
    expect([...new Set(grid())]).toEqual([e.meal.title, e.skin.title, e.treatment.title, e.checkin.title, e.stool.title, en.home.more]);
    const edit = await mount(() => require('@/app/(tabs)/today/edit'), deps); // More > Edit Today
    await flush();
    await press(edit.tree, `${en.home.moveUp} ${e.checkin.title}`);
    await press(edit.tree, `${en.home.unpin} ${e.stool.title}`);
    await press(edit.tree, `${en.home.pin} ${e.drink.title}`);
    expect(edit.tree.root.findAll((n) => n.props.accessibilityLabel === `${en.home.unpin} ${en.home.more}`)).toHaveLength(0); // More cannot be unpinned
    const again = await mount(() => require('@/app/(tabs)/today/index'), deps);
    await flush();
    const grid2 = () =>
      again.tree.root
        .findAll(
          (n) =>
            n.props.accessibilityRole === 'button' &&
            [e.meal.title, e.skin.title, e.treatment.title, e.checkin.title, e.stool.title, e.drink.title, en.home.more].includes(
              n.props.accessibilityLabel,
            ),
        )
        .map((n) => n.props.accessibilityLabel as string);
    expect([...new Set(grid2())]).toEqual([e.meal.title, e.skin.title, e.checkin.title, e.treatment.title, e.drink.title, en.home.more]);
    expect((await deps.repo.getPreferences())!.quickActions.pinned).toEqual(['meal', 'skin', 'checkin', 'treatment', 'drink']);
    const more = await mount(() => require('@/app/(tabs)/today/more'), deps);
    await flush();
    expect(hasText(more.tree, e.stool.title)).toBe(true); // moved, not hidden
    expect(hasText(more.tree, e.stool.hint)).toBe(true); // UX-11 subtitle
    expect(hasText(more.tree, e.meal.hint)).toBe(false); // pinned types are not listed
  });

  it('UX-2 the stool tile opens the quick sheet while pinned, and More opens the full form', async () => {
    const deps = nowDeps();
    const { tree } = await mount(() => require('@/app/(tabs)/today/index'), deps);
    await flush();
    mockRouter.push.mockClear();
    await press(tree, en.entry.stool.title);
    expect(hasText(tree, en.day.stoolTitle)).toBe(true);
    expect(mockRouter.push).not.toHaveBeenCalled();
    await unpinEntryType(deps, 'stool');
    const more = await mount(() => require('@/app/(tabs)/today/more'), deps);
    await flush();
    await press(more.tree, en.entry.stool.title);
    expect(mockRouter.push).toHaveBeenLastCalledWith('/form/stool');
  });
});
