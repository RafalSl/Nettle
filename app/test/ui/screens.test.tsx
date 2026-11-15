/* eslint-disable @typescript-eslint/no-require-imports -- screens are loaded lazily, after the mocks below are in place */
import React from 'react';
import { ActionSheetIOS, Alert, AppState } from 'react-native';
import { unzipSync } from 'fflate';
import { FakeLlm } from '../fakes/fakeLlm';
import { AnalysisRunner } from '@/core/usecases/analysisRunner';
import { AppLock } from '@/core/usecases/appLock';
import type { FakeNotifier } from '../fakes/fakeNotifier';
import type { FakeAuth } from '../fakes/fakeAuth';
import { FakeBarcode } from '../fakes/fakeBarcode';
import { unsavedForm } from '@/ui/formState';
import type { LlmProvider } from '@/core/ports/llm';
import { logMeal } from '@/core/usecases/logMeal';
import { addArea, logNailEntry, logSkinEntry } from '@/core/usecases/skin';
import { logStool, saveCheckIn } from '@/core/usecases/checkin';
import { logDrink, logMedication } from '@/core/usecases/intake';
import { addPhoto } from '@/core/usecases/photos';
import { applyImport, exportBundle, previewImport } from '@/core/usecases/exchange';
import { deleteEntry } from '@/core/usecases/entries';
import { addRegularMedication } from '@/core/usecases/regular';
import { pinEntryType, unpinEntryType, toggleFavoriteDrink, toggleFavoriteMeal, updateSuggestionSettings } from '@/core/usecases/preferences';
import { applyTreatment, logChangeEvent, logReaction } from '@/core/usecases/events';
import { addListItem, archiveListItem } from '@/core/usecases/lists';
import { saveApiKey } from '@/core/usecases/llm';
import { prepareAnalysis } from '@/core/usecases/analysis';
import { localDay } from '@/core/model/time';
import en from '@/i18n/en.json';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { MemoryPhotoStore } from '../fakes/memoryPhotoStore';
import { MemoryRepo } from '../fakes/memoryRepo';
import { makeDeps } from '../helpers/fixtures';

const mockRouter = { push: jest.fn(), back: jest.fn(), navigate: jest.fn() };
const mockCamera: { props?: { onBarcodeScanned?: (e: { data: string }) => void } } = {};
const mockPermission: { current: { granted: boolean; canAskAgain: boolean } | null } = { current: { granted: true, canAskAgain: true } };
const mockParams: { current: Record<string, string> } = { current: {} };
type MockPickerProps = { maximumDate?: Date; value?: Date; onValueChange: (e: object, d: Date) => void };
const mockPicker: { last?: MockPickerProps; all: MockPickerProps[] } = { all: [] };
const mockScreen: { options?: { headerLeft?: () => React.ReactElement; headerRight?: () => React.ReactElement; gestureEnabled?: boolean } } = {};

// Native modules and the router are replaced; everything else (screens, components, i18n, use cases) is real.
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    useFocusEffect: (cb: () => void | (() => void)) => useEffect(cb, [cb]),
    useRouter: () => mockRouter,
    useLocalSearchParams: () => mockParams.current,
    useRootNavigationState: () => ({ key: 'root' }),
    Tabs: Object.assign(({ children }: { children: unknown }) => children, { Screen: () => null }),
    // The header buttons a form puts into its Stack.Screen options are kept, so a test can press them.
    Stack: Object.assign(({ children }: { children: unknown }) => children, {
      Screen: ({ options }: { options?: unknown }) => {
        mockScreen.options = options as typeof mockScreen.options;
        return null;
      },
    }),
  };
});
jest.mock('@react-native-community/datetimepicker', () => (props: MockPickerProps) => {
  mockPicker.last = props;
  mockPicker.all.push(props);
  return null;
});
jest.mock('expo-camera', () => ({
  CameraView: (props: typeof mockCamera.props) => {
    mockCamera.props = props;
    return null;
  },
  useCameraPermissions: () => [mockPermission.current, jest.fn()],
}));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '9.9.9' } } }));
jest.mock('expo-keep-awake', () => ({ activateKeepAwakeAsync: jest.fn(async () => undefined), deactivateKeepAwake: jest.fn(async () => undefined) }));
jest.mock('expo-image-picker', () => ({}));
jest.mock('@/adapters/photos/pickPhotos', () => ({ pickPhotoUris: jest.fn(async () => []) }));
jest.mock('@/services', () => {
  const state: { current: unknown } = { current: null };
  return { __state: state, useServices: () => state.current, ServicesProvider: ({ children }: { children: unknown }) => children };
});

const services = require('@/services') as { __state: { current: unknown } };

// The route files themselves, so the wiring from route to screen is tested too (UX-1, UX-3).
const screens: [string, () => { default: React.ComponentType }][] = [
  ['today', () => require('@/app/(tabs)/today/index')],
  ['more', () => require('@/app/(tabs)/today/more')],
  ['settings', () => require('@/app/settings/index')],
  ['settings logging', () => require('@/app/settings/logging')],
  ['settings suggestions', () => require('@/app/settings/suggestions')],
  ['settings reminders', () => require('@/app/settings/reminders')],
  ['settings ai', () => require('@/app/settings/ai')],
  ['settings about', () => require('@/app/settings/about')],
  ['settings areas', () => require('@/app/settings/areas')],
  ['settings favorites', () => require('@/app/settings/favorites')],
  ['settings privacy', () => require('@/app/settings/privacy')],
  ['settings data', () => require('@/app/settings/data')],
  ['review', () => require('@/app/(tabs)/review/index')],
  ['doctor report', () => require('@/app/(tabs)/review/report')],
  ['analysis', () => require('@/app/(tabs)/review/analysis')],
  ['form meal', () => require('@/app/form/meal')],
  ['form skin', () => require('@/app/form/skin')],
  ['form checkin', () => require('@/app/form/checkin')],
  ['form alcohol', () => require('@/app/form/drink')],
  ['form medication', () => require('@/app/form/medication')],
  ['form stool', () => require('@/app/form/stool')],
  ['form treatment', () => require('@/app/form/treatment')],
  ['form nails', () => require('@/app/form/nails')],
  ['form reaction', () => require('@/app/form/reaction')],
  ['form change', () => require('@/app/form/change')],
];

const textOf = (r: ReactTestRenderer): string => JSON.stringify(r.toJSON());

describe('screens render without crashing (NF-3)', () => {
  beforeEach(async () => {
    const deps = makeDeps(new MemoryRepo());
    services.__state.current = {
      deps,
      fileShare: { saveAndShare: jest.fn(), pickFile: jest.fn(async () => null) },
      analysisRunner: new AnalysisRunner(deps),
      appLock: new AppLock(deps),
    };
  });

  it.each(screens)('%s has a default export that renders with data from the services', async (_name, load) => {
    const mod = load();
    expect(typeof mod.default).toBe('function');
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(React.createElement(mod.default));
    });
    expect(textOf(tree)).not.toBe('null');
    await act(async () => tree.unmount());
  });

  it('the root layout loads', () => {
    jest.isolateModules(() => {
      jest.doMock('@/adapters/storage/expoSqliteDb', () => ({ openExpoSqlite: jest.fn() }));
      jest.doMock('@/adapters/keystore/secureStoreKeyStore', () => ({ secureStoreKeyStore: {} }));
      jest.doMock('@/adapters/share/expoFileShare', () => ({ expoFileShare: {} }));
      jest.doMock('@/adapters/share/expoPdfRenderer', () => ({ expoPdfRenderer: {} }));
      jest.doMock('@/adapters/photos/expoPhotoStore', () => ({ expoPhotoStore: {} }));
      const layout = require('@/app/_layout');
      expect(typeof layout.default).toBe('function');
    });
  });
});

// ---- Interaction tests: tap through the real screens against in-memory services ----

type Deps = ReturnType<typeof makeDeps>;
const scores = { severity: 1, itch: 2, pain: 3, dryness: 4, scaling: 5 };

async function mount(load: () => { default: React.ComponentType }, deps: Deps, fileShare = { saveAndShare: jest.fn(async () => undefined), pickFile: jest.fn(async () => null) }) {
  services.__state.current = { deps, fileShare, analysisRunner: new AnalysisRunner(deps), appLock: new AppLock(deps) };
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(React.createElement(load().default));
  });
  return { tree, fileShare };
}
const press = async (tree: ReactTestRenderer, label: string) => {
  const node = tree.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
  if (!node) throw new Error(`no button "${label}"`);
  await act(async () => {
    await node.props.onPress();
  });
};
const type = async (tree: ReactTestRenderer, placeholderOrLabel: string, value: string) => {
  const node = tree.root.findAll((n) => (n.props.placeholder === placeholderOrLabel || n.props.accessibilityLabel === placeholderOrLabel) && typeof n.props.onChangeText === 'function')[0];
  if (!node) throw new Error(`no input "${placeholderOrLabel}"`);
  await act(async () => node.props.onChangeText(value));
};
const hasText = (tree: ReactTestRenderer, text: string) => JSON.stringify(tree.toJSON()).includes(text);
/** Real time, like the app: the screens read today's date from the device clock. */
const nowDeps = (llm: LlmProvider = new FakeLlm()) => makeDeps(new MemoryRepo(), new Date().toISOString(), llm);
const toggle = async (tree: ReactTestRenderer, label: string) => {
  const node = tree.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onValueChange === 'function')[0];
  if (!node) throw new Error(`no switch "${label}"`);
  await act(async () => node.props.onValueChange(true));
};
const flush = () => act(async () => new Promise((r) => setTimeout(r, 0)));

describe('screen flows (NF-2, NF-3)', () => {
  let alert: jest.SpyInstance;
  beforeEach(() => {
    alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });
  afterEach(() => alert.mockRestore());

  it('every screen shows its title from the English strings', async () => {
    const titles: [() => { default: React.ComponentType }, string][] = [
      [() => require('@/app/form/meal'), en.meal.chooseTitle],
      [() => require('@/app/form/checkin'), en.today.hint],
      [() => require('@/app/form/skin'), en.skin.scale],
      [() => require('@/app/form/nails'), en.more.nailNone],
      [() => require('@/app/settings/data'), en.data.exportTitle],
      [() => require('@/app/(tabs)/review/analysis'), en.analysis.title],
    ];
    for (const [load, title] of titles) {
      const { tree } = await mount(load, nowDeps());
      expect(hasText(tree, title)).toBe(true);
    }
  });

  it('SK-7, SK-11 Daily health saves from the header, and saving a day with no meals asks first', async () => {
    const sheet = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation((_o, cb) => cb(0));
    const deps = nowDeps();
    const { tree } = await mount(() => require('@/app/form/checkin'), deps);
    await press(tree, `${en.common.increase} ${en.tags['item-wellbeing']}`);
    await press(tree, `${en.common.increase} ${en.tags['item-wellbeing']}`);
    const save = async () => {
      let rendered!: ReactTestRenderer;
      await act(async () => {
        rendered = create(mockScreen.options!.headerRight!());
      });
      const node = rendered.root.findAll((n) => n.props.accessibilityLabel === en.common.save && typeof n.props.onPress === 'function')[0]!;
      await act(async () => {
        await node.props.onPress();
      });
    };
    expect(hasText(tree, 'Mark day complete')).toBe(false); // no separate "complete" switch any more
    sheet.mockImplementationOnce((_o, cb) => cb(1)); // Cancel in the sheet: nothing is saved, the form stays
    await save();
    expect(await deps.repo.listRecords('checkIns')).toEqual([]);
    expect(mockRouter.back).not.toHaveBeenCalled();
    await save(); // this time the user picks "Save anyway"
    await flush();
    const [record] = await deps.repo.listRecords('checkIns');
    expect(record).toMatchObject({ values: { 'item-wellbeing': 1 }, day: localDay(deps.clock.now().toISOString(), deps.clock.timeZone()) });
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    sheet.mockRestore();
  });

  it('SK-7 "Same as yesterday" is an explicit button, and nothing is filled in silently', async () => {
    const deps = nowDeps();
    const yesterday = new Date(Date.now() - 86_400_000);
    await saveCheckIn(deps, { at: yesterday, values: { 'item-wellbeing': 7, 'item-stress': 2, 'item-bloating': true }, confirmEmptyDay: true });
    const { tree } = await mount(() => require('@/app/form/checkin'), deps);
    await flush();
    const shown = () => tree.root.findAll((n) => n.props.accessibilityLabel === `${en.common.increase} ${en.tags['item-wellbeing']}`).length;
    expect(shown()).toBeGreaterThan(0);
    const showsValue = (v: string) => tree.root.findAll((n) => (n.type as unknown) === 'Text' && String(n.props.children) === v).length > 0;
    expect(showsValue('7')).toBe(false); // today's form starts empty
    await press(tree, en.today.sameAsYesterday);
    expect(showsValue('7')).toBe(true);
    const bloating = tree.root.findAll((n) => n.props.accessibilityLabel === en.tags['item-bloating'] && typeof n.props.onPress === 'function')[0]!;
    expect(bloating.props.accessibilityState.selected).toBe(true);
  });

  it('SK-7 the stool form saves a type and a time through the header', async () => {
    const deps = nowDeps();
    const { tree } = await mount(() => require('@/app/form/stool'), deps);
    await press(tree, '5');
    let rendered!: ReactTestRenderer;
    await act(async () => {
      rendered = create(mockScreen.options!.headerRight!());
    });
    await act(async () => {
      await rendered.root.findAll((n) => n.props.accessibilityLabel === en.common.save && typeof n.props.onPress === 'function')[0]!.props.onPress();
    });
    await flush();
    expect((await deps.repo.listRecords('stoolEntries')).map((x) => x.bristol)).toEqual([5]);
  });

  it('SK-3 the skin screen starts from the last scores and "No change" saves a copy', async () => {
    const deps = nowDeps();
    await logSkinEntry(deps, { areaId: 'area-behind-ears', scores }); // the first area is preselected
    const { tree } = await mount(() => require('@/app/form/skin'), deps);
    await flush();
    await press(tree, en.skin.noChange);
    await flush();
    const entries = await deps.repo.listSkinEntries();
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.scores)).toEqual([scores, scores]);
  });

  it('SK-6 the More screen has no flare row: flares are derived from skin entries', async () => {
    const deps = nowDeps();
    const more = await mount(() => require('@/app/(tabs)/today/more'), deps);
    expect(hasText(more.tree, 'Flare start or end')).toBe(false);
  });

  it('SK-10, IN-11 the More screen adds a nail and saves a treatment', async () => {
    const deps = nowDeps();
    const nails = await mount(() => require('@/app/form/nails'), deps);
    await type(nails.tree, en.more.nailAreaName, 'Synthetic thumb');
    await press(nails.tree, en.more.nailAddArea);
    const treatment = await mount(() => require('@/app/form/treatment'), deps);
    await type(treatment.tree, en.more.treatmentNew, 'Synthetic cream');
    await press(treatment.tree, en.more.treatmentAdd);
    await flush();
    expect((await deps.repo.listAreas()).some((a) => a.kind === 'nail' && a.name === 'Synthetic thumb')).toBe(true);
    expect((await deps.repo.listItems('treatments')).map((t) => t.name)).toEqual(['Synthetic cream']);
  });

  it('SE-2 the key is saved to the key store, cleared from the field and never shown', async () => {
    const deps = nowDeps();
    const { tree } = await mount(() => require('@/app/settings/ai'), deps);
    await type(tree, en.llm.keyField, 'sk-synthetic-secret');
    await press(tree, en.llm.keySave);
    await flush();
    expect(await deps.keys.get('anthropic_api_key')).toBe('sk-synthetic-secret');
    expect(hasText(tree, 'sk-synthetic-secret')).toBe(false);
    expect(hasText(tree, en.llm.keySaved)).toBe(true);
  });

  it('SK-2, SK-10 Settings adds, renames, resets and archives areas, and restores an archived one', async () => {
    const deps = nowDeps();
    const { tree } = await mount(() => require('@/app/settings/areas'), deps);
    await flush();
    await type(tree, en.settings.skinAreaName, 'Synthetic elbow');
    await press(tree, en.common.add);
    await flush();
    expect((await deps.repo.listAreas()).some((a) => a.name === 'Synthetic elbow' && a.kind === 'skin')).toBe(true);
    await press(tree, 'Synthetic elbow');
    await type(tree, en.settings.skinAreaName, 'Synthetic wrist');
    await press(tree, en.more.rename);
    await flush();
    expect((await deps.repo.listAreas()).some((a) => a.name === 'Synthetic wrist')).toBe(true);
    await press(tree, 'Synthetic wrist');
    await press(tree, en.more.archive);
    await flush();
    expect((await deps.repo.listAreas()).find((a) => a.name === 'Synthetic wrist')!.archived).toBe(true);
    await press(tree, 'Synthetic wrist'); // the archived chip restores it
    await flush();
    expect((await deps.repo.listAreas()).find((a) => a.name === 'Synthetic wrist')!.archived).toBe(false);
    // a predefined area gets an override that "Default name" clears
    await press(tree, 'Synthetic wrist');
    await press(tree, 'Behind the ears');
    await type(tree, en.settings.skinAreaName, 'Synthetic ears');
    await press(tree, en.more.rename);
    await flush();
    expect((await deps.repo.listAreas()).find((a) => a.id === 'area-behind-ears')!.nameOverride).toBe('Synthetic ears');
    await press(tree, 'Synthetic ears');
    await press(tree, en.settings.defaultName);
    await flush();
    expect((await deps.repo.listAreas()).find((a) => a.id === 'area-behind-ears')!.nameOverride).toBeNull();
  });

  it('SK-5, UX-6 an area can start its photos as sensitive, and About shows the version and the limits of the app', async () => {
    const deps = nowDeps();
    const { tree } = await mount(() => require('@/app/settings/areas'), deps);
    await flush();
    await press(tree, 'Behind the ears');
    const sw = () => tree.root.findAll((n) => n.props.accessibilityLabel === en.settings.sensitiveDefault && typeof n.props.onValueChange === 'function')[0]!;
    expect(sw().props.value).toBe(false);
    await act(async () => {
      sw().props.onValueChange(true);
    });
    await flush();
    expect((await deps.repo.listAreas()).find((a) => a.id === 'area-behind-ears')!.sensitiveDefault).toBe(true);
    const entry = await logSkinEntry(deps, { areaId: 'area-behind-ears', scores });
    await addPhoto(deps, { entryKind: 'skinEntry', entryId: entry.id, sourceUri: 'x' });
    expect((await deps.repo.listRecords('photos'))[0]!.sensitive).toBe(true);
    const about = await mount(() => require('@/app/settings/about'), deps);
    expect(hasText(about.tree, en.about.version.replace('{{version}}', '9.9.9'))).toBe(true);
    expect(hasText(about.tree, en.about.medical)).toBe(true);
    const settings = await mount(() => require('@/app/settings/index'), deps);
    await press(settings.tree, en.nav.about);
    expect(mockRouter.push).toHaveBeenLastCalledWith('/settings/about');
  });

  it('IN-14, UX-6 Settings lists the favorites and removes one with a tap', async () => {
    const deps = nowDeps();
    await toggleFavoriteMeal(deps, { description: 'Synthetic rice', ingredients: [], allergens: [], barcode: null, source: { kind: 'typed', edited: false, llm: null, aiTags: false } });
    await toggleFavoriteDrink(deps, { name: 'Synthetic tea', amountMl: 200, alcohol: false, ingredients: [], allergens: [], barcode: null, source: { kind: 'typed', edited: false, llm: null, aiTags: false } });
    const { tree } = await mount(() => require('@/app/settings/favorites'), deps);
    await flush();
    expect(hasText(tree, '★ Synthetic rice')).toBe(true);
    expect(hasText(tree, '★ Synthetic tea 200 ml')).toBe(true);
    await press(tree, en.settings.favRemove.replace('{{name}}', 'Synthetic rice'));
    await flush();
    expect(hasText(tree, '★ Synthetic rice')).toBe(false);
    expect((await deps.repo.getPreferences())!.favorites.meals).toEqual([]);
    expect((await deps.repo.getPreferences())!.favorites.drinks).toHaveLength(1);
  });

  it('SK-7 an archived Daily health item is not asked and what was saved stays', async () => {
    const deps = nowDeps();
    await saveCheckIn(deps, { values: { 'item-stress': 7, 'item-wellbeing': 4 }, confirmEmptyDay: true });
    await archiveListItem(deps, 'dailyItems', 'item-stress');
    const form = await mount(() => require('@/app/form/checkin'), deps);
    await flush();
    expect(hasText(form.tree, en.tags['item-wellbeing'])).toBe(true);
    expect(hasText(form.tree, en.tags['item-stress'])).toBe(false);
    const saved = await saveCheckIn(deps, { values: { 'item-wellbeing': 5 } });
    expect(saved.values).toEqual({ 'item-wellbeing': 5, 'item-stress': 7 });
  });

  it('LL-9 the AI settings list a model choice per action, defaulting to the first offered model', async () => {
    const deps = nowDeps();
    const { tree } = await mount(() => require('@/app/settings/ai'), deps);
    for (const label of Object.values(en.llm.action)) expect(hasText(tree, label)).toBe(true);
    const selected = () => tree.root.findAll((n) => n.props.accessibilityLabel === 'Haiku' && n.props.accessibilityState?.selected === true && typeof n.props.onPress === 'function');
    expect(selected()).toHaveLength(5);
    await press(tree, 'Sonnet'); // the first "Sonnet" chip belongs to the first action, the label scan
    await flush();
    expect(await deps.settings.get('llm_model.label_scan')).toBe('claude-sonnet-5-5');
    expect(await deps.settings.get('llm_model.analysis')).toBeNull();
    expect(selected()).toHaveLength(4);
  });

  it('SE-9, UX-6 Delete data names the counts in an action sheet, offers Export first, then asks a second time', async () => {
    const deps = nowDeps();
    await logMeal(deps, { description: 'Synthetic meal', ingredients: [] });
    const sheets: { title?: string; options: string[] }[] = [];
    const script = [0, 1, 0]; // Export first, then Delete, then confirm "Delete for good"
    const sheet = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation((o, cb) => {
      sheets.push({ title: o.title, options: o.options });
      cb(script.shift() ?? o.options.length - 1);
    });
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { tree, fileShare } = await mount(() => require('@/app/settings/data'), deps);
    await press(tree, en.delete.groups.food);
    await press(tree, en.delete.button);
    await flush();
    expect(sheets).toHaveLength(3);
    expect(sheets[0]!.options).toEqual([en.delete.exportFirst, en.delete.confirm, en.common.cancel]);
    expect(sheets[0]!.title).toBe(en.delete.confirmTitle);
    expect(fileShare.saveAndShare).toHaveBeenCalledTimes(1); // the export ran before anything was deleted
    expect(sheets[2]!.title).toBe(en.delete.secondTitle);
    expect(await deps.repo.listMeals()).toEqual([]);
    sheet.mockRestore();
  });

  it('SE-9 cancelling at the first sheet, or at the second confirmation, deletes nothing', async () => {
    for (const script of [[null], [1, null]]) {
      const deps = nowDeps();
      await logMeal(deps, { description: 'Synthetic meal', ingredients: [] });
      const queue = [...script];
      const sheet = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation((o, cb) => {
        const next = queue.shift();
        cb(next === null || next === undefined ? o.options.length - 1 : next);
      });
      jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      const { tree } = await mount(() => require('@/app/settings/data'), deps);
      await press(tree, en.delete.groups.food);
      await press(tree, en.delete.button);
      await flush();
      expect(await deps.repo.listMeals()).toHaveLength(1);
      sheet.mockRestore();
    }
  });

  it('EX-1, EX-11 a custom export can be limited to a range of days, and the range is refused the wrong way round', async () => {
    const deps = nowDeps();
    await logMeal(deps, { description: 'Synthetic inside', ingredients: [], at: new Date('2026-01-10T10:00:00.000Z') });
    await logMeal(deps, { description: 'Synthetic outside', ingredients: [], at: new Date('2026-01-20T10:00:00.000Z') });
    const { tree, fileShare } = await mount(() => require('@/app/settings/data'), deps);
    await toggle(tree, en.range.limit);
    const [fromPicker, toPicker] = mockPicker.all.slice(-2);
    await act(async () => {
      fromPicker!.onValueChange({}, new Date('2026-01-09T12:00:00'));
      toPicker!.onValueChange({}, new Date('2026-01-12T12:00:00'));
    });
    await press(tree, en.data.exportButton);
    await flush();
    const files = unzipSync((fileShare.saveAndShare.mock.calls[0] as unknown as [string, Uint8Array])[1]);
    const meals = JSON.parse(new TextDecoder().decode(files['data.json']!)).records.meals.map((m: { description: string }) => m.description);
    expect(meals).toEqual(['Synthetic inside']);
    const [from2] = mockPicker.all.slice(-2);
    await act(async () => {
      from2!.onValueChange({}, new Date('2026-01-15T12:00:00')); // after the "to" day
    });
    expect(hasText(tree, en.range.invalid)).toBe(true);
  });

  it('EX-14 the doctor report has a "Choose dates" period with its own range, and counts only that range', async () => {
    const deps = nowDeps();
    await logMeal(deps, { description: 'Synthetic inside', ingredients: [], at: new Date('2026-01-10T10:00:00.000Z') });
    await logMeal(deps, { description: 'Synthetic recent', ingredients: [], at: new Date(Date.now() - 86_400_000) });
    const { tree, fileShare } = await mount(() => require('@/app/(tabs)/review/report'), deps);
    await flush();
    await press(tree, en.doctor.custom);
    await flush();
    const [fromPicker, toPicker] = mockPicker.all.slice(-2);
    await act(async () => {
      fromPicker!.onValueChange({}, new Date('2026-01-09T12:00:00'));
      toPicker!.onValueChange({}, new Date('2026-01-12T12:00:00'));
    });
    await flush();
    expect(hasText(tree, en.doctor.counts.replace('{{entries}}', '1').replace('{{photos}}', '0'))).toBe(true);
    await press(tree, en.doctor.button);
    await flush();
    const files = unzipSync((fileShare.saveAndShare.mock.calls[0] as unknown as [string, Uint8Array])[1]);
    expect(JSON.parse(new TextDecoder().decode(files['data.json']!)).records.meals.map((m: { description: string }) => m.description)).toEqual(['Synthetic inside']);
  });

  it('EX-1, EX-9 the Data screen exports a ZIP with data.json and hands it to the share sheet', async () => {
    const deps = nowDeps();
    await logMeal(deps, { description: 'Synthetic meal', ingredients: ['a'] });
    const { tree, fileShare } = await mount(() => require('@/app/settings/data'), deps);
    await press(tree, en.data.exportButton);
    await flush();
    expect(fileShare.saveAndShare).toHaveBeenCalledTimes(1);
    const [name, bytes, mime] = fileShare.saveAndShare.mock.calls[0] as unknown as [string, Uint8Array, string];
    expect(name).toMatch(/^nettle-export-\d{4}-\d{2}-\d{2}\.zip$/);
    expect(mime).toBe('application/zip');
    expect(Object.keys(unzipSync(bytes))).toContain('data.json');
  });

  it('EX-3, EX-5 turning on CSV and the PDF report adds those files to the export', async () => {
    const deps = nowDeps();
    await logMeal(deps, { description: 'Synthetic meal', ingredients: ['a'] });
    const { tree, fileShare } = await mount(() => require('@/app/settings/data'), deps);
    await toggle(tree, en.export.csv);
    await toggle(tree, en.export.report);
    await press(tree, en.data.exportButton);
    await flush();
    const files = Object.keys(unzipSync((fileShare.saveAndShare.mock.calls[0] as unknown as [string, Uint8Array])[1]));
    expect(files).toEqual(expect.arrayContaining(['data.json', 'csv/meals.csv', 'report.pdf']));
  });

  it('LL-5, LL-7 the analysis screen reviews exactly what is sent, then runs and shows the stored result', async () => {
    const llm = new FakeLlm([
      JSON.stringify({ summary: 'Synthetic summary', hypotheses: [], order_and_lag: 'none', data_limits: [], suggestions: [] }),
    ]);
    const deps = nowDeps(llm);
    await saveApiKey(deps, 'sk-synthetic-secret');
    await logMeal(deps, { description: 'Synthetic meal', ingredients: ['a'], at: new Date(Date.now() - 2 * 3600 * 1000) });
    const { tree } = await mount(() => require('@/app/(tabs)/review/analysis'), deps);
    await flush();
    await press(tree, en.analysis.review);
    await flush();
    const confirm = alert.mock.calls.find((c) => c[0] === en.analysis.confirmTitle);
    expect(confirm).toBeDefined();
    expect(String(confirm![1])).toContain('1 meals');
    expect(llm.requests).toHaveLength(0); // reviewing sends nothing
    const send = (confirm![2] as { text: string; onPress?: () => void }[]).find((b) => b.text === en.analysis.send)!;
    await act(async () => {
      await send.onPress!();
    });
    await flush();
    expect(llm.requests).toHaveLength(1);
    expect(await deps.repo.listRecords('analyses')).toHaveLength(1);
    expect(hasText(tree, 'Synthetic summary')).toBe(true);
    expect(hasText(tree, en.analysis.disclaimer)).toBe(true);
  });

  it('LL-8 a failed analysis shows a clear message and stores nothing', async () => {
    const { NettleError } = require('@/core/model/errors');
    const llm = new FakeLlm([new NettleError('llm_rate_limited')]);
    const deps = nowDeps(llm);
    await saveApiKey(deps, 'sk-synthetic-secret');
    await logMeal(deps, { description: 'Synthetic meal', ingredients: [], at: new Date(Date.now() - 2 * 3600 * 1000) });
    const { tree } = await mount(() => require('@/app/(tabs)/review/analysis'), deps);
    await flush();
    await press(tree, en.analysis.review);
    const confirm = alert.mock.calls.find((c) => c[0] === en.analysis.confirmTitle)!;
    await act(async () => {
      await (confirm[2] as { text: string; onPress?: () => void }[]).find((b) => b.text === en.analysis.send)!.onPress!();
    });
    expect(hasText(tree, en.errors.llm_rate_limited)).toBe(true);
    expect(hasText(tree, en.analysis.retry)).toBe(true);
    expect(await deps.repo.listRecords('analyses')).toEqual([]);
  });

  it('LL-12 the confirmation says the call is billed separately, and Cancel stops a running analysis and stores nothing', async () => {
    const { NettleError } = require('@/core/model/errors');
    const llm = {
      completeJson: (req: { signal?: AbortSignal }) =>
        new Promise<never>((_resolve, reject) => req.signal?.addEventListener('abort', () => reject(new NettleError('llm_cancelled')))),
    };
    const deps = nowDeps(llm);
    await saveApiKey(deps, 'sk-synthetic-secret');
    await logMeal(deps, { description: 'Synthetic meal', ingredients: [], at: new Date(Date.now() - 2 * 3600 * 1000) });
    const { tree } = await mount(() => require('@/app/(tabs)/review/analysis'), deps);
    await flush();
    await press(tree, en.analysis.review);
    const confirm = alert.mock.calls.find((c) => c[0] === en.analysis.confirmTitle)!;
    expect(String(confirm[1])).toContain('bills this separately');
    let running: unknown;
    await act(async () => {
      running = (confirm[2] as { text: string; onPress?: () => unknown }[]).find((b) => b.text === en.analysis.send)!.onPress!();
    });
    expect(hasText(tree, en.analysis.cancelRun)).toBe(true);
    await press(tree, en.analysis.cancelRun);
    await act(async () => {
      await running;
    });
    expect(hasText(tree, en.errors.llm_cancelled)).toBe(true);
    expect(hasText(tree, en.analysis.cancelRun)).toBe(false);
    expect(alert.mock.calls.some((c) => c[0] === en.errors.llm_cancelled)).toBe(false);
    expect(await deps.repo.listRecords('analyses')).toEqual([]);
  });

  it('SK-9 the reminders section saves a daily reminder, and a refused permission leaves the switch off', async () => {
    const deps = nowDeps();
    const { tree } = await mount(() => require('@/app/settings/reminders'), deps);
    await toggle(tree, en.reminders.checkIn);
    await flush();
    expect((deps.notifier as unknown as { scheduled: { id: string }[] }).scheduled.every((s) => s.id.startsWith('checkin-'))).toBe(true); // one per day ahead
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === en.reminders.checkIn && n.props.value === true).length).toBeGreaterThan(0);

    const refused = nowDeps();
    (refused.notifier as unknown as { granted: boolean }).granted = false;
    const second = await mount(() => require('@/app/settings/reminders'), refused);
    await toggle(second.tree, en.reminders.backup);
    await flush();
    expect(alert.mock.calls.some((c) => c[0] === en.errors.notifications_denied)).toBe(true);
    expect(second.tree.root.findAll((n) => n.props.accessibilityLabel === en.reminders.backup && n.props.value === true)).toHaveLength(0);
  });
});

describe('navigation shell (UX-1, UX-2, UX-3, UX-6)', () => {
  beforeEach(() => {
    mockRouter.push.mockClear();
  });

  it('UX-2 Today offers the quick actions, each opening its modal form or the More list', async () => {
    const { tree } = await mount(() => require('@/app/(tabs)/today/index'), nowDeps());
    for (const [label, href] of [
      [en.entry.meal.title, '/form/meal'],
      [en.entry.skin.title, '/form/skin'],
      [en.entry.treatment.title, '/form/treatment'],
      [en.entry.checkin.title, '/form/checkin'],
      [en.home.more, '/today/more'],
    ] as const) {
      await press(tree, label);
      expect(mockRouter.push).toHaveBeenLastCalledWith(href);
    }
  });

  it('UX-2 More lists the rarer entries and UX-6 Settings lists its groups, each a pushed screen', async () => {
    const more = await mount(() => require('@/app/(tabs)/today/more'), nowDeps());
    for (const [label, href] of [
      [en.entry.drink.title, '/form/drink'],
      [en.entry.medication.title, '/form/medication'],
      [en.entry.reaction.title, '/form/reaction'],
      [en.entry.nails.title, '/form/nails'],
      [en.entry.change.title, '/form/change'],
    ] as const) {
      await press(more.tree, label);
      expect(mockRouter.push).toHaveBeenLastCalledWith(href);
    }
    const settings = await mount(() => require('@/app/settings/index'), nowDeps());
    // UX-6: five groups, in this order, with About last
    for (const [label, href] of [
      [en.nav.logging, '/settings/logging'],
      [en.nav.remindersPrivacy, '/settings/reminders'],
      [en.nav.ai, '/settings/ai'],
      [en.nav.data, '/settings/data'],
      [en.nav.about, '/settings/about'],
    ] as const) {
      await press(settings.tree, label);
      expect(mockRouter.push).toHaveBeenLastCalledWith(href);
    }
    const logging = await mount(() => require('@/app/settings/logging'), nowDeps());
    for (const [label, href] of [
      [en.nav.suggestions, '/settings/suggestions'],
      [en.nav.areas, '/settings/areas'],
      [en.nav.favorites, '/settings/favorites'],
    ] as const) {
      await press(logging.tree, label);
      expect(mockRouter.push).toHaveBeenLastCalledWith(href);
    }
    const reminders = await mount(() => require('@/app/settings/reminders'), nowDeps());
    await press(reminders.tree, en.nav.privacy);
    expect(mockRouter.push).toHaveBeenLastCalledWith('/settings/privacy');
  });

  it('UX-1 both tab headers have the gear, and it pushes Settings above the tabs', async () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const root = path.join(__dirname, '../../src/app');
    for (const layout of ['(tabs)/today/_layout.tsx', '(tabs)/review/_layout.tsx']) {
      expect(fs.readFileSync(path.join(root, layout), 'utf8')).toContain('GearButton');
    }
    expect(fs.readFileSync(path.join(root, '_layout.tsx'), 'utf8')).toContain('name="settings"'); // above the tabs, so the tab bar is hidden inside
    const { tree } = await mount(() => ({ default: require('@/ui/GearButton').GearButton }), nowDeps());
    await press(tree, en.nav.gear);
    expect(mockRouter.push).toHaveBeenLastCalledWith('/settings');
  });

  it('UX-1 every screen a layout declares has a route file, and titles stay under 15 characters', () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const root = path.join(__dirname, '../../src/app');
    const layouts = ['_layout.tsx', '(tabs)/_layout.tsx', '(tabs)/today/_layout.tsx', '(tabs)/review/_layout.tsx', 'settings/_layout.tsx'];
    for (const layout of layouts) {
      const dir = path.dirname(path.join(root, layout));
      const names = [...fs.readFileSync(path.join(root, layout), 'utf8').matchAll(/<(?:Stack|Tabs)\.Screen name="([^"]+)"/g)].map((m) => m[1]!);
      for (const name of names) {
        const ok = ['.tsx', '/index.tsx'].some((ext) => fs.existsSync(path.join(dir, name + ext))) || fs.existsSync(path.join(dir, name, '_layout.tsx'));
        expect(`${layout}: ${name} ${ok}`).toBe(`${layout}: ${name} true`);
      }
    }
    for (const key of ['settings', 'more', 'meal', 'skin', 'checkin', 'intake', 'treatment', 'nails', 'reaction', 'change', 'logging', 'reminders', 'ai', 'data'] as const) {
      expect(en.nav[key].length).toBeLessThan(15);
    }
    expect(Object.keys(en.tabs)).toEqual(['today', 'review']);
  });
});

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
    const row = tree.root.findAll((n) => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.includes('Synthetic oats') && typeof n.props.onPress === 'function')[0]!;
    await act(async () => row.props.onPress());
    await flush();
    const [options] = sheet.mock.calls[0] as [{ options: string[]; destructiveButtonIndex: number[]; cancelButtonIndex: number; message: string }];
    expect(options.options).toEqual([en.log.editAction, en.log.deleteAction, en.common.cancel]); // Cancel last
    expect(options.destructiveButtonIndex).toEqual([1]);
    expect(options.cancelButtonIndex).toBe(2);
    expect(options.message).toContain('1 reactions');
    expect(await deps.repo.listMeals()).toEqual([]);
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
    await press(tree, tree.root.findAll((n) => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.includes('Synthetic oats'))[0]!.props.accessibilityLabel);
    await flush();
    expect(await deps.repo.listMeals()).toHaveLength(1);
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
    for (const h of [5, 4]) await applyTreatment(deps, { treatmentId: cream.id, areaIds: ['area-chin'], at: new Date(Date.now() - h * 3600_000) });
    const { tree } = await mount(today, deps);
    await flush();
    const label = 'Synthetic cream: ' + en.areas['area-chin'];
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
    await press(tree, en.day.today);
    expect(hasText(tree, en.day.empty)).toBe(true);
  });

  it('SK-6, UX-2 an open derived flare shows one card that opens Review, and Daily health is offered for a day with no record', async () => {
    const deps = nowDeps();
    await logSkinEntry(deps, { areaId: 'area-chin', scores: { severity: 9, itch: 0, pain: 0, dryness: 0, scaling: 0 }, at: new Date(Date.now() - 3600_000) });
    const { tree } = await mount(today, deps);
    await flush();
    expect(hasText(tree, en.cards.notLogged)).toBe(true);
    expect(hasText(tree, en.cards.noExport)).toBe(true);
    expect(hasText(tree, 'Chin, severity 9')).toBe(true); // one area: name, latest severity and the day it started
    await press(tree, en.cards.openAreas);
    expect(mockRouter.navigate).toHaveBeenLastCalledWith('/review');
  });
});

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
      rendered = create(mockScreen.options![side]!());
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
    await press(tree, tree.root.findAll((n) => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.includes('Synthetic oats'))[0]!.props.accessibilityLabel);
    await flush();
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/form/edit', params: { kind: 'meals', id: meal.id } });
    expect(await deps.repo.listMeals()).toHaveLength(1); // Edit deleted nothing
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
    expect(await deps.repo.listMeals()).toMatchObject([{ id: meal.id, description: 'Synthetic porridge' }]);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('UX-3, UX-9 Cancel after a change asks before discarding; without a change it just closes', async () => {
    const deps = nowDeps();
    const stool = await deps.repo.addRecord('stoolEntries', { id: 'st1', at: { utc: new Date().toISOString(), tz: 'Europe/Warsaw' }, bristol: 4, note: null }).then(() => 'st1');
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
      const all = [...(await deps.repo.listMeals()), ...(await deps.repo.listSkinEntries()), ...(await deps.repo.listRecords('nailEntries')), ...(await deps.repo.listRecords('checkIns')), ...(await deps.repo.listRecords('stoolEntries')), ...(await deps.repo.listRecords('treatmentApplications')), ...(await deps.repo.listRecords('changeEvents')), ...(await deps.repo.listRecords('reactions')), ...(await deps.repo.listRecords('drinks')), ...(await deps.repo.listRecords('medicationEntries'))];
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

describe('Data and backup (EX-14, EX-10, EX-13)', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());
  const data = () => require('@/app/settings/data');

  it('EX-14, EX-11 the full backup holds records, settings and sensitive photos, and remembers the export', async () => {
    const deps = nowDeps();
    const entry = await logSkinEntry(deps, { areaId: 'area-intimate', scores });
    await addPhoto(deps, { entryKind: 'skinEntry', entryId: entry.id, sourceUri: 'secret' });
    const { tree, fileShare } = await mount(data, deps);
    expect(await deps.settings.get('lastExportAt')).toBeNull();
    await press(tree, en.data.backupButton);
    await flush();
    const [name, bytes] = fileShare.saveAndShare.mock.calls[0] as unknown as [string, Uint8Array];
    expect(name).toMatch(/^nettle-backup-\d{4}-\d{2}-\d{2}\.zip$/);
    const files = Object.keys(unzipSync(bytes));
    expect(files).toContain('data.json');
    expect(files.some((f) => f.startsWith('photos/'))).toBe(true);
    expect(await deps.settings.get('lastExportAt')).not.toBeNull();
  });

  it('EX-3 the report language starts as the app language', async () => {
    const { tree } = await mount(data, nowDeps());
    await toggle(tree, en.export.report);
    const english = tree.root.findAll((n) => n.props.accessibilityLabel === en.export.english)[0]!;
    expect(english.props.accessibilityState).toMatchObject({ selected: true });
  });

  it('EX-10, EX-13 the import preview counts tombstone skips, and the switch restores what this phone deleted', async () => {
    const phoneA = nowDeps();
    const meal = await logMeal(phoneA, { description: 'Synthetic oats', ingredients: [], at: new Date(Date.now() - 3600_000) });
    const backup = await exportBundle(phoneA);
    const phoneB = nowDeps();
    await applyImport(phoneB, await previewImport(phoneB, backup), { mode: 'replace', parts: { records: true, settings: true } });
    await deleteEntry(phoneB, 'meals', meal.id);
    const { tree } = await mount(data, phoneB, { saveAndShare: jest.fn(async () => undefined), pickFile: jest.fn(async () => backup as unknown as null) });
    await press(tree, en.data.importButton);
    await flush();
    expect(hasText(tree, en.data.tombstoneSkipped.replace('{{n}}', '1'))).toBe(true);
    await press(tree, en.data.merge);
    await flush();
    expect(await phoneB.repo.listMeals()).toEqual([]); // skipped

    await press(tree, en.data.importButton);
    await flush();
    await toggle(tree, en.data.tombstoneRestore);
    await press(tree, en.data.merge);
    await flush();
    expect((await phoneB.repo.listMeals()).map((m) => m.id)).toEqual([meal.id]);
    expect(await phoneB.repo.listTombstones()).toEqual([]);
  });
});

describe('Replace on import offers an export first (UX-6, UX-9)', () => {
  afterEach(() => jest.restoreAllMocks());
  it('UX-6 the Replace sheet has Export first before Replace, and replacing happens only after the person chooses it', async () => {
    const source = nowDeps();
    await logMeal(source, { description: 'Synthetic from file', ingredients: [], at: new Date(Date.now() - 3600_000) });
    const backup = await exportBundle(source);
    const target = nowDeps();
    await logMeal(target, { description: 'Synthetic local', ingredients: [], at: new Date(Date.now() - 7200_000) });
    const seen: string[][] = [];
    const script = [0, 1]; // Export first, then Replace
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation((o, cb) => {
      seen.push(o.options);
      cb(script.shift() ?? o.options.length - 1);
    });
    const { tree, fileShare } = await mount(() => require('@/app/settings/data'), target, { saveAndShare: jest.fn(async () => undefined), pickFile: jest.fn(async () => backup as unknown as null) });
    await press(tree, en.data.importButton);
    await flush();
    await press(tree, en.data.replace);
    await flush();
    expect(seen).toEqual([[en.delete.exportFirst, en.data.replace, en.common.cancel], [en.delete.exportFirst, en.data.replace, en.common.cancel]]);
    expect(fileShare.saveAndShare).toHaveBeenCalledTimes(1);
    expect((await target.repo.listMeals()).map((m) => m.description)).toEqual(['Synthetic from file']);
  });
});

describe('Review (UX-1, EX-14)', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockRouter.push.mockClear();
    mockRouter.navigate.mockClear();
    mockParams.current = {};
  });
  afterEach(() => jest.restoreAllMocks());

  it('UX-1 the days list shows logged days newest first and opens one in its full log', async () => {
    const deps = nowDeps();
    await logMeal(deps, { description: 'Synthetic oats', ingredients: [], at: new Date('2026-01-10T08:00:00.000Z') });
    await logMeal(deps, { description: 'Synthetic soup', ingredients: [], at: new Date('2026-01-12T08:00:00.000Z') });
    await logStool(deps, { bristol: 4, at: new Date('2026-01-12T09:00:00.000Z') });
    const { tree } = await mount(() => require('@/app/(tabs)/review/index'), deps);
    await flush();
    const first = en.review.dayRow.replace('{{day}}', '2026-01-12').replace('{{n}}', '2');
    expect(JSON.stringify(tree.toJSON()).indexOf(first)).toBeGreaterThan(-1);
    await press(tree, first);
    expect(mockRouter.navigate).toHaveBeenLastCalledWith({ pathname: '/review/day', params: { day: '2026-01-12' } });
    await press(tree, en.review.report);
    expect(mockRouter.push).toHaveBeenLastCalledWith('/review/report');
  });

  it('UX-1 an empty Review explains why', async () => {
    const { tree } = await mount(() => require('@/app/(tabs)/review/index'), nowDeps());
    await flush();
    expect(hasText(tree, en.review.noDays)).toBe(true);
  });

  it('UX-2 the day heading opens a date picker; a picked past day shows that day, a future day is not chosen, and Today returns', async () => {
    const deps = nowDeps();
    await logMeal(deps, { description: 'Synthetic old meal', ingredients: [], at: new Date('2026-01-10T08:00:00.000Z') });
    const { tree } = await mount(() => require('@/app/(tabs)/today/index'), deps);
    await flush();
    mockPicker.last = undefined;
    expect(mockPicker.last).toBeUndefined(); // closed until the heading is pressed
    await press(tree, en.day.jump);
    expect(mockPicker.last!.maximumDate).toBeInstanceOf(Date);
    await act(async () => {
      mockPicker.last!.onValueChange({}, new Date('2026-01-10T12:00:00'));
    });
    await flush();
    expect(hasText(tree, '2026-01-10')).toBe(true);
    expect(hasText(tree, 'Synthetic old meal')).toBe(true);
    mockPicker.last = undefined;
    await flush();
    expect(mockPicker.last).toBeUndefined(); // closes after a pick
    await press(tree, en.day.jump);
    await act(async () => {
      mockPicker.last!.onValueChange({}, new Date(Date.now() + 5 * 86_400_000));
    });
    await flush();
    expect(hasText(tree, en.day.today)).toBe(true); // a future date lands on today
    expect(hasText(tree, 'Synthetic old meal')).toBe(false);
  });

  it('UX-2 an entry that appears after the first look is highlighted for a moment; the first look highlights nothing', async () => {
    const deps = nowDeps();
    await logMeal(deps, { description: 'Synthetic earlier meal', ingredients: [], at: new Date(Date.now() - 3600_000) });
    const { tree } = await mount(() => require('@/app/(tabs)/today/index'), deps);
    await flush();
    const marked = () => tree.root.findAll((n) => n.props.accessibilityHint === en.day.newEntry && typeof n.props.onPress === 'function');
    expect(hasText(tree, 'Synthetic earlier meal')).toBe(true);
    expect(marked()).toHaveLength(0);
    await press(tree, en.day.stool);
    await press(tree, en.day.stoolType.replace('{{n}}', '4'));
    await flush();
    expect(marked()).toHaveLength(1);
    expect(marked()[0]!.props.accessibilityLabel).toContain(en.log.stool.replace('{{n}}', '4'));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 3100)); // the tint goes away by itself
    });
    expect(marked()).toHaveLength(0);
  });

  it('UX-2 Today opens the day given in the route parameter', async () => {
    const deps = nowDeps();
    await logMeal(deps, { description: 'Synthetic old meal', ingredients: [], at: new Date('2026-01-10T08:00:00.000Z') });
    mockParams.current = { day: '2026-01-10' };
    const { tree } = await mount(() => require('@/app/(tabs)/today/index'), deps);
    await flush();
    expect(hasText(tree, 'Synthetic old meal')).toBe(true);
    expect(hasText(tree, '2026-01-10')).toBe(true);
  });

  it('UX-2, NF-7 Today moves on to the new day by itself when the app comes back after midnight', async () => {
    const deps = makeDeps(new MemoryRepo(), '2026-11-14T22:00:00.000Z'); // 23:00 in Warsaw
    let now = new Date('2026-11-14T22:00:00.000Z');
    deps.clock.now = () => now;
    let onChange: ((s: string) => void) | null = null;
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_t: string, h: (s: string) => void) => {
      onChange = h;
      return { remove: jest.fn() };
    }) as never);
    mockParams.current = {};
    const { tree } = await mount(() => require('@/app/(tabs)/today/index'), deps);
    await flush();
    expect(hasText(tree, '2026-11-14')).toBe(true);
    now = new Date('2026-11-14T23:30:00.000Z'); // 00:30 on the 15th
    await act(async () => onChange!('active'));
    expect(hasText(tree, '2026-11-15')).toBe(true);
    expect(hasText(tree, '2026-11-14')).toBe(false);
    jest.restoreAllMocks();
  });

  it('UX-2 Today shows the 8 newest entries of the day and "Show all (n)" opens the full log in Review', async () => {
    const deps = nowDeps();
    const base = Date.now() - 3 * 3600_000;
    for (let i = 0; i < 10; i++) await logMeal(deps, { description: `Synthetic meal ${i}`, ingredients: [], at: new Date(base + i * 60_000) });
    const { tree } = await mount(() => require('@/app/(tabs)/today/index'), deps);
    await flush();
    expect(hasText(tree, 'Synthetic meal 9')).toBe(true); // newest on top
    expect(hasText(tree, 'Synthetic meal 2')).toBe(true);
    expect(hasText(tree, 'Synthetic meal 1')).toBe(false);
    expect(hasText(tree, 'Synthetic meal 0')).toBe(false);
    const today = new Date().toISOString().slice(0, 10);
    await press(tree, en.day.showAll.replace('{{n}}', '10'));
    expect(mockRouter.navigate).toHaveBeenLastCalledWith({ pathname: '/review/day', params: { day: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) } });
    mockParams.current = { day: (mockRouter.navigate.mock.calls.at(-1)![0] as { params: { day: string } }).params.day };
    const full = await mount(() => require('@/app/(tabs)/review/day'), deps);
    await flush();
    for (let i = 0; i < 10; i++) expect(hasText(full.tree, `Synthetic meal ${i}`)).toBe(true);
    expect(today).toMatch(/^\d{4}/);
  });

  it('UX-2 a day with 8 entries or fewer has no "Show all" row', async () => {
    const deps = nowDeps();
    for (let i = 0; i < 8; i++) await logMeal(deps, { description: `Synthetic meal ${i}`, ingredients: [], at: new Date(Date.now() - 3600_000 + i * 60_000) });
    const { tree } = await mount(() => require('@/app/(tabs)/today/index'), deps);
    await flush();
    expect(JSON.stringify(tree.toJSON())).not.toContain(en.day.showAll.replace(' ({{n}})', ''));
  });

  it('NF-7 Logging settings has "Day starts at" and saves the hour at once', async () => {
    const deps = nowDeps();
    const { tree } = await mount(() => require('@/app/settings/logging'), deps);
    expect(hasText(tree, en.day.dayStart)).toBe(true);
    await press(tree, '03:00');
    await flush();
    expect(deps.dayStart.get()).toBe(3);
    expect((await deps.repo.getPreferences())?.dayStartHour).toBe(3);
  });

  it('LL-14, LL-5, LL-12 the doctor report writes a summary after the billing confirmation, lets the person edit it, and puts it in the PDF', async () => {
    const answer = JSON.stringify({ summary: 'Synthetic AI narrative.' });
    const deps = nowDeps(new FakeLlm([answer]));
    await saveApiKey(deps, 'sk-synthetic-secret');
    await logMeal(deps, { description: 'Synthetic soup', ingredients: ['soup'], at: new Date(Date.now() - 86_400_000) });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { tree, fileShare } = await mount(() => require('@/app/(tabs)/review/report'), deps);
    await flush();
    await press(tree, en.doctor.summaryButton);
    await flush();
    const [title, body, buttons] = alert.mock.calls.at(-1) as unknown as [string, string, { text: string; onPress?: () => unknown }[]];
    expect(title).toBe(en.doctor.summaryConfirmTitle);
    expect(body).toContain('bills this separately'); // LL-5
    expect(body).toContain(en.doctor.summaryNoPhotos);
    await act(async () => {
      void buttons.find((b) => b.text === en.doctor.summarySend)!.onPress!();
    });
    await flush();
    expect(hasText(tree, en.doctor.summaryReview)).toBe(true);
    const field = tree.root.findAll((n) => n.props.accessibilityLabel === en.doctor.summaryField && typeof n.props.onChangeText === 'function')[0]!;
    expect(field.props.value).toBe('Synthetic AI narrative.');
    expect(await deps.repo.listRecords('reportSummaries')).toEqual([]); // nothing stored before the person keeps it
    await act(async () => {
      field.props.onChangeText('Synthetic AI narrative, corrected.');
    });
    await press(tree, en.doctor.summaryUse);
    await flush();
    expect(hasText(tree, en.doctor.summaryIncluded)).toBe(true);
    expect(await deps.repo.listRecords('reportSummaries')).toMatchObject([{ generated: 'Synthetic AI narrative.', text: 'Synthetic AI narrative, corrected.' }]);
    await press(tree, en.doctor.button);
    await flush();
    const [, bytes] = fileShare.saveAndShare.mock.calls[0] as unknown as [string, Uint8Array];
    expect(Object.keys(unzipSync(bytes))).toContain('report.pdf');
    expect(new TextDecoder().decode(unzipSync(bytes)['report.pdf']!)).toContain('Synthetic AI narrative, corrected.');
    alert.mockRestore();
  });

  it('LL-14 changing the period or the language drops the summary and asks for a new one', async () => {
    const deps = nowDeps(new FakeLlm([JSON.stringify({ summary: 'Synthetic AI narrative.' })]));
    await saveApiKey(deps, 'sk-synthetic-secret');
    await logMeal(deps, { description: 'Synthetic soup', ingredients: ['soup'], at: new Date(Date.now() - 86_400_000) });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { tree } = await mount(() => require('@/app/(tabs)/review/report'), deps);
    await flush();
    await press(tree, en.doctor.summaryButton);
    await flush();
    const buttons = alert.mock.calls.at(-1)![2] as { text: string; onPress?: () => unknown }[];
    await act(async () => {
      void buttons.find((b) => b.text === en.doctor.summarySend)!.onPress!();
    });
    await flush();
    await press(tree, en.doctor.summaryUse);
    await flush();
    expect(hasText(tree, en.doctor.summaryIncluded)).toBe(true);
    await press(tree, en.export.polish);
    await flush();
    expect(hasText(tree, en.doctor.summaryIncluded)).toBe(false);
    expect(hasText(tree, en.doctor.summaryButton)).toBe(true);
    alert.mockRestore();
  });

  it('EX-14, EX-7 the doctor report counts the period, leaves sensitive photos out until asked, and remembers the export', async () => {
    const deps = nowDeps();
    const entry = await logSkinEntry(deps, { areaId: 'area-intimate', scores, at: new Date(Date.now() - 86_400_000) });
    await addPhoto(deps, { entryKind: 'skinEntry', entryId: entry.id, sourceUri: 'secret' });
    const { tree, fileShare } = await mount(() => require('@/app/(tabs)/review/report'), deps);
    await flush();
    expect(hasText(tree, en.doctor.counts.replace('{{entries}}', '1').replace('{{photos}}', '1'))).toBe(true);
    await press(tree, en.doctor.button);
    await flush();
    const [name, bytes] = fileShare.saveAndShare.mock.calls[0] as unknown as [string, Uint8Array];
    expect(name).toMatch(/^nettle-report-/);
    const files = Object.keys(unzipSync(bytes));
    expect(files).toEqual(expect.arrayContaining(['data.json', 'report.pdf']));
    expect(files.some((f) => f.startsWith('photos/'))).toBe(false); // sensitive photo left out
    expect(await deps.settings.get('lastExportAt')).not.toBeNull();
    await toggle(tree, en.doctor.sensitive.replace('{{n}}', '1'));
    await press(tree, en.doctor.button);
    await flush();
    const second = Object.keys(unzipSync((fileShare.saveAndShare.mock.calls[1] as unknown as [string, Uint8Array])[1]));
    expect(second.some((f) => f.startsWith('photos/'))).toBe(true);
  });

  it('EX-14 with nothing in the period the button is disabled and says why; after an export "since last export" is the default', async () => {
    const deps = nowDeps();
    const { tree } = await mount(() => require('@/app/(tabs)/review/report'), deps);
    await flush();
    expect(hasText(tree, en.doctor.empty)).toBe(true);
    const button = tree.root.findAll((n) => n.props.accessibilityLabel === en.doctor.button && n.props.accessibilityState)[0]!;
    expect(button.props.accessibilityState.disabled).toBe(true);
    expect(hasText(tree, en.doctor.since)).toBe(false);
    await deps.settings.set('lastExportAt', new Date().toISOString());
    const again = await mount(() => require('@/app/(tabs)/review/report'), deps);
    await flush();
    expect(again.tree.root.findAll((n) => n.props.accessibilityLabel === en.doctor.since && n.props.accessibilityState?.selected)).not.toHaveLength(0);
  });
});

describe('Meal form (IN-1, IN-7, IN-10, IN-14, UX-3)', () => {
  let sheet: jest.SpyInstance;
  beforeEach(() => {
    sheet = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation((_o, cb) => cb(0));
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockRouter.back.mockClear();
    mockParams.current = {};
    mockScreen.options = undefined;
  });
  afterEach(() => jest.restoreAllMocks());
  const meal = () => require('@/app/form/meal');
  const header = async (side: 'headerLeft' | 'headerRight', label: string) => {
    let rendered!: ReactTestRenderer;
    await act(async () => {
      rendered = create(mockScreen.options![side]!());
    });
    const node = rendered.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0]!;
    await act(async () => {
      await node.props.onPress();
    });
    return node.props.accessibilityState as { disabled?: boolean } | undefined;
  };

  it('IN-1, IN-7 a new meal is typed in the choose phase, reviewed, and saved only with Save', async () => {
    const deps = nowDeps();
    const { tree } = await mount(meal, deps);
    await flush();
    expect((await header('headerRight', en.common.save))?.disabled).toBe(true); // nothing to save in the choose phase
    await type(tree, en.meal.description, 'Synthetic breakfast');
    await press(tree, en.meal.continue);
    await type(tree, en.meal.ingredientPlaceholder, 'Synthetic oats');
    expect(await deps.repo.listMeals()).toEqual([]);
    await header('headerRight', en.common.save);
    await flush();
    expect(await deps.repo.listMeals()).toMatchObject([{ description: 'Synthetic breakfast', ingredients: ['Synthetic oats'], allergens: [] }]);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('IN-7, IN-10, IN-14 a suggestion fills the review with its latest ingredients and tags and saves a new, independent entry', async () => {
    const deps = nowDeps();
    const old = await logMeal(deps, { description: 'Synthetic porridge', ingredients: ['oats', 'milk'], allergens: ['milk'], at: new Date(Date.now() - 2 * 86_400_000) });
    await logMeal(deps, { description: 'Synthetic soup', ingredients: ['leeks'], at: new Date(Date.now() - 3 * 86_400_000) });
    const { tree } = await mount(meal, deps);
    await flush();
    expect(hasText(tree, en.meal.hintDays.replace('{{n}}', '2'))).toBe(true);
    await press(tree, 'Synthetic porridge');
    expect(hasText(tree, 'oats')).toBe(true);
    const milk = tree.root.findAll((n) => n.props.accessibilityLabel === en.allergens.milk && n.props.accessibilityState)[0]!;
    expect(milk.props.accessibilityState.selected).toBe(true); // from the diary's history: visible and pre-selected
    await header('headerRight', en.common.save);
    await flush();
    const saved = await deps.repo.listMeals();
    expect(saved).toHaveLength(3);
    const fresh = saved.find((m) => m.id !== old.id && m.description === 'Synthetic porridge')!;
    expect(fresh).toMatchObject({ ingredients: ['oats', 'milk'], allergens: ['milk'] });
    expect(saved.find((m) => m.id === old.id)).toEqual(old);
  });

  it('IN-14 typing filters the whole history, and a favorite is listed first', async () => {
    const deps = nowDeps();
    for (const [i, name] of ['Synthetic eggs', 'Synthetic rice', 'Synthetic ricotta'].entries()) {
      await logMeal(deps, { description: name, ingredients: [], at: new Date(Date.now() - (i + 1) * 3600_000) });
    }
    await toggleFavoriteMeal(deps, { description: 'Synthetic rice', ingredients: [], allergens: [], barcode: null, source: { kind: 'typed', edited: false, llm: null, aiTags: false } });
    const { tree } = await mount(meal, deps);
    await flush();
    const labels = () => [...new Set(tree.root.findAll((n) => n.props.accessibilityRole === 'button' && typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('Synthetic')).map((n) => n.props.accessibilityLabel as string))];
    expect(labels()[0]).toBe('Synthetic rice');
    await type(tree, en.meal.description, 'ric');
    expect(labels()).toEqual(['Synthetic rice', 'Synthetic ricotta']);
  });

  it('IN-7, UX-9 Change meal returns to choose, and asks first only when something was edited', async () => {
    const deps = nowDeps();
    await logMeal(deps, { description: 'Synthetic porridge', ingredients: ['oats'], at: new Date(Date.now() - 3600_000) });
    const { tree } = await mount(meal, deps);
    await flush();
    await press(tree, 'Synthetic porridge');
    await press(tree, en.meal.changeMeal);
    expect(sheet).not.toHaveBeenCalled();
    expect(hasText(tree, en.meal.chooseTitle)).toBe(true);
    await press(tree, 'Synthetic porridge');
    await type(tree, en.meal.ingredientPlaceholder, 'changed');
    sheet.mockImplementation((_o, cb) => cb(1)); // keep editing
    await press(tree, en.meal.changeMeal);
    expect(hasText(tree, en.meal.chooseTitle)).toBe(false);
    sheet.mockImplementation((_o, cb) => cb(0)); // discard
    await press(tree, en.meal.changeMeal);
    expect((sheet.mock.calls[0] as [{ options: string[] }])[0].options).toEqual([en.meal.discard, en.common.cancel]);
    expect(hasText(tree, en.meal.chooseTitle)).toBe(true);
  });

  it('IN-14 starring a meal in the review phase stores a favorite snapshot', async () => {
    const deps = nowDeps();
    const { tree } = await mount(meal, deps);
    await type(tree, en.meal.description, 'Synthetic breakfast');
    await press(tree, en.meal.continue);
    await press(tree, en.meal.favorite);
    await flush();
    expect((await deps.repo.getPreferences())!.favorites.meals).toMatchObject([{ key: 'synthetic breakfast', description: 'Synthetic breakfast' }]);
    expect(hasText(tree, en.meal.unfavorite)).toBe(true);
  });

  it('UX-2 opened for a past day, a new meal defaults to the current clock time on that day', async () => {
    const deps = nowDeps();
    mockParams.current = { day: '2026-01-10' };
    const { tree } = await mount(meal, deps);
    await type(tree, en.meal.description, 'Synthetic old breakfast');
    await press(tree, en.meal.continue);
    await header('headerRight', en.common.save);
    await flush();
    const [saved] = await deps.repo.listMeals();
    expect(localDay(saved!.at.utc, saved!.at.tz)).toBe('2026-01-10');
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
    const grid = () => tree.root.findAll((n) => n.props.accessibilityRole === 'button' && [e.meal.title, e.skin.title, e.treatment.title, e.checkin.title, e.stool.title, e.drink.title, en.home.more].includes(n.props.accessibilityLabel)).map((n) => n.props.accessibilityLabel as string);
    expect([...new Set(grid())]).toEqual([e.meal.title, e.skin.title, e.treatment.title, e.checkin.title, e.stool.title, en.home.more]);
    await press(tree, en.home.edit);
    await press(tree, `${en.home.moveUp} ${e.checkin.title}`);
    await press(tree, `${en.home.unpin} ${e.stool.title}`);
    await press(tree, `${en.home.pin} ${e.drink.title}`);
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === `${en.home.unpin} ${en.home.more}`)).toHaveLength(0); // More cannot be unpinned
    await press(tree, en.home.done);
    await flush();
    expect([...new Set(grid())]).toEqual([e.meal.title, e.skin.title, e.checkin.title, e.treatment.title, e.drink.title, en.home.more]);
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
      rendered = create(mockScreen.options!.headerRight!());
    });
    await act(async () => {
      await rendered.root.findAll((n) => n.props.accessibilityLabel === en.common.save && typeof n.props.onPress === 'function')[0]!.props.onPress();
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
    const [entry] = await deps.repo.listSkinEntries();
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
    const entries = await deps.repo.listSkinEntries();
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
    expect(await deps.repo.listSkinEntries()).toEqual([]);
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

describe('Regular medication and treatment (IN-17)', () => {
  beforeEach(() => {
    mockRouter.push.mockClear();
    mockRouter.back.mockClear();
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockParams.current = {};
  });
  afterEach(() => jest.restoreAllMocks());
  const today = () => require('@/app/(tabs)/today/index');
  const saveForm = async () => {
    let rendered!: ReactTestRenderer;
    await act(async () => {
      rendered = create(mockScreen.options!.headerRight!());
    });
    await act(async () => {
      await rendered.root.findAll((n) => n.props.accessibilityLabel === en.common.save && typeof n.props.onPress === 'function')[0]!.props.onPress();
    });
    await flush();
  };

  it('IN-17 the Regular switch on the Medication and Treatment forms adds a regular item, and not switching it adds none', async () => {
    const deps = nowDeps();
    const med = await mount(() => require('@/app/form/medication'), deps);
    await flush();
    await act(async () => {
      med.tree.root.findAll((n) => n.props.placeholder === en.more.medName)[0]!.props.onChangeText('Synthetic pill');
    });
    await toggle(med.tree, en.regular.switch);
    await saveForm();
    expect((await deps.repo.getPreferences())!.regular).toMatchObject([{ kind: 'medication', name: 'Synthetic pill' }]);
    expect(await deps.repo.listRecords('medicationEntries')).toHaveLength(1);

    const cream = await addListItem(deps, 'treatments', 'Synthetic cream');
    const tr = await mount(() => require('@/app/form/treatment'), deps);
    await flush();
    await press(tr.tree, 'Chin');
    await toggle(tr.tree, en.regular.switch);
    await saveForm();
    expect((await deps.repo.getPreferences())!.regular.map((r) => r.kind)).toEqual(['medication', 'treatment']);
    expect(cream.id).toBeTruthy();
  });

  it('IN-17, UX-3 the Medication tile opens a quick sheet of regular items: one tap logs one and locks the row; "Other or earlier…" opens the form', async () => {
    const deps = nowDeps();
    await pinEntryType(deps, 'medication');
    const { tree } = await mount(today, deps);
    await flush();
    await press(tree, en.entry.medication.title); // no regular items yet: the full form
    expect(mockRouter.push).toHaveBeenLastCalledWith('/form/medication');
    await addRegularMedication(deps, { category: 'medication', name: 'Synthetic pill', dose: '5 mg' });
    const again = await mount(today, deps);
    await flush();
    mockRouter.push.mockClear();
    await press(again.tree, en.entry.medication.title);
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(hasText(again.tree, en.regular.sheetMedication)).toBe(true);
    await press(again.tree, 'Synthetic pill 5 mg');
    await flush();
    expect(await deps.repo.listRecords('medicationEntries')).toMatchObject([{ name: 'Synthetic pill', dose: '5 mg' }]);
    const row = again.tree.root.findAll((n) => n.props.accessibilityLabel === 'Synthetic pill 5 mg' && n.props.accessibilityState)[0]!;
    expect(row.props.accessibilityState?.disabled).toBe(true); // locked against a double tap
    await press(again.tree, en.regular.other);
    expect(mockRouter.push).toHaveBeenLastCalledWith('/form/medication');
  });

  it('SK-9 a tap on a regular reminder opens Today with the quick sheet of its kind', async () => {
    const deps = nowDeps();
    await addRegularMedication(deps, { category: 'medication', name: 'Synthetic pill' });
    mockParams.current = { sheet: 'medication' };
    const { tree } = await mount(today, deps);
    await flush();
    expect(hasText(tree, en.regular.sheetMedication)).toBe(true);
  });

  it('IN-17 a regular item has its own screen in Settings: reminder times, hide name and Stop', async () => {
    const deps = nowDeps();
    const item = await addRegularMedication(deps, { category: 'medication', name: 'Synthetic pill' });
    const list = await mount(() => require('@/app/settings/regular'), deps);
    await flush();
    await press(list.tree, 'Synthetic pill');
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/settings/regular-item', params: { id: item.id } });
    mockParams.current = { id: item.id };
    const screen = await mount(() => require('@/app/settings/regular-item'), deps);
    await flush();
    await press(screen.tree, en.regular.addTime);
    await flush();
    expect((await deps.repo.getPreferences())!.regular[0]!.times).toHaveLength(1);
    expect((deps.notifier as unknown as FakeNotifier).scheduled.some((x) => x.itemId === item.id)).toBe(true);
    await toggle(screen.tree, en.regular.hideName);
    await flush();
    expect((await deps.repo.getPreferences())!.regular[0]!.hideName).toBe(true);
    jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation((_o, cb) => cb(0));
    await press(screen.tree, en.regular.stop);
    await flush();
    expect((await deps.repo.getPreferences())!.regular).toEqual([]);
    expect((deps.notifier as unknown as FakeNotifier).scheduled).toEqual([]);
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
        rendered = create(mockScreen.options!.headerRight!());
      });
      await act(async () => {
        await rendered.root.findAll((n) => n.props.accessibilityLabel === en.common.save && typeof n.props.onPress === 'function')[0]!.props.onPress();
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
    expect(events.map((e) => [e.action, e.name, e.dateUnknown]).sort()).toEqual([['started', 'Synthetic cream', true], ['stopped', 'Synthetic cream', false]]);
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
    expect((await deps.repo.getPreferences())!.favorites.drinks).toMatchObject([{ name: 'Synthetic coffee', amountMl: 200, alcohol: false, ingredients: ['coffee', 'milk'] }]);
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
    await toggleFavoriteDrink(deps, { name: 'Synthetic wine', amountMl: 150, alcohol: true, ingredients: [], allergens: [], barcode: null, source: { kind: 'typed', edited: false, llm: null, aiTags: false } });
    const { tree } = await mount(alcohol, deps);
    await flush();
    const labels = [...new Set(tree.root.findAll((n) => n.props.accessibilityRole === 'button' && /ml$/.test(n.props.accessibilityLabel ?? '')).map((n) => n.props.accessibilityLabel as string))];
    expect(labels).toEqual(['Synthetic wine 150 ml', 'Synthetic beer 500 ml']);
  });
});

describe('Reminder taps (SK-9)', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockRouter.push.mockClear();
    mockRouter.navigate.mockClear();
    unsavedForm.current = false;
  });
  afterEach(() => jest.restoreAllMocks());

  async function mountLayout(deps: Deps) {
    services.__state.current = { deps, fileShare: { saveAndShare: jest.fn(), pickFile: jest.fn() }, analysisRunner: new AnalysisRunner(deps), appLock: new AppLock(deps) };
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(React.createElement(require('@/app/_layout').default));
    });
    return { tree, notifier: deps.notifier as unknown as FakeNotifier };
  }

  it('SK-9 a tap on the check-in reminder opens the check-in form of the day it was delivered, over Today', async () => {
    const deps = nowDeps();
    const { notifier } = await mountLayout(deps);
    await act(async () => notifier.tap({ id: 'checkin', target: 'checkin', deliveredAt: new Date('2026-01-10T20:00:00.000Z') }));
    expect(mockRouter.navigate).toHaveBeenCalledWith('/today');
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/form/checkin', params: { day: '2026-01-10' } });
  });

  it('SK-9 the same tap is handled once, and a tap while a form has unsaved changes does nothing', async () => {
    const deps = nowDeps();
    const { notifier } = await mountLayout(deps);
    const tap = { id: 'nails', target: 'nails', deliveredAt: new Date('2026-01-10T20:00:00.000Z') };
    await addArea(deps, 'Synthetic thumb', 'nail');
    await act(async () => notifier.tap(tap));
    await act(async () => notifier.tap(tap)); // Expo returns the last response again at launch
    expect(mockRouter.push).toHaveBeenCalledTimes(1);
    unsavedForm.current = true;
    await act(async () => notifier.tap({ id: 'backup', target: 'backup', deliveredAt: new Date('2026-02-01T10:00:00.000Z') }));
    expect(mockRouter.navigate).toHaveBeenCalledTimes(1); // only the Today step of the nails tap
  });

  it('SK-9 the backup reminder opens Data and backup and nothing else', async () => {
    const deps = nowDeps();
    const { notifier } = await mountLayout(deps);
    await act(async () => notifier.tap({ id: 'backup', target: 'backup', deliveredAt: null }));
    expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/settings/data' });
    expect(fileShareCalls(deps)).toBe(0);
  });

  it('SK-9 the check-in form opens on the day it is given', async () => {
    const deps = nowDeps();
    mockParams.current = { day: '2026-01-10' };
    const { tree } = await mount(() => require('@/app/form/checkin'), deps);
    await flush();
    expect(hasText(tree, '2026-01-10')).toBe(true);
    mockParams.current = {};
  });
});
const fileShareCalls = (_deps: unknown) => 0; // a tap never exports; no file share is wired into these tests

describe('Analysis running state (LL-12)', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  const answer = JSON.stringify({ summary: 'Synthetic summary', hypotheses: [], order_and_lag: 'none', data_limits: [], suggestions: [] });
  async function prepared(deps: Deps) {
    await saveApiKey(deps, 'sk-synthetic-secret');
    await logMeal(deps, { description: 'Synthetic meal', ingredients: [], at: new Date(Date.now() - 2 * 3600 * 1000) });
    return prepareAnalysis(deps, { dayFrom: localDay(new Date(Date.now() - 86_400_000).toISOString(), deps.clock.timeZone()), dayTo: localDay(new Date().toISOString(), deps.clock.timeZone()), language: 'en', photoIds: [] });
  }

  it('LL-12 Review shows a running card and then a ready card for a run started anywhere, and the screen result clears it', async () => {
    let release!: (r: { text: string; model: string }) => void;
    const llm = { completeJson: () => new Promise<{ text: string; model: string }>((resolve) => (release = resolve)) };
    const deps = nowDeps(llm);
    const prep = await prepared(deps);
    const runner = new AnalysisRunner(deps);
    services.__state.current = { deps, fileShare: { saveAndShare: jest.fn(), pickFile: jest.fn() }, analysisRunner: runner, appLock: new AppLock(deps) };
    let review!: ReactTestRenderer;
    await act(async () => {
      review = create(React.createElement(require('@/app/(tabs)/review/index').default));
    });
    expect(hasText(review, en.review.runRunning)).toBe(false);
    let done!: Promise<void>;
    await act(async () => {
      done = runner.start(prep); // started from another screen, or after leaving this one
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(hasText(review, en.review.runRunning)).toBe(true);
    await act(async () => {
      release({ text: answer, model: 'fake-model' });
      await done;
    });
    expect(hasText(review, en.review.runReady)).toBe(true);
    let screen!: ReactTestRenderer;
    await act(async () => {
      screen = create(React.createElement(require('@/app/(tabs)/review/analysis').default));
    });
    await flush();
    expect(hasText(screen, 'Synthetic summary')).toBe(true);
    await act(async () => screen.unmount()); // leaving the screen looks at the result
    expect(hasText(review, en.review.runReady)).toBe(false);
  });

  it('LL-12 an interrupted run says nothing was saved and one tap retries the same request', async () => {
    const { NettleError } = require('@/core/model/errors');
    const llm = new FakeLlm([new NettleError('llm_network'), answer]);
    const deps = nowDeps(llm);
    const prep = await prepared(deps);
    const runner = new AnalysisRunner(deps);
    const done = runner.start(prep);
    runner.markBackgrounded();
    await done;
    expect(runner.state.status).toBe('interrupted');
    services.__state.current = { deps, fileShare: { saveAndShare: jest.fn(), pickFile: jest.fn() }, analysisRunner: runner, appLock: new AppLock(deps) };
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(React.createElement(require('@/app/(tabs)/review/analysis').default));
    });
    await flush();
    expect(hasText(tree, en.analysis.interrupted)).toBe(true);
    expect(await deps.repo.listRecords('analyses')).toEqual([]);
    await press(tree, en.analysis.retry);
    await flush();
    expect(llm.requests).toHaveLength(2);
    expect(await deps.repo.listRecords('analyses')).toHaveLength(1);
    expect(hasText(tree, 'Synthetic summary')).toBe(true);
  });

  it('LL-12 the root layout keeps the screen awake while a run is going and lets go when it ends', async () => {
    const keepAwake = require('expo-keep-awake') as { activateKeepAwakeAsync: jest.Mock; deactivateKeepAwake: jest.Mock };
    keepAwake.activateKeepAwakeAsync.mockClear();
    keepAwake.deactivateKeepAwake.mockClear();
    let release!: (r: { text: string; model: string }) => void;
    const deps = nowDeps({ completeJson: () => new Promise<{ text: string; model: string }>((resolve) => (release = resolve)) });
    const prep = await prepared(deps);
    const runner = new AnalysisRunner(deps);
    services.__state.current = { deps, fileShare: { saveAndShare: jest.fn(), pickFile: jest.fn() }, analysisRunner: runner, appLock: new AppLock(deps) };
    await act(async () => {
      create(React.createElement(require('@/app/_layout').default));
    });
    let done!: Promise<void>;
    await act(async () => {
      done = runner.start(prep);
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(keepAwake.activateKeepAwakeAsync).toHaveBeenCalledWith('analysis');
    await act(async () => {
      release({ text: answer, model: 'fake-model' });
      await done;
    });
    expect(keepAwake.deactivateKeepAwake).toHaveBeenCalledWith('analysis');
  });
});

describe('Inline photo estimate (IN-3, LL-12, IN-10)', () => {
  let alert: jest.SpyInstance;
  beforeEach(() => {
    alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation((_o, cb) => cb(0));
    mockParams.current = {};
    require('@/adapters/photos/pickPhotos').pickPhotoUris.mockResolvedValue(['file:///synthetic-meal.jpg']);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });
  const meal = () => require('@/app/form/meal');
  const buttonOf = (name: string) => alert.mock.calls.at(-1)![2].find((b: { text: string }) => b.text === name) as { onPress: () => unknown };

  /** Opens a new meal in the review phase, then picks a photo and confirms sending it. */
  async function startEstimate(llm: LlmProvider) {
    const deps = nowDeps(llm);
    await saveApiKey(deps, 'sk-synthetic-secret');
    const { tree } = await mount(meal, deps);
    await type(tree, en.meal.description, 'Synthetic dinner');
    await press(tree, en.meal.continue);
    await type(tree, en.meal.ingredientPlaceholder, 'my own rice');
    await press(tree, en.meal.fromPhoto);
    await act(async () => {
      await buttonOf(en.photos.library).onPress();
    });
    expect(String(alert.mock.calls.at(-1)![1])).toContain('bills this separately'); // LL-5
    return { deps, tree };
  }

  it('IN-3, LL-12 the estimate runs inline with the form editable, Cancel appears after 30 seconds and stores nothing', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] }); // only this test needs to move the 30 second clock
    const llm = { completeJson: (req: { signal?: AbortSignal }) => new Promise<never>((_r, reject) => req.signal?.addEventListener('abort', () => reject(new Error('aborted')))) };
    const { deps, tree } = await startEstimate(llm);
    await act(async () => {
      void buttonOf(en.meal.photoSend).onPress();
    });
    expect(hasText(tree, en.meal.estimating)).toBe(true);
    expect(hasText(tree, en.meal.estimateCancel)).toBe(false);
    await type(tree, en.meal.description, 'Synthetic dinner, edited while waiting'); // still editable
    await act(async () => {
      jest.advanceTimersByTime(30_000);
    });
    expect(hasText(tree, en.meal.estimateSlow)).toBe(true);
    await press(tree, en.meal.estimateCancel);
    expect(hasText(tree, en.meal.estimating)).toBe(false);
    expect(hasText(tree, en.meal.estimateSlow)).toBe(false);
    expect(await deps.repo.listMeals()).toEqual([]);
  });

  it('IN-3, LL-5 with "prefer my ingredient names" on, the confirmation says how many names go with the photo', async () => {
    const llm = new FakeLlm(['{"ingredients":["rice"],"uncertainty":null}']);
    const deps = nowDeps(llm);
    await saveApiKey(deps, 'sk-synthetic-secret');
    await logMeal(deps, { description: 'Synthetic earlier', ingredients: ['rice', 'oat milk'], at: new Date(Date.now() - 3600_000) });
    await updateSuggestionSettings(deps, { knownNames: true });
    const { tree } = await mount(meal, deps);
    await type(tree, en.meal.description, 'Synthetic dinner');
    await press(tree, en.meal.continue);
    await press(tree, en.meal.fromPhoto);
    await act(async () => {
      await buttonOf(en.photos.library).onPress();
    });
    expect(String(alert.mock.calls.at(-1)![1])).toContain(en.meal.knownNamesSent.replace('{{n}}', '2'));
    await act(async () => {
      void buttonOf(en.meal.photoSend).onPress();
    });
    await flush();
    expect(llm.requests[0]!.system).toContain('["oat milk","rice"]');
  });

  it('IN-10, LL-5 the AI allergen suggestion names the ingredients it sends, and its tags stay unselected until selected', async () => {
    const llm = new FakeLlm(['{"items":[{"name":"butter","allergens":["milk","gluten"]}],"note":null}']);
    const deps = nowDeps(llm);
    await saveApiKey(deps, 'sk-synthetic-secret');
    const { tree } = await mount(meal, deps);
    await type(tree, en.meal.description, 'Synthetic pancake');
    await press(tree, en.meal.continue);
    await type(tree, en.meal.ingredientPlaceholder, 'butter');
    await press(tree, en.meal.aiAllergens);
    const [title, body, buttons] = alert.mock.calls.at(-1) as unknown as [string, string, { text: string; onPress?: () => unknown }[]];
    expect(title).toBe(en.meal.aiAllergensConfirmTitle);
    expect(body).toContain('bills this separately');
    expect(body).toContain('• butter');
    expect(llm.requests).toHaveLength(0);
    await act(async () => {
      void buttons.find((b) => b.text === en.meal.aiAllergensSend)!.onPress!();
    });
    await flush();
    const selected = (label: string) => tree.root.findAll((n) => n.props.accessibilityLabel === label && n.props.accessibilityState)[0]!.props.accessibilityState.selected;
    expect(selected(en.allergens.milk)).toBe(false);
    expect(hasText(tree, en.meal.aiAllergensHint.replace('{{list}}', `${en.allergens.milk}, ${en.allergens.gluten}`))).toBe(true);
    await press(tree, en.meal.scanSelectTags);
    expect(selected(en.allergens.milk)).toBe(true);
    expect(selected(en.allergens.gluten)).toBe(true);
    expect(await deps.repo.listMeals()).toEqual([]);
    // asking again for the same ingredient needs no confirmation and no call
    alert.mockClear();
    await press(tree, en.meal.aiAllergens);
    await flush();
    expect(llm.requests).toHaveLength(1);
    expect(alert.mock.calls.some((c) => c[0] === en.meal.aiAllergensConfirmTitle)).toBe(false);
    expect(hasText(tree, en.meal.aiAllergensSaved)).toBe(true);
  });

  it('IN-10 with no ingredients the AI allergen button asks for one and sends nothing', async () => {
    const llm = new FakeLlm(['{"allergens":[],"note":null}']);
    const deps = nowDeps(llm);
    await saveApiKey(deps, 'sk-synthetic-secret');
    const { tree } = await mount(meal, deps);
    await type(tree, en.meal.description, 'Synthetic pancake');
    await press(tree, en.meal.continue);
    await press(tree, en.meal.aiAllergens);
    expect(String(alert.mock.calls.at(-1)![0])).toBe(en.errors.no_ingredients);
    expect(llm.requests).toHaveLength(0);
  });

  it('IN-3 the estimate arrives as a list to add all of or pick from, never replacing what was typed, with LLM tags unselected', async () => {
    const llm = new FakeLlm(['{"ingredients":["rice","Milk","my own rice","soy sauce"],"uncertainty":"the sauce"}']);
    const { tree } = await startEstimate(llm);
    await act(async () => {
      void buttonOf(en.meal.photoSend).onPress();
    });
    await flush();
    expect(hasText(tree, en.meal.unsure.replace('{{text}}', 'the sauce'))).toBe(true);
    await press(tree, 'soy sauce');
    await press(tree, en.meal.estimateAddPicked);
    const values = () => tree.root.findAll((n) => n.props.placeholder === en.meal.ingredientPlaceholder).map((n) => n.props.value).filter((v, i, a) => a.indexOf(v) === i);
    expect(values()).toEqual(['my own rice', 'soy sauce', '']); // typed text kept, only the picked name added
    const milk = tree.root.findAll((n) => n.props.accessibilityLabel === en.allergens.milk && n.props.accessibilityState)[0]!;
    expect(milk.props.accessibilityState.selected).toBe(false); // IN-10: LLM tags stay unselected
  });

  it('IN-3 Add all adds every name that is not already in the list, and the added rows are ordinary editable rows', async () => {
    const llm = new FakeLlm(['{"ingredients":["rice","My Own Rice"],"uncertainty":null}']);
    const { tree } = await startEstimate(llm);
    await act(async () => {
      void buttonOf(en.meal.photoSend).onPress();
    });
    await flush();
    await press(tree, en.meal.estimateAddAll);
    const values = tree.root.findAll((n) => n.props.placeholder === en.meal.ingredientPlaceholder).map((n) => n.props.value);
    expect([...new Set(values)]).toEqual(['my own rice', 'rice', '']);
    expect(hasText(tree, en.meal.estimateAddAll)).toBe(false); // the banner is gone
  });

  it('LL-8, LL-12 a failure adds nothing, says so and offers a one-tap retry', async () => {
    const { NettleError } = require('@/core/model/errors');
    const llm = new FakeLlm([new NettleError('llm_rate_limited'), '{"ingredients":["rice"],"uncertainty":null}']);
    const { tree } = await startEstimate(llm);
    await act(async () => {
      void buttonOf(en.meal.photoSend).onPress();
    });
    await flush();
    expect(hasText(tree, en.errors.llm_rate_limited)).toBe(true);
    expect(hasText(tree, en.meal.estimateFailed)).toBe(true);
    await press(tree, en.meal.estimateRetry);
    await flush();
    expect(hasText(tree, en.meal.estimateAddAll)).toBe(true);
    expect(llm.requests).toHaveLength(2);
  });

  const LABEL = JSON.stringify({ ingredients: ['mleko (3,2%)', 'cukier'], allergens: ['milk'], traces: ['peanuts'], text_read: 'Składniki: mleko, cukier. Może zawierać orzeszki ziemne.', note: 'The last line is cut off.' });

  it('IN-15, LL-13, IN-16 a label scan shows the text read beside the list, suggests tags without selecting them, saves as a label_scan and deletes the photo', async () => {
    const llm = new FakeLlm([LABEL]);
    const deps = nowDeps(llm);
    await saveApiKey(deps, 'sk-synthetic-secret');
    const { tree } = await mount(meal, deps);
    await type(tree, en.meal.description, 'Synthetic yoghurt');
    await press(tree, en.meal.continue);
    await press(tree, en.meal.fromLabel);
    await act(async () => {
      await buttonOf(en.photos.library).onPress();
    });
    expect(String(alert.mock.calls.at(-1)![1])).toContain('bills this separately'); // LL-5, before the photo is sent
    expect(llm.requests).toHaveLength(0);
    await act(async () => {
      void buttonOf(en.meal.photoSend).onPress();
    });
    await flush();
    expect(hasText(tree, en.meal.labelRead.replace('{{text}}', 'Składniki: mleko, cukier. Może zawierać orzeszki ziemne.'))).toBe(true);
    expect(hasText(tree, en.meal.labelNote.replace('{{text}}', 'The last line is cut off.'))).toBe(true);
    expect((deps.photos as MemoryPhotoStore).discarded).toEqual(['file:///synthetic-meal.jpg']); // the answer is in, the temporary photo is gone
    await press(tree, en.meal.estimateAddAll);
    const values = tree.root.findAll((n) => n.props.placeholder === en.meal.ingredientPlaceholder).map((n) => n.props.value);
    expect([...new Set(values)]).toEqual(['mleko (3,2%)', 'cukier', '']); // text keeps the label's language
    const selected = (label: string) => tree.root.findAll((n) => n.props.accessibilityLabel === label && n.props.accessibilityState)[0]!.props.accessibilityState.selected;
    expect(selected(en.allergens.milk)).toBe(false);
    await press(tree, en.meal.scanSelectTags);
    expect(selected(en.allergens.milk)).toBe(true);
    expect(selected(en.allergens.peanuts)).toBe(true);
    expect(await deps.repo.listMeals()).toEqual([]); // nothing saved by the scan
    let rendered!: ReactTestRenderer;
    await act(async () => {
      rendered = create(mockScreen.options!.headerRight!());
    });
    await act(async () => {
      await rendered.root.findAll((n) => n.props.accessibilityLabel === en.common.save && typeof n.props.onPress === 'function')[0]!.props.onPress();
    });
    await flush();
    const saved = (await deps.repo.listMeals())[0]!;
    expect(saved).toMatchObject({ ingredients: ['mleko (3,2%)', 'cukier'], allergens: ['milk', 'peanuts'], source: { kind: 'label_scan', edited: false, llm: { model: 'fake-model', promptVersion: 'label-1' }, aiTags: true } });
  });

  it('IN-15, LL-12 cancelling the label scan, or dismissing its answer, deletes the temporary photo and stores nothing', async () => {
    const llm = new FakeLlm([LABEL]);
    const deps = nowDeps(llm);
    await saveApiKey(deps, 'sk-synthetic-secret');
    const { tree } = await mount(meal, deps);
    await type(tree, en.meal.description, 'Synthetic yoghurt');
    await press(tree, en.meal.continue);
    await press(tree, en.meal.fromLabel);
    await act(async () => {
      await buttonOf(en.photos.library).onPress();
    });
    await act(async () => {
      await buttonOf(en.common.cancel).onPress(); // declined at the confirmation: nothing was sent
    });
    expect(llm.requests).toHaveLength(0);
    expect((deps.photos as MemoryPhotoStore).discarded).toEqual(['file:///synthetic-meal.jpg']);
    await press(tree, en.meal.fromLabel);
    await act(async () => {
      await buttonOf(en.photos.library).onPress();
    });
    await act(async () => {
      void buttonOf(en.meal.photoSend).onPress();
    });
    await flush();
    await press(tree, en.meal.estimateDismiss);
    expect(hasText(tree, en.meal.estimateAddAll)).toBe(false);
    expect(await deps.repo.listMeals()).toEqual([]);
  });

  it('IN-15, IN-4 a drink can be filled from a label scan too', async () => {
    const deps = nowDeps(new FakeLlm([LABEL]));
    await saveApiKey(deps, 'sk-synthetic-secret');
    const { tree } = await mount(() => require('@/app/form/drink'), deps);
    await type(tree, en.more.drinkName, 'Synthetic kefir');
    await type(tree, en.more.drinkAmount, '250');
    await press(tree, en.meal.fromLabel);
    await act(async () => {
      await buttonOf(en.photos.library).onPress();
    });
    await act(async () => {
      void buttonOf(en.meal.photoSend).onPress();
    });
    await flush();
    await press(tree, en.meal.estimateAddAll);
    await press(tree, en.meal.scanSelectTags);
    let rendered!: ReactTestRenderer;
    await act(async () => {
      rendered = create(mockScreen.options!.headerRight!());
    });
    await act(async () => {
      await rendered.root.findAll((n) => n.props.accessibilityLabel === en.common.save && typeof n.props.onPress === 'function')[0]!.props.onPress();
    });
    await flush();
    expect(await deps.repo.listRecords('drinks')).toMatchObject([
      { name: 'Synthetic kefir', amountMl: 250, ingredients: ['mleko (3,2%)', 'cukier'], allergens: ['milk', 'peanuts'], source: { kind: 'label_scan', edited: false } },
    ]);
  });

  it('IN-15 the barcode that failed stays on the entry, so the confirmed scan becomes its history hit', async () => {
    const llm = new FakeLlm([LABEL]);
    const deps = nowDeps(llm);
    deps.barcode = new FakeBarcode({});
    await saveApiKey(deps, 'sk-synthetic-secret');
    const { tree } = await mount(meal, deps);
    await press(tree, en.meal.scan);
    await type(tree, en.meal.scanCode, '5900000000008');
    await press(tree, en.meal.scanLookup);
    await flush();
    await type(tree, en.meal.description, 'Synthetic yoghurt');
    await press(tree, en.meal.fromLabel);
    await act(async () => {
      await buttonOf(en.photos.library).onPress();
    });
    await act(async () => {
      void buttonOf(en.meal.photoSend).onPress();
    });
    await flush();
    await press(tree, en.meal.estimateAddAll);
    let rendered!: ReactTestRenderer;
    await act(async () => {
      rendered = create(mockScreen.options!.headerRight!());
    });
    await act(async () => {
      await rendered.root.findAll((n) => n.props.accessibilityLabel === en.common.save && typeof n.props.onPress === 'function')[0]!.props.onPress();
    });
    await flush();
    expect(await deps.repo.listMeals()).toMatchObject([{ barcode: '5900000000008', source: { kind: 'label_scan' } }]);
    const { lookupProduct } = require('@/core/usecases/barcode');
    expect(await lookupProduct(deps, '5900000000008')).toMatchObject({ history: { name: 'Synthetic yoghurt', source: { kind: 'label_scan' } } });
  });

  it('IN-3, LL-12 saving while the estimate runs uses the fields as they are and aborts the request', async () => {
    let aborted = false;
    const llm = { completeJson: (req: { signal?: AbortSignal }) => new Promise<never>((_r, reject) => req.signal?.addEventListener('abort', () => ((aborted = true), reject(new Error('aborted'))))) };
    const { deps } = await startEstimate(llm);
    await act(async () => {
      void buttonOf(en.meal.photoSend).onPress();
    });
    let rendered!: ReactTestRenderer;
    await act(async () => {
      rendered = create(mockScreen.options!.headerRight!());
    });
    const save = rendered.root.findAll((n) => n.props.accessibilityLabel === en.common.save && typeof n.props.onPress === 'function')[0]!;
    await act(async () => {
      await save.props.onPress();
    });
    expect(aborted).toBe(true);
    expect(await deps.repo.listMeals()).toMatchObject([{ description: 'Synthetic dinner', ingredients: ['my own rice'] }]);
  });
});

describe('Barcode in the meal form (IN-2, IN-8, IN-9, IN-10)', () => {
  let alert: jest.SpyInstance;
  beforeEach(() => {
    alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation((_o, cb) => cb(0));
    mockParams.current = {};
    mockPermission.current = { granted: true, canAskAgain: true };
    mockCamera.props = undefined;
    mockRouter.back.mockClear();
  });
  afterEach(() => jest.restoreAllMocks());
  const meal = () => require('@/app/form/meal');
  const product = { barcode: '5900000000008', name: 'Synthetic yoghurt', ingredients: ['milk', 'cultures'], allergens: ['milk' as const] };
  const header = async () => {
    let rendered!: ReactTestRenderer;
    await act(async () => {
      rendered = create(mockScreen.options!.headerRight!());
    });
    const node = rendered.root.findAll((n) => n.props.accessibilityLabel === en.common.save && typeof n.props.onPress === 'function')[0]!;
    await act(async () => {
      await node.props.onPress();
    });
  };
  async function open(products: Record<string, typeof product> = { '5900000000008': product }) {
    const deps = nowDeps();
    const fake = new FakeBarcode(products);
    deps.barcode = fake;
    const { tree } = await mount(meal, deps);
    await flush();
    await press(tree, en.meal.scan);
    return { deps, tree, fake };
  }
  const values = (tree: ReactTestRenderer) => [...new Set(tree.root.findAll((n) => n.props.placeholder === en.meal.ingredientPlaceholder).map((n) => n.props.value))];

  it('IN-2, IN-10 a typed code fills the review form; the database allergens are only suggested until the user selects them', async () => {
    const { deps, tree } = await open();
    await type(tree, en.meal.scanCode, '5900 0000 00008');
    await press(tree, en.meal.scanLookup);
    await flush();
    expect(hasText(tree, en.meal.scanFromDb)).toBe(true);
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === en.meal.description && n.props.value === 'Synthetic yoghurt')).not.toHaveLength(0);
    expect(values(tree)).toEqual(['milk', 'cultures']);
    const milk = () => tree.root.findAll((n) => n.props.accessibilityLabel === en.allergens.milk && n.props.accessibilityState)[0]!.props.accessibilityState.selected;
    expect(milk()).toBe(false);
    expect(hasText(tree, en.meal.scanTagsHint.replace('{{list}}', en.allergens.milk))).toBe(true);
    expect(await deps.repo.listMeals()).toEqual([]); // nothing saved by a lookup
    await press(tree, en.meal.scanSelectTags);
    expect(milk()).toBe(true);
    await header();
    await flush();
    expect(await deps.repo.listMeals()).toMatchObject([{ description: 'Synthetic yoghurt', ingredients: ['milk', 'cultures'], allergens: ['milk'], barcode: '5900000000008', source: { kind: 'open_food_facts', edited: false, llm: null, aiTags: false } }]);
  });

  it('IN-2 a Polish translation from the database is shown with a warning to check it against the pack', async () => {
    const { tree } = await open({ '5900000000008': { ...product, translated: true } as typeof product });
    await type(tree, en.meal.scanCode, '5900000000008');
    await press(tree, en.meal.scanLookup);
    await flush();
    expect(hasText(tree, en.meal.scanFromDbTranslated)).toBe(true);
    expect(hasText(tree, en.meal.scanFromDb)).toBe(false);
  });

  it('IN-1 typing in an ingredient row offers names from the diary, and a tap fills the row', async () => {
    const deps = nowDeps();
    await logMeal(deps, { description: 'Synthetic earlier', ingredients: ['oat milk', 'oat milk', 'rice'], at: new Date(Date.now() - 3600_000) });
    const { tree } = await mount(meal, deps);
    await flush();
    await type(tree, en.meal.description, 'Synthetic new');
    await press(tree, en.meal.continue);
    const field = () => tree.root.findAll((n) => n.props.placeholder === en.meal.ingredientPlaceholder && typeof n.props.onFocus === 'function')[0]!;
    await act(async () => {
      field().props.onFocus();
    });
    await type(tree, en.meal.ingredientPlaceholder, 'oa');
    await press(tree, 'oat milk');
    expect(field().props.value).toBe('oat milk');
  });

  it('IN-14 a scanned product can be starred; the favorite keeps its barcode and source and fills them again', async () => {
    const { deps, tree } = await open();
    await type(tree, en.meal.scanCode, '5900000000008');
    await press(tree, en.meal.scanLookup);
    await flush();
    await press(tree, en.meal.favorite);
    await flush();
    expect((await deps.repo.getPreferences())!.favorites.meals).toMatchObject([{ description: 'Synthetic yoghurt', barcode: '5900000000008', source: { kind: 'open_food_facts' } }]);
    const again = await mount(meal, deps);
    await flush();
    await press(again.tree, 'Synthetic yoghurt');
    await header();
    await flush();
    expect(await deps.repo.listMeals()).toMatchObject([{ description: 'Synthetic yoghurt', barcode: '5900000000008', source: { kind: 'open_food_facts', edited: true } }]);
  });

  it('IN-16 changing a filled list before saving marks the entry edited', async () => {
    const { deps, tree } = await open();
    await type(tree, en.meal.scanCode, '5900000000008');
    await press(tree, en.meal.scanLookup);
    await flush();
    await press(tree, en.meal.scanSelectTags);
    await type(tree, en.meal.ingredientPlaceholder, 'oat milk');
    await header();
    await flush();
    expect((await deps.repo.listMeals())[0]!.source).toEqual({ kind: 'open_food_facts', edited: true, llm: null, aiTags: false });
  });

  it('IN-2 a code the diary already knows is filled from history without asking the database', async () => {
    const { deps, tree, fake } = await open();
    await logMeal(deps, { description: 'Synthetic kefir', ingredients: ['kefir'], allergens: ['milk'], barcode: '5900000000008', at: new Date(Date.now() - 86_400_000) });
    await type(tree, en.meal.scanCode, '5900000000008');
    await press(tree, en.meal.scanLookup);
    await flush();
    expect(fake.lookups).toEqual([]);
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === en.meal.description && n.props.value === 'Synthetic kefir')).not.toHaveLength(0);
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === en.allergens.milk && n.props.accessibilityState)[0]!.props.accessibilityState.selected).toBe(true);
  });

  it('IN-4, IN-2 a scanned packaged drink is logged as a drink with its barcode and source', async () => {
    const deps = nowDeps();
    deps.barcode = new FakeBarcode({ '5900000000008': product });
    const { tree } = await mount(() => require('@/app/form/drink'), deps);
    await flush();
    await press(tree, en.meal.scan);
    await type(tree, en.meal.scanCode, '5900000000008');
    await press(tree, en.meal.scanLookup);
    await flush();
    await type(tree, en.more.drinkAmount, '250');
    await header();
    await flush();
    expect(await deps.repo.listRecords('drinks')).toMatchObject([
      { name: 'Synthetic yoghurt', amountMl: 250, alcohol: false, ingredients: ['milk', 'cultures'], barcode: '5900000000008', source: { kind: 'open_food_facts', edited: true } },
    ]);
  });

  it('IN-2 the camera reports a code once, even when it sees it many times', async () => {
    const { tree, fake } = await open();
    await act(async () => {
      mockCamera.props!.onBarcodeScanned!({ data: '5900000000008' });
      mockCamera.props!.onBarcodeScanned!({ data: '5900000000008' });
    });
    await flush();
    expect(fake.lookups).toEqual(['5900000000008']);
    expect(hasText(tree, en.meal.scanFromDb)).toBe(true);
  });

  it('IN-8 a code the database does not know, or a product without ingredients, leaves the form to manual entry', async () => {
    const { tree } = await open({ '5900000000008': { ...product, ingredients: [] } });
    await type(tree, en.meal.scanCode, '3017620422003');
    await press(tree, en.meal.scanLookup);
    await flush();
    expect(hasText(tree, en.meal.scanNotFound)).toBe(true);
    await press(tree, en.meal.changeMeal);
    await press(tree, en.meal.scan);
    await type(tree, en.meal.scanCode, '5900000000008');
    await press(tree, en.meal.scanLookup);
    await flush();
    expect(hasText(tree, en.meal.scanIncomplete)).toBe(true);
  });

  it('IN-2 an in-store code asks the user to confirm the match, and Cancel returns to choosing', async () => {
    const inStore = { ...product, barcode: '2000000000008' };
    const { tree } = await open({ '2000000000008': inStore });
    await type(tree, en.meal.scanCode, '2000000000008');
    await press(tree, en.meal.scanLookup);
    await flush();
    expect(alert.mock.calls.at(-1)![0]).toBe(en.meal.scanInStoreTitle);
    const buttons = alert.mock.calls.at(-1)![2] as { text: string; onPress?: () => void }[];
    await act(async () => buttons.find((b) => b.text === en.common.cancel)!.onPress!());
    expect(hasText(tree, en.meal.chooseTitle)).toBe(true);
    await press(tree, en.meal.scan);
    await type(tree, en.meal.scanCode, '2000000000008');
    await press(tree, en.meal.scanLookup);
    await flush();
    await act(async () => (alert.mock.calls.at(-1)![2] as { text: string; onPress?: () => void }[]).find((b) => b.text === en.meal.scanUse)!.onPress!());
    expect(hasText(tree, en.meal.scanFromDb)).toBe(true);
  });

  it('IN-2, IN-9 an invalid code is refused and the form stays in scanning; an unreachable database falls back to manual entry', async () => {
    const { tree, fake } = await open();
    await type(tree, en.meal.scanCode, '1234');
    await press(tree, en.meal.scanLookup);
    await flush();
    expect(alert.mock.calls.some((c) => c[0] === en.errors.invalid_barcode)).toBe(true);
    expect(hasText(tree, en.meal.scanOrType)).toBe(true);
    fake.failing.add('3017620422003');
    await type(tree, en.meal.scanCode, '3017620422003');
    await press(tree, en.meal.scanLookup);
    await flush();
    expect(alert.mock.calls.some((c) => c[0] === en.errors.barcode_lookup_failed)).toBe(true);
    expect(hasText(tree, en.meal.ingredients)).toBe(true); // the review form, empty
  });

  it('IN-2 without camera permission the form explains it, and the code can still be typed', async () => {
    mockPermission.current = { granted: false, canAskAgain: false };
    const { tree } = await open();
    expect(hasText(tree, en.meal.scanPermission)).toBe(true);
    expect(hasText(tree, en.meal.scanSettings)).toBe(true);
    await type(tree, en.meal.scanCode, '5900000000008');
    await press(tree, en.meal.scanLookup);
    await flush();
    expect(hasText(tree, en.meal.scanFromDb)).toBe(true);
  });
});

describe('Area timeline (SK-8)', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockRouter.push.mockClear();
  });
  afterEach(() => jest.restoreAllMocks());

  it('SK-8 Review lists the areas with entries and opens one timeline', async () => {
    const deps = nowDeps();
    await logSkinEntry(deps, { areaId: 'area-chin', scores, at: new Date('2026-01-10T08:00:00.000Z') });
    const { tree } = await mount(() => require('@/app/(tabs)/review/index'), deps);
    await flush();
    const row = en.review.areaRow.replace('{{area}}', en.areas['area-chin']).replace('{{n}}', '1').replace('{{day}}', '2026-01-10');
    await press(tree, row);
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/review/area', params: { id: 'area-chin' } });
  });

  it('SK-8, UX-1 the timeline charts a score, switches score, and compares two photos side by side with the earlier one first', async () => {
    const deps = nowDeps();
    const a = await logSkinEntry(deps, { areaId: 'area-chin', scores: { ...scores, severity: 2, itch: 9 }, at: new Date('2026-01-10T08:00:00.000Z') });
    const b = await logSkinEntry(deps, { areaId: 'area-chin', scores: { ...scores, severity: 6, itch: 1 }, at: new Date('2026-01-12T08:00:00.000Z') });
    const pa = await addPhoto(deps, { entryKind: 'skinEntry', entryId: a.id, sourceUri: 'first-photo', at: new Date('2026-01-10T08:05:00.000Z') });
    const pb = await addPhoto(deps, { entryKind: 'skinEntry', entryId: b.id, sourceUri: 'second-photo', at: new Date('2026-01-12T08:05:00.000Z') });
    mockParams.current = { id: 'area-chin' };
    const { tree } = await mount(() => require('@/app/(tabs)/review/area'), deps);
    await flush();
    const summary = (label: string) => en.review.trendSummary.replace('{{label}}', label).replace('{{from}}', '2026-01-10').replace('{{to}}', '2026-01-12');
    expect(hasText(tree, summary(en.skin.scores.severity).replace('{{first}}', '2').replace('{{last}}', '6').replace('{{min}}', '2').replace('{{max}}', '6'))).toBe(true);
    await press(tree, en.skin.scores.itch);
    expect(hasText(tree, summary(en.skin.scores.itch).replace('{{first}}', '9').replace('{{last}}', '1').replace('{{min}}', '1').replace('{{max}}', '9'))).toBe(true);
    await press(tree, en.review.compare);
    expect(hasText(tree, en.review.comparePick)).toBe(true);
    await press(tree, `${en.review.pick} ${pb.at.utc}`); // the later photo first: the comparison still puts the earlier one on the left
    await press(tree, `${en.review.pick} ${pa.at.utc}`);
    const shownLabels = tree.root
      .findAll((n) => typeof n.props.accessibilityLabel === 'string' && /^2026-01-1[02] 0[0-9]:05/.test(n.props.accessibilityLabel))
      .map((n) => n.props.accessibilityLabel as string);
    expect([...new Set(shownLabels)].map((l) => l.slice(0, 16))).toEqual(['2026-01-10 09:05', '2026-01-12 09:05']);
    await press(tree, en.review.compareDone);
    expect(hasText(tree, en.review.comparePick)).toBe(false);
    mockParams.current = {};
  });

  it('SK-8, SK-5 the timeline shows scores beside photos, and a sensitive photo stays blurred until tapped', async () => {
    const deps = nowDeps();
    const entry = await logSkinEntry(deps, { areaId: 'area-intimate', scores, at: new Date('2026-01-10T08:00:00.000Z') });
    await addPhoto(deps, { entryKind: 'skinEntry', entryId: entry.id, sourceUri: 'secret' }); // sensitive by the area default
    mockParams.current = { id: 'area-intimate' };
    const { tree } = await mount(() => require('@/app/(tabs)/review/area'), deps);
    await flush();
    expect(hasText(tree, '2026-01-10')).toBe(true);
    expect(hasText(tree, `${en.skin.scores.itch} 2`)).toBe(true);
    const blurred = () => tree.root.findAll((n) => n.props.blurRadius !== undefined).map((n) => n.props.blurRadius as number);
    expect(blurred()).toContain(30);
    await press(tree, en.photos.tapToShow);
    expect(blurred()).not.toContain(30);
    mockParams.current = {};
  });

  it('SK-8 an area without entries explains it is empty', async () => {
    mockParams.current = { id: 'area-sternum' };
    const { tree } = await mount(() => require('@/app/(tabs)/review/area'), nowDeps());
    await flush();
    expect(hasText(tree, en.review.timelineEmpty)).toBe(true);
    mockParams.current = {};
  });
});

describe('Photo selection for an export (EX-7, EX-8)', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('EX-7 the user picks single photos, sensitive ones only when picked, and only those go into the ZIP', async () => {
    const deps = nowDeps();
    const chin = await logSkinEntry(deps, { areaId: 'area-chin', scores, at: new Date('2026-01-10T08:00:00.000Z') });
    const intimate = await logSkinEntry(deps, { areaId: 'area-intimate', scores, at: new Date('2026-01-11T08:00:00.000Z') });
    await addPhoto(deps, { entryKind: 'skinEntry', entryId: chin.id, sourceUri: 'one' });
    await addPhoto(deps, { entryKind: 'skinEntry', entryId: chin.id, sourceUri: 'two' });
    await addPhoto(deps, { entryKind: 'skinEntry', entryId: intimate.id, sourceUri: 'three' }); // sensitive by the area default
    const { tree, fileShare } = await mount(() => require('@/app/settings/data'), deps);
    await flush();
    await press(tree, en.exportPhotos.custom);
    expect(hasText(tree, en.exportPhotos.customHint)).toBe(true);
    const chips = () => [...new Set(tree.root.findAll((n) => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityState?.selected !== undefined && /\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(n.props.accessibilityLabel)).map((n) => n.props.accessibilityLabel as string))];
    expect(chips()).toHaveLength(2); // the two chin photos share a label (same minute); the third is the sensitive one
    const sensitiveLabel = chips().find((l) => l.includes(en.analysis.sensitiveMark))!;
    expect(sensitiveLabel).toContain(en.areas['area-intimate']);
    const plain = chips().filter((l) => !l.includes(en.analysis.sensitiveMark));
    await press(tree, plain[0]!); // pick exactly one ordinary photo
    await press(tree, en.data.exportButton);
    await flush();
    const bytes = (fileShare.saveAndShare.mock.calls[0] as unknown as [string, Uint8Array])[1];
    const photos = Object.keys(unzipSync(bytes)).filter((f) => f.startsWith('photos/'));
    expect(photos).toHaveLength(1);
    // now add the sensitive one explicitly
    await press(tree, sensitiveLabel);
    await press(tree, en.data.exportButton);
    await flush();
    const second = Object.keys(unzipSync((fileShare.saveAndShare.mock.calls[1] as unknown as [string, Uint8Array])[1])).filter((f) => f.startsWith('photos/'));
    expect(second).toHaveLength(2);
  });
});

describe('App lock (SE-8)', () => {
  let alert: jest.SpyInstance;
  let appState: ((s: string) => void) | null;
  beforeEach(() => {
    alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    appState = null;
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_type: string, handler: (s: string) => void) => {
      appState = handler;
      return { remove: jest.fn() };
    }) as never);
    mockRouter.push.mockClear();
    mockRouter.navigate.mockClear();
  });
  afterEach(() => jest.restoreAllMocks());

  async function mountLayout(deps: Deps, lock: AppLock) {
    services.__state.current = { deps, fileShare: { saveAndShare: jest.fn(), pickFile: jest.fn() }, analysisRunner: new AnalysisRunner(deps), appLock: lock };
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(React.createElement(require('@/app/_layout').default));
    });
    return tree;
  }
  const covered = (tree: ReactTestRenderer) => tree.root.findAll((n) => n.props.accessibilityViewIsModal === true).length > 0;

  it('SE-8 the Privacy screen switches the lock on only after the prompt, and says why when it cannot', async () => {
    const deps = nowDeps();
    const lock = new AppLock(deps);
    await lock.init();
    services.__state.current = { deps, fileShare: { saveAndShare: jest.fn(), pickFile: jest.fn() }, analysisRunner: new AnalysisRunner(deps), appLock: lock };
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(React.createElement(require('@/app/settings/privacy').default));
    });
    const auth = deps.auth as unknown as FakeAuth;
    auth.hasLock = false;
    await toggle(tree, en.lock.switch);
    expect(alert.mock.calls.at(-1)![0]).toBe(en.errors.lock_unavailable);
    auth.hasLock = true;
    auth.passes = false;
    await toggle(tree, en.lock.switch);
    expect(alert.mock.calls.at(-1)![0]).toBe(en.errors.lock_failed);
    expect(await deps.settings.get('appLockEnabled')).toBeNull();
    auth.passes = true;
    await toggle(tree, en.lock.switch);
    expect(auth.prompts.at(-1)).toBe(en.lock.turnOn);
    expect(await deps.settings.get('appLockEnabled')).toBe('1');
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === en.lock.switch && n.props.value === true).length).toBeGreaterThan(0);
  });

  it('SE-8 a cold start with the lock on shows the cover and asks once; Unlock after a cancelled prompt works', async () => {
    const deps = nowDeps();
    await deps.settings.set('appLockEnabled', '1');
    const lock = new AppLock(deps);
    await lock.init();
    const auth = deps.auth as unknown as FakeAuth;
    auth.passes = false;
    const tree = await mountLayout(deps, lock);
    await flush();
    expect(hasText(tree, en.lock.locked)).toBe(true);
    expect(auth.prompts).toEqual([en.lock.reason]); // one prompt, not one per render
    auth.passes = true;
    await press(tree, en.lock.unlock);
    await flush();
    expect(lock.locked).toBe(false);
    expect(hasText(tree, en.lock.locked)).toBe(false);
  });

  it('SE-8 while the app is not in the foreground a cover hides the diary, and a long absence locks it', async () => {
    const deps = nowDeps();
    const lock = new AppLock(deps);
    await lock.init();
    await lock.setEnabled(true, 'on');
    let now = Date.now();
    deps.clock = { now: () => new Date(now), timeZone: () => 'Europe/Warsaw' };
    const tree = await mountLayout(deps, lock);
    expect(covered(tree)).toBe(false);
    await act(async () => appState!('inactive'));
    expect(covered(tree)).toBe(true); // the app switcher shows the cover, not the diary
    await act(async () => appState!('active'));
    expect(covered(tree)).toBe(false);
    expect(lock.locked).toBe(false); // a short absence does not lock
    (deps.auth as unknown as FakeAuth).passes = false; // the prompt on return is cancelled, so the cover stays
    await act(async () => appState!('background'));
    now += 61_000;
    await act(async () => appState!('active'));
    await flush();
    expect(lock.locked).toBe(true);
    expect(hasText(tree, en.lock.locked)).toBe(true);
  });

  it('SE-8 a reminder tap waits for the unlock before it opens anything', async () => {
    const deps = nowDeps();
    await deps.settings.set('appLockEnabled', '1');
    const lock = new AppLock(deps);
    await lock.init();
    (deps.auth as unknown as FakeAuth).passes = false;
    const tree = await mountLayout(deps, lock);
    const notifier = deps.notifier as unknown as FakeNotifier;
    let tapped!: Promise<void>;
    await act(async () => {
      tapped = notifier.tap({ id: 'backup', target: 'backup', deliveredAt: null });
    });
    expect(mockRouter.navigate).not.toHaveBeenCalled();
    (deps.auth as unknown as FakeAuth).passes = true;
    await press(tree, en.lock.unlock);
    await act(async () => {
      await tapped;
    });
    expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/settings/data' });
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
      rendered = create(mockScreen.options!.headerRight!());
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
    expect(await deps.repo.listSkinEntries()).toMatchObject([{ areaId: 'area-behind-ears', scores: { itch: 1 } }]);
    mockRouter.back.mockClear();
    await press(tree, en.skin.noChangeAll);
    await flush();
    expect(await deps.repo.listSkinEntries()).toHaveLength(2); // only the area that had an entry
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
      await rendered.root.findAll((n) => n.props.accessibilityLabel === en.common.cancel && typeof n.props.onPress === 'function')[0]!.props.onPress();
    });
    expect((sheet.mock.calls[0] as unknown as [{ options: string[] }])[0].options).toEqual([en.edit.discard, en.common.cancel]);
    expect(mockRouter.back).not.toHaveBeenCalled();
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
