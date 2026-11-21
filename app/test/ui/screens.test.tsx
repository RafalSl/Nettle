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
import { addArea, archiveSkinArea, logNailEntry, logSkinEntry } from '@/core/usecases/skin';
import { logStool, saveCheckIn } from '@/core/usecases/checkin';
import { logDrink, logMedication } from '@/core/usecases/intake';
import { addPhoto } from '@/core/usecases/photos';
import { applyImport, exportBundle, previewImport } from '@/core/usecases/exchange';
import { deleteEntry } from '@/core/usecases/entries';
import { addRegularMedication, setRegularTimes } from '@/core/usecases/regular';
import { pinEntryType, unpinEntryType, toggleFavoriteDrink, toggleFavoriteMeal, updateSuggestionSettings } from '@/core/usecases/preferences';
import { buildPack, importResult, listSuggestions } from '@/core/usecases/aiPack';
import { applyTreatment, logChangeEvent, logMedicalEvent, logReaction } from '@/core/usecases/events';
import { addListItem, archiveListItem } from '@/core/usecases/lists';
import { saveApiKey } from '@/core/usecases/llm';
import { prepareAnalysis } from '@/core/usecases/analysis';
import { localDay } from '@/core/model/time';
import en from '@/i18n/en.json';
import { act, create as createRenderer, type ReactTestRenderer } from 'react-test-renderer';
import { MemoryPhotoStore } from '../fakes/memoryPhotoStore';
import { MemoryRepo } from '../fakes/memoryRepo';
import { makeDeps } from '../helpers/fixtures';

// Every tree a test creates is unmounted after it, so no screen timer (Today refreshes every minute) keeps Jest alive.
const created: ReactTestRenderer[] = [];
const create: typeof createRenderer = (...args) => {
  const tree = createRenderer(...args);
  created.push(tree);
  return tree;
};
afterEach(() => {
  for (const tree of created.splice(0)) {
    try {
      act(() => tree.unmount());
    } catch {
      /* already unmounted */
    }
  }
});


const mockRouter = { push: jest.fn(), back: jest.fn(), navigate: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) };
const mockCamera: { props?: { onBarcodeScanned?: (e: { data: string }) => void } } = {};
const mockPermission: { current: { granted: boolean; canAskAgain: boolean } | null } = { current: { granted: true, canAskAgain: true } };
const mockParams: { current: Record<string, string> } = { current: {} };
type MockPickerProps = { maximumDate?: Date; value?: Date; onValueChange: (e: object, d: Date) => void };
const mockPicker: { last?: MockPickerProps; all: MockPickerProps[] } = { all: [] };
type MockScreenOptions = { headerLeft?: () => React.ReactElement; headerRight?: () => React.ReactElement; gestureEnabled?: boolean };
const mockScreen: { options?: MockScreenOptions; byName: Record<string, MockScreenOptions | undefined> } = { byName: {} };

// Native modules and the router are replaced; everything else (screens, components, i18n, use cases) is real.
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    useFocusEffect: (cb: () => void | (() => void)) => useEffect(cb, [cb]),
    useRouter: () => mockRouter,
    useLocalSearchParams: () => mockParams.current,
    useRootNavigationState: () => ({ key: 'root' }),
    DarkTheme: { colors: {} },
    ThemeProvider: ({ children }: { children: unknown }) => children,
    Tabs: Object.assign(({ children }: { children: unknown }) => children, { Screen: () => null }),
    // The header buttons a form puts into its Stack.Screen options are kept, so a test can press them.
    Stack: Object.assign(({ children }: { children: unknown }) => children, {
      Screen: ({ name, options }: { name?: string; options?: unknown }) => {
        mockScreen.options = options as typeof mockScreen.options;
        if (name) mockScreen.byName[name] = options as MockScreenOptions;
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
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('expo-splash-screen', () => ({ preventAutoHideAsync: jest.fn(async () => undefined), hideAsync: jest.fn(async () => undefined) }));
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
  lastMounted.current = tree;
  return { tree, fileShare };
}
/** The tree of the latest `mount`: a form's floating Save is part of it (UX-3). */
const lastMounted: { current: ReactTestRenderer | undefined } = { current: undefined };
const lastTree = (): ReactTestRenderer => lastMounted.current!;
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

// Only the date is pinned (to midday), so a test that logs an entry "3 hours ago" does not land on yesterday when the
// suite runs between midnight and 03:00. Timers stay real.
const DATE_ONLY = ['hrtime', 'nextTick', 'performance', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] as const;
beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-06-15T10:00:00.000Z'), doNotFake: [...DATE_ONLY] });
});
afterEach(() => {
  jest.useRealTimers();
});

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
        rendered = lastTree();
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
      rendered = lastTree();
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
    expect(hasText(tree, en.llm.keyTail.replace('{{tail}}', 'cret'))).toBe(true); // only the last four characters are shown
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

  it('LL-2, LL-9 the AI settings offer two model choices, one for the estimates and one for the analysis, defaulting to the first offered model', async () => {
    const deps = nowDeps();
    const { tree } = await mount(() => require('@/app/settings/ai'), deps);
    await flush();
    expect(hasText(tree, en.llm.group.estimates)).toBe(true);
    expect(hasText(tree, en.llm.group.analysis)).toBe(true);
    const selected = () => tree.root.findAll((n) => n.props.accessibilityLabel === 'Haiku' && n.props.accessibilityState?.selected === true && typeof n.props.onPress === 'function');
    expect(selected()).toHaveLength(2);
    await press(tree, 'Sonnet'); // the first "Sonnet" chip belongs to the estimates group
    await flush();
    expect(await deps.settings.get('llm_model.label_scan')).toBe('claude-sonnet-5-5');
    expect(await deps.settings.get('llm_model.meal_photo')).toBe('claude-sonnet-5-5');
    expect(await deps.settings.get('llm_model.analysis')).toBeNull();
    expect(selected()).toHaveLength(1);
  });

  it('SE-2, LL-1 Save key stays disabled with a line saying what is missing, and a saved key can be tested', async () => {
    const deps = nowDeps(new FakeLlm(['{"ok":true}']));
    const { tree } = await mount(() => require('@/app/settings/ai'), deps);
    await flush();
    expect(hasText(tree, en.edit.missing.replace('{{what}}', en.llm.keyPasteFirst))).toBe(true);
    const save = () => tree.root.findAll((n) => n.props.accessibilityLabel === en.llm.keySave && n.props.accessibilityState !== undefined);
    expect(save().every((n) => n.props.accessibilityState.disabled === true)).toBe(true);
    expect(hasText(tree, en.llm.keyTest)).toBe(false); // nothing to test without a key
    await type(tree, en.llm.keyField, 'sk-synthetic-secret');
    await press(tree, en.llm.keySave);
    await flush();
    expect(hasText(tree, en.llm.keyTestHint)).toBe(true);
    await press(tree, en.llm.keyTest);
    await flush();
    expect(Alert.alert).toHaveBeenCalledWith(en.llm.keyWorks);
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
      JSON.stringify({ summary: 'Synthetic summary', hypotheses: [], order_and_lag: 'none', data_limits: [], questions_for_doctor: [] }),
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

  it('SK-9 the reminders section shows the permission and the number scheduled, and the test button sends one reminder', async () => {
    const deps = nowDeps();
    const { tree } = await mount(() => require('@/app/settings/reminders'), deps);
    await flush();
    expect(hasText(tree, en.reminders.status.granted.replace('{{n}}', '0'))).toBe(true);
    await press(tree, en.reminders.test.button);
    expect((deps.notifier as unknown as FakeNotifier).tests).toEqual([{ title: en.reminders.test.title, body: en.reminders.test.body }]);
    expect(alert.mock.calls.some((c) => c[0] === en.reminders.test.sent)).toBe(true);
    const refused = nowDeps();
    (refused.notifier as unknown as FakeNotifier).granted = false;
    const second = await mount(() => require('@/app/settings/reminders'), refused);
    await flush();
    expect(hasText(second.tree, en.reminders.status.denied.replace('{{n}}', '0'))).toBe(true);
    await press(second.tree, en.reminders.test.button);
    expect(alert.mock.calls.some((c) => c[0] === en.errors.notifications_denied)).toBe(true);
    expect((refused.notifier as unknown as FakeNotifier).tests).toEqual([]);
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
    for (const screen of ['TodayScreen', 'ReviewScreen']) expect(fs.readFileSync(path.join(root, `../screens/${screen}.tsx`), 'utf8')).toContain('GearButton'); // both tabs draw their own header (UX-12)
    expect(fs.readFileSync(path.join(root, '_layout.tsx'), 'utf8')).toContain('name="settings"'); // above the tabs, so the tab bar is hidden inside
    const { tree } = await mount(() => ({ default: require('@/ui/GearButton').GearButton }), nowDeps());
    await press(tree, en.nav.gear);
    expect(mockRouter.push).toHaveBeenLastCalledWith('/settings');
  });

  it('UX-1 the first Settings screen has a Back button: it goes back, or to Today when there is no history', async () => {
    await mount(() => require('@/app/settings/_layout'), nowDeps());
    const headerLeft = mockScreen.byName['index']?.headerLeft;
    expect(headerLeft).toBeDefined();
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(headerLeft!());
    });
    mockRouter.back.mockClear();
    mockRouter.replace.mockClear();
    await press(tree, en.common.back);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    mockRouter.canGoBack.mockReturnValueOnce(false); // a reminder tap opened `/settings/data` as the first screen
    await press(tree, en.common.back);
    expect(mockRouter.replace).toHaveBeenCalledWith('/today');
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
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
    await logSkinEntry(deps, { areaId: 'area-chin', scores: { severity: 9, itch: 0, pain: 0, dryness: 0, scaling: 0 }, at: new Date(Date.now() - 3600_000) });
    const { tree } = await mount(today, deps);
    await flush();
    expect(hasText(tree, en.cards.noExport)).toBe(true); // before the Daily health time (21:00 by default) the pills are the flare and the backup
    expect(hasText(tree, en.cards.notLogged)).toBe(false);
    expect(hasText(tree, 'Chin, severity 9')).toBe(true); // one area: name, latest severity and the day it started
    await press(tree, 'Flare: Chin, severity 9 since ' + localDay(new Date(Date.now() - 3600_000).toISOString(), deps.clock.timeZone()));
    expect(mockRouter.navigate).toHaveBeenLastCalledWith({ pathname: '/review', params: { view: 'areas' } });
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
    const entry = await logSkinEntry(deps, { areaId: 'area-penis', scores });
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
    mockParams.current = { month: '2026-01' };
    const { tree } = await mount(() => require('@/app/(tabs)/review/index'), deps);
    await flush();
    const first = en.review.dayRow.replace('{{day}}', '2026-01-12').replace('{{n}}', '2');
    expect(JSON.stringify(tree.toJSON()).indexOf(first)).toBeGreaterThan(-1);
    await press(tree, first);
    expect(mockRouter.navigate).toHaveBeenLastCalledWith({ pathname: '/review/day', params: { day: '2026-01-12' } });
    await press(tree, en.review.report);
    expect(mockRouter.push).toHaveBeenLastCalledWith('/review/report');
  });

  it('UX-10 Days shows one month with a calendar grid marking entries, Daily health and flare days, with arrows and a month filter', async () => {
    const deps = nowDeps();
    await logMeal(deps, { description: 'Synthetic oats', ingredients: [], at: new Date('2026-01-10T08:00:00.000Z') });
    await logMeal(deps, { description: 'Synthetic soup', ingredients: [], at: new Date('2026-01-12T08:00:00.000Z') });
    await saveCheckIn(deps, { at: new Date('2026-01-12T20:00:00.000Z') });
    await logSkinEntry(deps, { areaId: 'area-chin', scores: { severity: 9, itch: 0, pain: 0, dryness: 0, scaling: 0 }, at: new Date('2026-01-11T08:00:00.000Z') });
    await logSkinEntry(deps, { areaId: 'area-chin', scores: { severity: 2, itch: 0, pain: 0, dryness: 0, scaling: 0 }, at: new Date('2026-01-14T08:00:00.000Z') });
    mockParams.current = { month: '2026-01' };
    const { tree } = await mount(() => require('@/app/(tabs)/review/index'), deps);
    await flush();
    const cell = (day: string, n: number, health: boolean, flare: boolean) =>
      en.review.calendarDay.replace('{{day}}', day).replace('{{n}}', String(n)).replace('{{health}}', health ? en.review.yes : en.review.no).replace('{{flare}}', flare ? en.review.yes : en.review.no);
    await press(tree, cell('2026-01-10', 1, false, false));
    expect(mockRouter.navigate).toHaveBeenLastCalledWith({ pathname: '/review/day', params: { day: '2026-01-10' } });
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === cell('2026-01-12', 2, true, true)).length).toBeGreaterThan(0); // flare 11th to 13th, 14th is the end entry
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === cell('2026-01-14', 1, false, false)).length).toBeGreaterThan(0);
    // the incomplete filter lists days with entries and no Daily health record
    await toggle(tree, en.review.incomplete);
    const listRow = (label: string) => tree.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function').length;
    expect(listRow(en.review.dayRow.replace('{{day}}', '2026-01-10').replace('{{n}}', '1'))).toBeGreaterThan(0);
    expect(listRow(`${en.review.dayRow.replace('{{day}}', '2026-01-12').replace('{{n}}', '2')}, ${en.review.dayComplete}`)).toBe(0);
    // arrows move by month; the next arrow stops at the current month
    await press(tree, en.review.prevMonth);
    await flush();
    expect(hasText(tree, '2025-12')).toBe(true);
    expect(hasText(tree, en.review.noIncomplete)).toBe(true);
  });

  it('UX-10 Areas groups skin and nail areas with the last score or stage, flaring areas first, and hides archived areas', async () => {
    const deps = nowDeps();
    const nail = await addArea(deps, 'Synthetic thumb', 'nail');
    await logSkinEntry(deps, { areaId: 'area-neck', scores: { ...scores, severity: 3 }, at: new Date('2026-01-12T08:00:00.000Z') });
    await logSkinEntry(deps, { areaId: 'area-chin', scores: { ...scores, severity: 9 }, at: new Date('2026-01-10T08:00:00.000Z') });
    await logNailEntry(deps, { areaId: nail.id, stage: 'yellow', extent: 'under_quarter', at: new Date('2026-01-11T08:00:00.000Z') });
    await archiveSkinArea(deps, 'area-sternum');
    mockParams.current = { view: 'areas' };
    const { tree } = await mount(() => require('@/app/(tabs)/review/index'), deps);
    await flush();
    const text = JSON.stringify(tree.toJSON());
    expect(text).toContain(en.review.skinGroup);
    expect(text).toContain(en.review.nailsGroup);
    expect(text.indexOf(en.areas['area-chin'])).toBeLessThan(text.indexOf(en.areas['area-neck'])); // the flaring area first, though logged earlier
    expect(text).toContain(`${en.review.areaSeverity.replace('{{n}}', '9')} · 2026-01-10 · ${en.review.areaFlaring}`);
    expect(text).toContain(`${en.nail.stages.yellow}, ${en.nail.extents.under_quarter} · 2026-01-11`);
    expect(text).toContain(en.review.areaNone); // an active area with no entries yet
    expect(text).not.toContain(en.areas['area-sternum']);
    await press(tree, en.review.days);
    expect(hasText(tree, en.review.calendarLegend)).toBe(true);
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
    expect(hasText(tree, '10 Jan')).toBe(true);
    expect(hasText(tree, 'Synthetic old meal')).toBe(true);
    mockPicker.last = undefined;
    await flush();
    expect(mockPicker.last).toBeUndefined(); // closes after a pick
    await press(tree, en.day.jump);
    await act(async () => {
      mockPicker.last!.onValueChange({}, new Date(Date.now() + 5 * 86_400_000));
    });
    await flush();
    expect(hasText(tree, en.day.backToToday)).toBe(false); // a future date lands on today
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
    expect(hasText(tree, '10 Jan')).toBe(true);
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
    expect(hasText(tree, '14 Nov')).toBe(true);
    now = new Date('2026-11-14T23:30:00.000Z'); // 00:30 on the 15th
    await act(async () => onChange!('active'));
    expect(hasText(tree, '15 Nov')).toBe(true);
    expect(hasText(tree, '14 Nov')).toBe(false);
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
    const entry = await logSkinEntry(deps, { areaId: 'area-penis', scores, at: new Date(Date.now() - 86_400_000) });
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

  it('EX-4, EX-7 the doctor report can pick photos one by one: Select all leaves sensitive ones out, and only picked photos are exported', async () => {
    const deps = nowDeps();
    const a = await logSkinEntry(deps, { areaId: 'area-chin', scores, at: new Date(Date.now() - 86_400_000) });
    const b = await logSkinEntry(deps, { areaId: 'area-penis', scores, at: new Date(Date.now() - 86_000_000) });
    await addPhoto(deps, { entryKind: 'skinEntry', entryId: a.id, sourceUri: 'plain', at: new Date(Date.now() - 80_000_000) });
    await addPhoto(deps, { entryKind: 'skinEntry', entryId: b.id, sourceUri: 'secret', at: new Date(Date.now() - 79_000_000) });
    const { tree, fileShare } = await mount(() => require('@/app/(tabs)/review/report'), deps);
    await flush();
    await toggle(tree, en.doctor.pickPhotos);
    expect(hasText(tree, en.photos.leftOut)).toBe(true); // the sensitive photo starts unselected
    await press(tree, en.doctor.button);
    await flush();
    const none = Object.keys(unzipSync((fileShare.saveAndShare.mock.calls[0] as unknown as [string, Uint8Array])[1]));
    expect(none.some((f) => f.startsWith('photos/'))).toBe(false); // nothing picked, nothing exported
    await press(tree, en.photos.selectAll);
    await press(tree, en.doctor.button);
    await flush();
    const some = Object.keys(unzipSync((fileShare.saveAndShare.mock.calls[1] as unknown as [string, Uint8Array])[1])).filter((f) => f.startsWith('photos/'));
    expect(some).toHaveLength(1); // the plain one only
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
      rendered = side === 'headerRight' ? lastTree() : create(mockScreen.options![side]!());
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
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === en.common.save)).toHaveLength(0); // the choose phase has no Save (IN-7)
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
    const edit = await mount(() => require('@/app/(tabs)/today/edit'), deps); // More > Edit Today
    await flush();
    await press(edit.tree, `${en.home.moveUp} ${e.checkin.title}`);
    await press(edit.tree, `${en.home.unpin} ${e.stool.title}`);
    await press(edit.tree, `${en.home.pin} ${e.drink.title}`);
    expect(edit.tree.root.findAll((n) => n.props.accessibilityLabel === `${en.home.unpin} ${en.home.more}`)).toHaveLength(0); // More cannot be unpinned
    const again = await mount(() => require('@/app/(tabs)/today/index'), deps);
    await flush();
    const grid2 = () => again.tree.root.findAll((n) => n.props.accessibilityRole === 'button' && [e.meal.title, e.skin.title, e.treatment.title, e.checkin.title, e.stool.title, e.drink.title, en.home.more].includes(n.props.accessibilityLabel)).map((n) => n.props.accessibilityLabel as string);
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

describe('Daily health trends (SK-7, UX-1)', () => {
  it('SK-7 the trends screen charts one score item at a time over the logged days, and an archived item keeps its history', async () => {
    const deps = makeDeps(new MemoryRepo(), '2026-01-20T10:00:00.000Z');
    mockRouter.push.mockClear();
    const empty = await mount(() => require('@/app/(tabs)/review/health'), deps);
    await flush();
    expect(hasText(empty.tree, en.review.healthEmpty)).toBe(true);
    await saveCheckIn(deps, { at: new Date('2026-01-10T20:00:00.000Z'), values: { 'item-stress': 2, 'item-sleep': 7 }, confirmEmptyDay: true });
    await saveCheckIn(deps, { at: new Date('2026-01-12T20:00:00.000Z'), values: { 'item-stress': 8 }, confirmEmptyDay: true });
    await archiveListItem(deps, 'dailyItems', 'item-stress');
    const { tree } = await mount(() => require('@/app/(tabs)/review/health'), deps);
    await flush();
    const summary = (label: string, first: number, last: number, min: number, max: number) =>
      en.review.trendSummary.replace('{{label}}', label).replace('{{from}}', '2026-01-10').replace('{{to}}', '2026-01-12').replace('{{first}}', String(first)).replace('{{last}}', String(last)).replace('{{min}}', String(min)).replace('{{max}}', String(max));
    expect(hasText(tree, summary(en.tags['item-sleep'], 7, 7, 7, 7).replace('2026-01-12', '2026-01-10'))).toBe(true); // sleep: one day
    await press(tree, en.tags['item-stress']);
    await flush();
    expect(hasText(tree, summary(en.tags['item-stress'], 2, 8, 2, 8))).toBe(true);
    const review = await mount(() => require('@/app/(tabs)/review/index'), deps);
    await flush();
    await press(review.tree, en.review.healthTitle);
    expect(mockRouter.push).toHaveBeenLastCalledWith('/review/health');
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

describe('Guide (UX-11)', () => {
  beforeEach(() => mockRouter.push.mockClear());

  it('UX-11 "Where do I log…?" lists everyday situations and each row opens the right form, with the entry type as its subtitle', async () => {
    const { GUIDE } = require('@/screens/GuideScreen') as { GUIDE: { id: string; entry: keyof typeof en.entry }[] };
    const { tree } = await mount(() => require('@/app/guide'), nowDeps());
    expect(GUIDE.length).toBeGreaterThanOrEqual(12);
    const routes: Record<string, string> = { meal: '/form/meal', drink: '/form/drink', medication: '/form/medication', skin: '/form/skin', nails: '/form/nails', treatment: '/form/treatment', checkin: '/form/checkin', stool: '/form/stool', reaction: '/form/reaction', change: '/form/change', medical: '/form/medical' };
    for (const g of GUIDE) {
      const label = (en.guide.items as Record<string, string>)[g.id]!;
      expect(label).toBeTruthy();
      await press(tree, label);
      expect(mockRouter.push).toHaveBeenLastCalledWith(routes[g.entry]);
    }
    expect(hasText(tree, `${en.entry.treatment.title} · ${en.guide.notes.regularCream}`)).toBe(true); // a note says what to switch on
    expect(hasText(tree, en.guide.intro)).toBe(true);
  });

  it('UX-11 the guide is reachable from More and from Settings, About', async () => {
    const more = await mount(() => require('@/app/(tabs)/today/more'), nowDeps());
    await flush();
    await press(more.tree, en.nav.guide);
    expect(mockRouter.push).toHaveBeenLastCalledWith('/guide');
    const about = await mount(() => require('@/app/settings/about'), nowDeps());
    await press(about.tree, en.nav.guide);
    expect(mockRouter.push).toHaveBeenLastCalledWith('/guide');
  });

  it('UX-11 a treatment with a description shows it in the Treatment form', async () => {
    const deps = nowDeps();
    await addListItem(deps, 'treatments', 'Synthetic cream', { description: 'Thin layer, twice a day' });
    const { tree } = await mount(() => require('@/app/form/treatment'), deps);
    await flush();
    expect(hasText(tree, 'Thin layer, twice a day')).toBe(true);
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
      rendered = lastTree();
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
    await unpinEntryType(deps, 'stool'); // five pins at most (UX-2)
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
        rendered = lastTree();
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

  const answer = JSON.stringify({ summary: 'Synthetic summary', hypotheses: [], order_and_lag: 'none', data_limits: [], questions_for_doctor: [] });
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
    await press(tree, en.analysis.retry); // LL-5: the retry opens the confirmation first, nothing is sent yet
    await flush();
    expect(llm.requests).toHaveLength(1);
    const retryConfirm = (Alert.alert as jest.Mock).mock.calls.filter((c) => c[0] === en.analysis.confirmTitle).at(-1)!;
    await act(async () => {
      await (retryConfirm[2] as { text: string; onPress?: () => void }[]).find((b) => b.text === en.analysis.send)!.onPress!();
    });
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

  it('IN-3, LL-12 the estimate runs inline with the form editable, Cancel is there from the start, the text changes after 30 seconds, and nothing is stored', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] }); // only this test needs to move the 30 second clock
    const llm = { completeJson: (req: { signal?: AbortSignal }) => new Promise<never>((_r, reject) => req.signal?.addEventListener('abort', () => reject(new Error('aborted')))) };
    const { deps, tree } = await startEstimate(llm);
    await act(async () => {
      void buttonOf(en.meal.photoSend).onPress();
    });
    expect(hasText(tree, en.meal.estimating)).toBe(true);
    expect(hasText(tree, en.meal.estimateCancel)).toBe(true); // LL-12: Cancel is there from the start
    expect(hasText(tree, '0:00')).toBe(true); // and the elapsed time
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

  const saveMeal = async () => {
    let rendered!: ReactTestRenderer;
    await act(async () => {
      rendered = lastTree();
    });
    await act(async () => {
      await rendered.root.findAll((n) => n.props.accessibilityLabel === en.common.save && typeof n.props.onPress === 'function')[0]!.props.onPress();
    });
    await flush();
  };
  /** Opens a new meal in the review phase with a description, then presses "from the name" and reads the confirmation. */
  async function startNameEstimate(llm: LlmProvider, description = 'Synthetic pancakes with jam') {
    const deps = nowDeps(llm);
    await saveApiKey(deps, 'sk-synthetic-secret');
    const { tree } = await mount(meal, deps);
    await type(tree, en.meal.description, description);
    await press(tree, en.meal.continue);
    return { deps, tree };
  }

  it('IN-19, LL-5 the name button shows only with a description; the confirmation lists the exact text and the billing notice before anything is sent', async () => {
    const llm = new FakeLlm(['{"ingredients":["wheat flour","milk","egg","jam"],"uncertainty":"Recipes differ."}']);
    const { deps, tree } = await startNameEstimate(llm);
    await type(tree, en.meal.description, '   '); // an empty description hides the button
    expect(hasText(tree, en.meal.fromName)).toBe(false);
    await type(tree, en.meal.description, 'Synthetic   pancakes with jam');
    await press(tree, en.meal.fromName);
    const [title, body] = alert.mock.calls.at(-1) as unknown as [string, string];
    expect(title).toBe(en.meal.nameConfirmTitle);
    expect(body).toContain('“Synthetic pancakes with jam”'); // exactly what is sent
    expect(body).toContain('bills this separately');
    expect(body).toContain('no photo');
    expect(llm.requests).toHaveLength(0);
    await type(tree, en.meal.ingredientPlaceholder, 'my own rice');
    await act(async () => {
      void buttonOf(en.meal.nameSend).onPress();
    });
    await flush();
    expect(llm.requests).toHaveLength(1);
    expect(llm.requests[0]!.images).toBeUndefined();
    expect(llm.requests[0]!.user).toContain('Synthetic pancakes with jam');
    expect(hasText(tree, en.meal.nameSuggested)).toBe(true);
    expect(hasText(tree, en.meal.unsure.replace('{{text}}', 'Recipes differ.'))).toBe(true);
    await press(tree, en.meal.estimateAddAll);
    const values = tree.root.findAll((n) => n.props.placeholder === en.meal.ingredientPlaceholder).map((n) => n.props.value);
    expect([...new Set(values)]).toEqual(['my own rice', 'wheat flour', 'milk', 'egg', 'jam', '']); // typed text kept, names added
    const selected = (label: string) => tree.root.findAll((n) => n.props.accessibilityLabel === label && n.props.accessibilityState)[0]!.props.accessibilityState.selected;
    expect(selected(en.allergens.milk)).toBe(false); // IN-10: the estimate never selects a tag
    expect(await deps.repo.listMeals()).toEqual([]); // nothing saved until Save
    await saveMeal();
    expect((await deps.repo.listMeals())[0]).toMatchObject({
      description: 'Synthetic   pancakes with jam', // the entry keeps what was typed; only the sent text is tidied
      allergens: [],
      source: { kind: 'name_estimate', edited: false, llm: { model: 'fake-model', promptVersion: 'name-1' }, aiTags: false },
    });
  });

  it('IN-19 a vague name returns no names: the form says so, shows the note, and offers nothing to add', async () => {
    const llm = new FakeLlm(['{"ingredients":[],"uncertainty":"Lunch names no dish."}']);
    const { tree } = await startNameEstimate(llm, 'lunch');
    await press(tree, en.meal.fromName);
    await act(async () => {
      void buttonOf(en.meal.nameSend).onPress();
    });
    await flush();
    expect(hasText(tree, en.meal.nameEmpty)).toBe(true);
    expect(hasText(tree, 'Lunch names no dish.')).toBe(true);
    expect(hasText(tree, en.meal.estimateAddAll)).toBe(false);
    await press(tree, en.meal.estimateDismiss);
    expect(hasText(tree, en.meal.nameEmpty)).toBe(false);
  });

  it('IN-19, LL-12 waiting is inline and cancellable, a failure keeps the text for a one-tap retry, and nothing is stored', async () => {
    const { NettleError } = require('@/core/model/errors');
    const llm = new FakeLlm([new NettleError('llm_rate_limited'), '{"ingredients":["rice"],"uncertainty":null}']);
    const { deps, tree } = await startNameEstimate(llm);
    await press(tree, en.meal.fromName);
    await act(async () => {
      void buttonOf(en.meal.nameSend).onPress();
    });
    await flush();
    expect(hasText(tree, en.errors.llm_rate_limited)).toBe(true);
    expect(await deps.repo.listMeals()).toEqual([]);
    alert.mockClear();
    await press(tree, en.meal.estimateRetry); // no second confirmation: the same text was already confirmed
    await flush();
    expect(alert).not.toHaveBeenCalled();
    expect(llm.requests).toHaveLength(2);
    expect(llm.requests[1]!.user).toBe(llm.requests[0]!.user);
    expect(hasText(tree, en.meal.nameSuggested)).toBe(true);
  });

  it('IN-19, LL-12 the request is aborted when the form is left or the wait is cancelled after 30 seconds', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
    let signal: AbortSignal | undefined;
    const llm = { completeJson: (req: { signal?: AbortSignal }) => new Promise<never>((_r, reject) => ((signal = req.signal), req.signal?.addEventListener('abort', () => reject(new Error('aborted'))))) };
    const { tree } = await startNameEstimate(llm);
    await press(tree, en.meal.fromName);
    await act(async () => {
      void buttonOf(en.meal.nameSend).onPress();
    });
    expect(hasText(tree, en.meal.estimatingName)).toBe(true);
    await act(async () => {
      jest.advanceTimersByTime(30_000);
    });
    await press(tree, en.meal.estimateCancel);
    expect(signal!.aborted).toBe(true);
    expect(hasText(tree, en.meal.estimatingName)).toBe(false);
  });

  it('IN-19, LL-5 with "prefer my ingredient names" on, the confirmation says how many known names go with the text', async () => {
    const llm = new FakeLlm(['{"ingredients":["rice"],"uncertainty":null}']);
    const deps = nowDeps(llm);
    await saveApiKey(deps, 'sk-synthetic-secret');
    await logMeal(deps, { description: 'Synthetic earlier', ingredients: ['rice', 'oat milk'], at: new Date(Date.now() - 3600_000) });
    await updateSuggestionSettings(deps, { knownNames: true });
    const { tree } = await mount(meal, deps);
    await type(tree, en.meal.description, 'Synthetic risotto');
    await press(tree, en.meal.continue);
    await press(tree, en.meal.fromName);
    expect(String(alert.mock.calls.at(-1)![1])).toContain(en.meal.knownNamesSentName.replace('{{n}}', '2'));
    await act(async () => {
      void buttonOf(en.meal.nameSend).onPress();
    });
    await flush();
    expect(llm.requests[0]!.system).toContain('["oat milk","rice"]');
  });

  it('IN-19, IN-4 a drink can be filled from its name too, and is saved with the name estimate as its source', async () => {
    const llm = new FakeLlm(['{"ingredients":["milk","banana"],"uncertainty":null}']);
    const deps = nowDeps(llm);
    await saveApiKey(deps, 'sk-synthetic-secret');
    const { tree } = await mount(() => require('@/app/form/drink'), deps);
    expect(hasText(tree, en.meal.fromName)).toBe(false);
    await type(tree, en.more.drinkName, 'Synthetic banana smoothie');
    await type(tree, en.more.drinkAmount, '300');
    await press(tree, en.meal.fromName);
    expect(String(alert.mock.calls.at(-1)![1])).toContain('“Synthetic banana smoothie”');
    await act(async () => {
      void buttonOf(en.meal.nameSend).onPress();
    });
    await flush();
    await press(tree, en.meal.estimateAddAll);
    await saveMeal();
    expect((await deps.repo.listRecords('drinks'))[0]).toMatchObject({ name: 'Synthetic banana smoothie', ingredients: ['milk', 'banana'], source: { kind: 'name_estimate', edited: false, llm: { promptVersion: 'name-1' } } });
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
      rendered = lastTree();
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
      rendered = lastTree();
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
    await press(tree, en.meal.scanByHand);
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
      rendered = lastTree();
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
      rendered = lastTree();
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
      rendered = lastTree();
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
    expect(hasText(tree, en.meal.scanNotFound)).toBe(true); // IN-8: the scan screen offers the label or manual entry
    expect(hasText(tree, en.meal.scanReadLabel)).toBe(true);
    await press(tree, en.meal.scanByHand);
    expect(hasText(tree, en.meal.ingredients)).toBe(true); // the review form, empty, with the code kept
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
    expect(hasText(tree, en.meal.scanInStoreBody)).toBe(true); // a sheet, not an alert
    const close = tree.root.findAll((n) => n.props.accessibilityLabel === en.common.close && typeof n.props.onPress === 'function')[0]!;
    await act(async () => close.props.onPress());
    expect(hasText(tree, en.meal.chooseTitle)).toBe(true);
    await press(tree, en.meal.scan);
    await type(tree, en.meal.scanCode, '2000000000008');
    await press(tree, en.meal.scanLookup);
    await flush();
    await press(tree, en.meal.scanUse);
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
    mockParams.current = { view: 'areas' };
    const { tree } = await mount(() => require('@/app/(tabs)/review/index'), deps);
    await flush();
    await press(tree, en.areas['area-chin']);
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/review/area', params: { id: 'area-chin' } });
  });

  it('SK-8, UX-1 the timeline charts a score, switches score, and compares two photos side by side with the earlier one first', async () => {
    const deps = makeDeps(new MemoryRepo(), '2026-01-20T10:00:00.000Z');
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
    const entry = await logSkinEntry(deps, { areaId: 'area-penis', scores, at: new Date('2026-01-10T08:00:00.000Z') });
    await addPhoto(deps, { entryKind: 'skinEntry', entryId: entry.id, sourceUri: 'secret' }); // sensitive by the area default
    mockParams.current = { id: 'area-penis' };
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

  it('SK-8 Go to date scrolls to the day, or the nearest earlier day, says so, and leaves the chart and the list complete', async () => {
    const deps = nowDeps();
    await logSkinEntry(deps, { areaId: 'area-chin', scores, at: new Date('2026-01-10T08:00:00.000Z') });
    await logSkinEntry(deps, { areaId: 'area-chin', scores, at: new Date('2026-01-14T08:00:00.000Z') });
    mockParams.current = { id: 'area-chin' };
    const { tree } = await mount(() => require('@/app/(tabs)/review/area'), deps);
    await flush();
    const scrollTo = tree.root.findAll((n) => n.instance && typeof n.instance.scrollTo === 'function')[0]!.instance.scrollTo as jest.Mock; // the jest ScrollView mock
    scrollTo.mockClear();
    const layoutOf = (day: string, y: number) =>
      act(async () => {
        const node = tree.root.findAll((n) => typeof n.props.onLayout === 'function' && n.findAll((c) => c.children.includes(day)).length > 0)[0]!;
        node.props.onLayout({ nativeEvent: { layout: { y } } });
      });
    await layoutOf('2026-01-14', 40);
    await layoutOf('2026-01-10', 400);
    mockPicker.last = undefined;
    await press(tree, en.review.goToDate);
    expect(mockPicker.last!.maximumDate).toBeInstanceOf(Date);
    const pick = (iso: string) => act(async () => mockPicker.last!.onValueChange({}, new Date(`${iso}T12:00:00`)));
    await pick('2026-01-12'); // no entry that day: the nearest earlier one is the 10th
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 392, animated: true });
    expect(hasText(tree, en.review.jumpEarlier.replace('{{picked}}', '2026-01-12').replace('{{shown}}', '2026-01-10'))).toBe(true);
    expect(hasText(tree, '2026-01-14')).toBe(true); // navigation, not a filter
    mockPicker.last = undefined;
    await press(tree, en.review.goToDate);
    await pick('2026-01-14'); // an exact hit says nothing
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 32, animated: true });
    expect(hasText(tree, 'No entry on')).toBe(false);
    mockPicker.last = undefined;
    await press(tree, en.review.goToDate);
    await pick('2026-01-02'); // before the first entry
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 392, animated: true });
    expect(hasText(tree, en.review.jumpOldest.replace('{{picked}}', '2026-01-02').replace('{{shown}}', '2026-01-10'))).toBe(true);
    mockParams.current = {};
  });

  it('EN-1, SK-8 a tap on an entry opens the day log sheet naming its photos; Edit opens the form and Delete reloads the timeline', async () => {
    const deps = nowDeps();
    const keep = await logSkinEntry(deps, { areaId: 'area-chin', scores, at: new Date('2026-01-10T08:00:00.000Z') });
    const doomed = await logSkinEntry(deps, { areaId: 'area-chin', scores: { ...scores, severity: 7 }, at: new Date('2026-01-12T08:00:00.000Z') });
    await addPhoto(deps, { entryKind: 'skinEntry', entryId: doomed.id, sourceUri: 'doomed-photo' });
    mockParams.current = { id: 'area-chin' };
    const sheet = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation((_o, cb) => cb(0)); // Edit
    const { tree } = await mount(() => require('@/app/(tabs)/review/area'), deps);
    await flush();
    const entries = () => tree.root.findAll((n) => n.props.accessibilityHint === en.review.entryHint && typeof n.props.onPress === 'function');
    expect(entries()).toHaveLength(2); // flare lines are derived and have no tap target
    await act(async () => entries()[0]!.props.onPress()); // newest day first: the 12th
    await flush();
    const [opts] = sheet.mock.calls[0] as unknown as [{ title: string; message: string; options: string[]; destructiveButtonIndex: number[] }];
    expect(opts.title).toBe(`${en.log.skin}: ${en.areas['area-chin']}`);
    expect(opts.message).toContain(`1 ${en.log.kinds.photos}`);
    expect(opts.options).toEqual([en.log.editAction, en.log.deleteAction, en.common.cancel]);
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/form/edit', params: { kind: 'skinEntries', id: doomed.id } });
    sheet.mockImplementation((_o, cb) => cb(1)); // Delete
    await act(async () => entries()[0]!.props.onPress());
    await flush();
    expect((await deps.repo.listSkinEntries()).map((e) => e.id)).toEqual([keep.id]);
    expect((await deps.repo.listTombstones()).map((x) => x.id)).toContain(doomed.id);
    expect(hasText(tree, '2026-01-12')).toBe(false); // the timeline reloaded
    expect(entries()).toHaveLength(1);
    jest.restoreAllMocks();
    mockParams.current = {};
  });

  it('SK-8, UX-10 while comparing photos the entry lines are off, so taps pick photos', async () => {
    const deps = nowDeps();
    const a = await logSkinEntry(deps, { areaId: 'area-chin', scores, at: new Date('2026-01-10T08:00:00.000Z') });
    const b = await logSkinEntry(deps, { areaId: 'area-chin', scores, at: new Date('2026-01-12T08:00:00.000Z') });
    await addPhoto(deps, { entryKind: 'skinEntry', entryId: a.id, sourceUri: 'one' });
    await addPhoto(deps, { entryKind: 'skinEntry', entryId: b.id, sourceUri: 'two' });
    mockParams.current = { id: 'area-chin' };
    const { tree } = await mount(() => require('@/app/(tabs)/review/area'), deps);
    await flush();
    const disabled = () => tree.root.findAll((n) => n.props.accessibilityHint === en.review.entryHint && typeof n.props.onPress === 'function').map((n) => n.props.disabled);
    expect(disabled()).toEqual([false, false]);
    await press(tree, en.review.compare);
    expect(disabled()).toEqual([true, true]);
    await press(tree, en.review.compareDone);
    expect(disabled()).toEqual([false, false]);
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
    const intimate = await logSkinEntry(deps, { areaId: 'area-penis', scores, at: new Date('2026-01-11T08:00:00.000Z') });
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
    expect(sensitiveLabel).toContain(en.areas['area-penis']);
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
    expect(hasText(tree, en.lock.failedTitle)).toBe(true); // the cancelled prompt turns the cover into the failed state: coral lock, Try again
    expect(hasText(tree, en.lock.failedBody)).toBe(true);
    expect(auth.prompts).toEqual([en.lock.reason]); // one prompt, not one per render
    auth.passes = true;
    await press(tree, en.lock.tryAgain);
    await flush();
    expect(lock.locked).toBe(false);
    expect(hasText(tree, en.lock.failedTitle)).toBe(false);
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
    expect(hasText(tree, en.lock.failedTitle)).toBe(true);
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
    await press(tree, en.lock.tryAgain);
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
  const switchOf = (tree: ReactTestRenderer, label: string) => tree.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onValueChange === 'function')[0]!;
  const sizeInput = (tree: ReactTestRenderer) => tree.root.findAll((n) => n.props.accessibilityLabel === en.skin.sizeMm && typeof n.props.onChangeText === 'function');

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
    expect(await deps.repo.listSkinEntries()).toEqual([]); // even a forced press saves nothing: an invalid size is an error, not "no size"
    await type(tree, en.skin.sizeMm, '14');
    await headerSave();
    expect(await deps.repo.listSkinEntries()).toMatchObject([{ cracks: true, sizeMm: 14 }]);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('SK-3 an empty size field saves no size, and the entry is not marked cracked unless the switch is on', async () => {
    const deps = nowDeps();
    await mount(() => require('@/app/form/skin'), deps);
    await flush();
    await headerSave();
    expect(await deps.repo.listSkinEntries()).toMatchObject([{ cracks: false, sizeMm: null }]);
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
    expect(await deps.repo.listSkinEntries()).toMatchObject([{ cracks: true, sizeMm: 22 }, { cracks: true, sizeMm: 22 }]);
    // another area without a size shows no Details content
    const { tree: second } = await mount(() => require('@/app/form/skin'), nowDeps());
    await flush();
    expect(sizeInput(second)).toHaveLength(0);
  });

  it('EN-1, SK-3 the edit form shows the saved flag and size, changes them, and clears the size with an empty field', async () => {
    const deps = nowDeps();
    const entry = await logSkinEntry(deps, { areaId: 'area-chin', scores: sc, cracks: true, sizeMm: 30, at: new Date(Date.now() - 3600_000) });
    mockParams.current = { kind: 'skinEntries', id: entry.id };
    const { tree } = await mount(() => require('@/app/form/edit'), deps);
    await flush();
    expect(switchOf(tree, en.skin.cracks).props.value).toBe(true);
    expect(sizeInput(tree)[0]!.props.value).toBe('30');
    await act(async () => switchOf(tree, en.skin.cracks).props.onValueChange(false));
    await type(tree, en.skin.sizeMm, '');
    await headerSave();
    expect(await deps.repo.listSkinEntries()).toMatchObject([{ id: entry.id, cracks: false, sizeMm: null }]);
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
    expect(hasText(chin.tree, en.review.trendSummary.replace('{{label}}', en.review.sizeChip).replace('{{first}}', '18').replace('{{last}}', '18').replace('{{min}}', '18').replace('{{max}}', '18').replace('{{from}}', localDay(new Date(Date.now() - 3 * 3600_000).toISOString(), 'Europe/Warsaw')).replace('{{to}}', localDay(new Date(Date.now() - 3 * 3600_000).toISOString(), 'Europe/Warsaw')))).toBe(true);
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
      await rendered.root.findAll((n) => n.props.accessibilityLabel === en.common.save && typeof n.props.onPress === 'function')[0]!.props.onPress();
    });
    await flush();
  };
  const selected = (tree: ReactTestRenderer, label: string) => tree.root.findAll((n) => n.props.accessibilityLabel === label && n.props.accessibilityState)[0]!.props.accessibilityState.selected;

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

describe('Time since the last treatment on a photo (SK-4)', () => {
  it('SK-4, SK-8 the area timeline says how long after the last treatment each photo was taken, or that none was logged', async () => {
    const deps = nowDeps();
    const cream = await addListItem(deps, 'treatments', 'Synthetic cream');
    const first = await logSkinEntry(deps, { areaId: 'area-chin', scores, at: new Date('2026-01-10T08:00:00.000Z') });
    await addPhoto(deps, { entryKind: 'skinEntry', entryId: first.id, sourceUri: 'before', at: new Date('2026-01-10T08:05:00.000Z') });
    await applyTreatment(deps, { treatmentId: cream.id, areaIds: ['area-chin'], at: new Date('2026-01-12T08:00:00.000Z') });
    const second = await logSkinEntry(deps, { areaId: 'area-chin', scores, at: new Date('2026-01-12T22:00:00.000Z') });
    await addPhoto(deps, { entryKind: 'skinEntry', entryId: second.id, sourceUri: 'after', at: new Date('2026-01-12T22:05:00.000Z') });
    mockParams.current = { id: 'area-chin' };
    const { tree } = await mount(() => require('@/app/(tabs)/review/area'), deps);
    await flush();
    expect(hasText(tree, en.derived.noTreatment)).toBe(true);
    expect(hasText(tree, en.derived.sinceTreatment.replace('{{elapsed}}', en.derived.hours.replace('{{n}}', '14')).replace('{{name}}', 'Synthetic cream'))).toBe(true);
    mockParams.current = {};
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
    expect(await deps.repo.listRecords('medicalEvents')).toMatchObject([{ kind: 'visit', title: 'Synthetic dermatology visit', note: 'a cream was prescribed', endDay: null }]);
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
    expect((await deps.repo.listRecords('medicalEvents')).find((e) => e.title === 'Synthetic flu')).toMatchObject({ kind: 'illness', endDay: end });
  });

  it('IN-18, EN-1 a log row names the kind and title (and until when), and the edit form changes and clears the end date', async () => {
    const deps = nowDeps();
    const e = await logMedicalEvent(deps, { kind: 'illness', title: 'Synthetic cold', at: new Date(Date.now() - 3600_000), endDay: dayOf(inDays(2)) });
    const today = await mount(() => require('@/app/(tabs)/today/index'), deps);
    await flush();
    expect(hasText(today.tree, en.log.medical.replace('{{kind}}', en.medical.kinds.illness).replace('{{title}}', 'Synthetic cold'))).toBe(true);
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
    await logMedicalEvent(deps, { kind: 'illness', title: 'Synthetic cold', at: new Date('2026-01-12T07:00:00.000Z'), endDay: '2026-01-14' });
    mockParams.current = { id: 'area-chin' };
    const { tree } = await mount(() => require('@/app/(tabs)/review/area'), deps);
    await flush();
    expect(hasText(tree, en.review.medicalStart.replace('{{kind}}', en.medical.kinds.illness).replace('{{title}}', 'Synthetic cold'))).toBe(true);
    expect(hasText(tree, en.review.medicalEnd.replace('{{title}}', 'Synthetic cold'))).toBe(true);
    mockParams.current = {};
  });
});

describe('Fill later with AI and My Claude plan (IN-20, LL-15)', () => {
  let alert: jest.SpyInstance;
  beforeEach(() => {
    alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockRouter.push.mockClear();
    mockRouter.back.mockClear();
    mockParams.current = {};
    mockScreen.options = undefined;
  });
  afterEach(() => jest.restoreAllMocks());
  const headerSave = async () => {
    let rendered!: ReactTestRenderer;
    await act(async () => {
      rendered = lastTree();
    });
    await act(async () => {
      await rendered.root.findAll((n) => n.props.accessibilityLabel === en.common.save && typeof n.props.onPress === 'function')[0]!.props.onPress();
    });
    await flush();
  };
  const switchOf = (tree: ReactTestRenderer, label: string) => tree.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onValueChange === 'function')[0]!;
  const buttonOf = (name: string) => alert.mock.calls.at(-1)![2].find((b: { text: string }) => b.text === name) as { onPress: () => unknown };
  const bytesOf = (o: object) => new TextEncoder().encode(JSON.stringify(o));
  const answer = (packId: string, over: object = {}) => ({ pack_id: packId, model: 'Synthetic Model 9', ...over });
  const longAgo = new Date('2026-06-12T10:00:00.000Z'); // three days before the pinned test date
  const days = () => ({ dayFrom: localDay(longAgo.toISOString(), 'Europe/Warsaw'), dayTo: localDay(new Date().toISOString(), 'Europe/Warsaw'), language: 'en' as const });

  it('IN-20 the meal and drink forms have the switch; the entry is saved as typed and its log row says it waits for AI', async () => {
    const deps = nowDeps();
    const meal = await mount(() => require('@/app/form/meal'), deps);
    await type(meal.tree, en.meal.description, 'Synthetic pancakes with jam');
    await press(meal.tree, en.meal.continue);
    expect(switchOf(meal.tree, en.fillLater.title).props.value).toBe(false);
    await act(async () => switchOf(meal.tree, en.fillLater.title).props.onValueChange(true));
    expect(hasText(meal.tree, en.fillLater.hint)).toBe(true);
    await headerSave();
    expect(await deps.repo.listMeals()).toMatchObject([{ description: 'Synthetic pancakes with jam', ingredients: [], fillLater: true }]);
    mockScreen.options = undefined;
    const drink = await mount(() => require('@/app/form/drink'), deps);
    await type(drink.tree, en.more.drinkName, 'Synthetic smoothie');
    await type(drink.tree, en.more.drinkAmount, '300');
    await act(async () => switchOf(drink.tree, en.fillLater.title).props.onValueChange(true));
    await headerSave();
    expect(await deps.repo.listRecords('drinks')).toMatchObject([{ name: 'Synthetic smoothie', fillLater: true }]);
    const today = await mount(() => require('@/app/(tabs)/today/index'), deps);
    await flush();
    expect(hasText(today.tree, en.fillLater.waiting)).toBe(true);
  });

  it('IN-20 the edit screen sets and clears the mark', async () => {
    const deps = nowDeps();
    const meal = await logMeal(deps, { description: 'Synthetic pancakes', ingredients: [], fillLater: true, at: new Date(Date.now() - 3600_000) });
    mockParams.current = { kind: 'meals', id: meal.id };
    const { tree } = await mount(() => require('@/app/form/edit'), deps);
    await flush();
    expect(switchOf(tree, en.fillLater.title).props.value).toBe(true);
    await act(async () => switchOf(tree, en.fillLater.title).props.onValueChange(false));
    await headerSave();
    expect((await deps.repo.listMeals())[0]!.fillLater).toBeUndefined();
  });

  it('IN-20 Today counts the suggestions and opens the list, whose rows open the entry with the suggestion', async () => {
    const deps = nowDeps();
    const meal = await logMeal(deps, { description: 'Synthetic pancakes', ingredients: [], fillLater: true, at: longAgo });
    const { packId } = await buildPack(deps, days());
    await importResult(deps, bytesOf(answer(packId, { fills: [{ kind: 'meal', id: meal.id, ingredients: ['wheat flour', 'milk'], allergens: ['milk'], note: null }] })));
    const today = await mount(() => require('@/app/(tabs)/today/index'), deps);
    await flush();
    expect(hasText(today.tree, en.cards.suggestions.replace('{{n}}', '1'))).toBe(true);
    await press(today.tree, en.cards.suggestions.replace('{{n}}', '1'));
    expect(mockRouter.push).toHaveBeenLastCalledWith('/today/suggestions');
    const list = await mount(() => require('@/app/(tabs)/today/suggestions'), deps);
    await flush();
    expect(hasText(list.tree, en.aiSuggestions.row.replace('{{n}}', '2').replace('{{model}}', 'Synthetic Model 9'))).toBe(true);
    await press(list.tree, 'Synthetic pancakes');
    const [s] = await listSuggestions(deps);
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/form/edit', params: { kind: 'meals', id: meal.id, suggestion: s!.id } });
    const empty = await mount(() => require('@/app/(tabs)/today/suggestions'), nowDeps());
    await flush();
    expect(hasText(empty.tree, en.aiSuggestions.none)).toBe(true);
  });

  it('IN-20, IN-10, IN-16 the suggestion is added as ordinary rows, its tags stay unselected until selected, and Save clears the mark and records name estimate (manual)', async () => {
    const deps = nowDeps();
    const meal = await logMeal(deps, { description: 'Synthetic pancakes', ingredients: ['my own jam'], fillLater: true, at: longAgo });
    const { packId } = await buildPack(deps, days());
    await importResult(deps, bytesOf(answer(packId, { fills: [{ kind: 'meal', id: meal.id, ingredients: ['wheat flour', 'milk', 'my own jam'], allergens: ['gluten', 'milk'], note: 'Recipes differ.' }] })));
    const [s] = await listSuggestions(deps);
    mockParams.current = { kind: 'meals', id: meal.id, suggestion: s!.id };
    const { tree } = await mount(() => require('@/app/form/edit'), deps);
    await flush();
    expect(hasText(tree, en.fillLater.panelIntro.replace('{{model}}', 'Synthetic Model 9'))).toBe(true);
    expect(hasText(tree, en.meal.unsure.replace('{{text}}', 'Recipes differ.'))).toBe(true);
    const selected = (label: string) => tree.root.findAll((n) => n.props.accessibilityLabel === label && n.props.accessibilityState)[0]!.props.accessibilityState.selected;
    expect(selected(en.allergens.milk)).toBe(false);
    await press(tree, en.meal.estimateAddAll);
    const field = () => tree.root.findAll((n) => n.props.accessibilityLabel === en.meal.ingredients && typeof n.props.onChangeText === 'function')[0]!.props.value;
    expect(field()).toBe('my own jam, wheat flour, milk, '); // typed text stays, a repeated name is not added twice
    await press(tree, en.meal.scanSelectTags);
    expect(selected(en.allergens.gluten)).toBe(true);
    await headerSave();
    expect((await deps.repo.listMeals())[0]).toMatchObject({ ingredients: ['my own jam', 'wheat flour', 'milk'], allergens: ['gluten', 'milk'], source: { kind: 'name_estimate', edited: false, aiTags: true, llm: { model: 'Synthetic Model 9', manual: true } } });
    expect((await deps.repo.listMeals())[0]!.fillLater).toBeUndefined();
    expect(await listSuggestions(deps)).toEqual([]);
  });

  it('IN-20 dismissing removes the suggestion and keeps the mark; a drink works the same way and a later change marks it edited', async () => {
    const deps = nowDeps();
    const meal = await logMeal(deps, { description: 'Synthetic pancakes', ingredients: [], fillLater: true, at: longAgo });
    const drink = await logDrink(deps, { name: 'Synthetic smoothie', amountMl: 300, fillLater: true, at: longAgo });
    const { packId } = await buildPack(deps, days());
    await importResult(deps, bytesOf(answer(packId, { fills: [{ kind: 'meal', id: meal.id, ingredients: ['flour'], allergens: [], note: null }, { kind: 'drink', id: drink.id, ingredients: ['banana', 'milk'], allergens: [], note: null }] })));
    const [first, second] = await listSuggestions(deps);
    mockParams.current = { kind: 'meals', id: meal.id, suggestion: first!.id };
    const a = await mount(() => require('@/app/form/edit'), deps);
    await flush();
    await press(a.tree, en.fillLater.dismiss);
    expect(hasText(a.tree, en.fillLater.panelIntro.replace('{{model}}', 'Synthetic Model 9'))).toBe(false);
    expect((await listSuggestions(deps)).map((x) => x.id)).toEqual([second!.id]);
    expect((await deps.repo.listMeals())[0]!.fillLater).toBe(true);
    mockParams.current = { kind: 'drinks', id: drink.id, suggestion: second!.id };
    mockScreen.options = undefined;
    const b = await mount(() => require('@/app/form/edit'), deps);
    await flush();
    await press(b.tree, 'banana');
    await press(b.tree, en.meal.estimateAddPicked);
    await type(b.tree, en.more.drinkIngredients, 'banana, oat milk'); // changed after the names were added
    await headerSave();
    expect((await deps.repo.listRecords('drinks'))[0]).toMatchObject({ ingredients: ['banana', 'oat milk'], source: { kind: 'name_estimate', edited: true, llm: { manual: true } } });
    expect((await deps.repo.listRecords('drinks'))[0]!.fillLater).toBeUndefined();
  });

  it('LL-15 the analysis screen links to My Claude plan, and a pack is prepared after a confirmation that lists the contents and the three notes', async () => {
    const deps = nowDeps();
    await logSkinEntry(deps, { areaId: 'area-chin', scores, at: longAgo });
    await logMeal(deps, { description: 'Synthetic pancakes', ingredients: [], fillLater: true, at: longAgo });
    const analysisScreen = await mount(() => require('@/app/(tabs)/review/analysis'), deps);
    await press(analysisScreen.tree, en.plan.link);
    expect(mockRouter.push).toHaveBeenLastCalledWith('/review/pack');
    const { tree, fileShare } = await mount(() => require('@/app/(tabs)/review/pack'), deps);
    await flush();
    expect(hasText(tree, en.plan.markedCount.replace('{{n}}', '1').split('"')[0]!)).toBe(true); // the text has quotes, which the tree dump escapes
    await press(tree, en.plan.prepare);
    const [title, body] = alert.mock.calls.at(-1) as unknown as [string, string];
    expect(title).toBe(en.plan.confirmTitle);
    for (const line of [en.plan.noteLeaves, en.plan.noteTerms, en.plan.noteBilling, en.plan.markedLine.replace('{{text}}', 'Synthetic pancakes')]) expect(body).toContain(line);
    expect(fileShare.saveAndShare).not.toHaveBeenCalled(); // nothing is written or shared before the confirmation
    await act(async () => {
      await buttonOf(en.plan.prepare).onPress();
    });
    await flush();
    expect(fileShare.saveAndShare).toHaveBeenCalledTimes(1);
    const [name, bytes, mime] = fileShare.saveAndShare.mock.calls[0] as unknown as [string, Uint8Array, string];
    expect(name).toMatch(/^nettle-pack-\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.zip$/);
    expect(mime).toBe('application/zip');
    expect(Object.keys(unzipSync(bytes)).sort()).toEqual(['INSTRUCTIONS.md', 'pack.json']);
  });

  it('LL-15 importing shows what the result would do and changes nothing until confirmed; a second import says it was done before', async () => {
    const deps = nowDeps();
    await logSkinEntry(deps, { areaId: 'area-chin', scores, at: longAgo });
    const meal = await logMeal(deps, { description: 'Synthetic pancakes', ingredients: [], fillLater: true, at: longAgo });
    const { packId } = await buildPack(deps, days());
    const result = bytesOf(answer(packId, { analysis: { summary: 'Synthetic summary', hypotheses: [], order_and_lag: 'none', data_limits: [], questions_for_doctor: [] }, fills: [{ kind: 'meal', id: meal.id, ingredients: ['flour'], allergens: [], note: null }] }));
    const pick = { saveAndShare: jest.fn(async () => undefined), pickFile: jest.fn(async () => result as unknown as null) };
    const { tree } = await mount(() => require('@/app/(tabs)/review/pack'), deps, pick);
    await press(tree, en.plan.import);
    await flush();
    expect(pick.pickFile).toHaveBeenCalledWith('json');
    const [title, body] = alert.mock.calls.at(-1) as unknown as [string, string];
    expect(title).toBe(en.plan.previewTitle);
    for (const line of [en.plan.previewModel.replace('{{model}}', 'Synthetic Model 9'), en.plan.previewAnalysis, en.plan.previewFills.replace('{{n}}', '1').replace('{{skipped}}', '0'), en.plan.previewNoChange]) expect(body).toContain(line);
    expect(await deps.repo.listRecords('analyses')).toEqual([]);
    await act(async () => {
      await buttonOf(en.plan.import).onPress();
    });
    await flush();
    expect(await deps.repo.listRecords('analyses')).toMatchObject([{ manual: true, model: 'Synthetic Model 9' }]);
    expect(String(alert.mock.calls.at(-1)![0])).toBe(en.plan.importedTitle);
    await press(tree, en.plan.import);
    await flush();
    expect(String(alert.mock.calls.at(-1)![0])).toBe(en.plan.alreadyTitle);
    expect(await deps.repo.listRecords('analyses')).toHaveLength(1);
    // an imported analysis says how it was made
    const view = await mount(() => require('@/app/(tabs)/review/analysis'), deps);
    await flush();
    await press(view.tree, en.analysis.view);
    expect(hasText(view.tree, en.plan.manualLabel.replace('{{model}}', 'Synthetic Model 9'))).toBe(true);
  });

  it('LL-15 a result for another pack, or a broken file, is refused with a message and nothing is stored', async () => {
    const deps = nowDeps();
    await logSkinEntry(deps, { areaId: 'area-chin', scores, at: longAgo });
    await buildPack(deps, days());
    const wrong = { saveAndShare: jest.fn(async () => undefined), pickFile: jest.fn(async () => bytesOf(answer('pack-aaaaaaaaaaaa', { report_summary: 'x' })) as unknown as null) };
    const { tree } = await mount(() => require('@/app/(tabs)/review/pack'), deps, wrong);
    await press(tree, en.plan.import);
    await flush();
    expect(String(alert.mock.calls.at(-1)![0])).toBe(en.errors.result_wrong_pack);
    wrong.pickFile.mockResolvedValueOnce(new TextEncoder().encode('not json') as unknown as null);
    await press(tree, en.plan.import);
    await flush();
    expect(String(alert.mock.calls.at(-1)![0])).toBe(en.errors.result_invalid);
    wrong.pickFile.mockResolvedValueOnce(null as never); // the picker was cancelled: nothing happens
    alert.mockClear();
    await press(tree, en.plan.import);
    await flush();
    expect(alert).not.toHaveBeenCalled();
    expect(await deps.repo.listRecords('reportSummaries')).toEqual([]);
  });

  it('LL-15 the Doctor report offers an imported summary for the same period and language', async () => {
    const deps = nowDeps();
    await logSkinEntry(deps, { areaId: 'area-chin', scores, at: longAgo });
    const { packId } = await buildPack(deps, { dayFrom: localDay(longAgo.toISOString(), 'Europe/Warsaw'), dayTo: localDay(new Date().toISOString(), 'Europe/Warsaw'), language: 'en' });
    await importResult(deps, bytesOf(answer(packId, { report_summary: 'Synthetic narrative for the doctor.' })));
    const { tree } = await mount(() => require('@/app/(tabs)/review/report'), deps);
    await flush();
    await press(tree, en.doctor.all);
    await flush();
    await press(tree, en.plan.useImported.replace('{{model}}', 'Synthetic Model 9'));
    expect(hasText(tree, en.doctor.summaryIncluded)).toBe(true);
    expect(hasText(tree, 'Synthetic narrative for the doctor.')).toBe(true);
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
  const dotButtons = (tree: ReactTestRenderer) => tree.root.findAll((n) => n.props.accessibilityRole === 'button' && /entries on the ring/.test(String(n.props.accessibilityLabel)) && typeof n.props.onPress === 'function');

  it('UX-2 an entry is a dot on the ring and a tap on the dot opens that entry\'s action sheet; close entries merge', async () => {
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
    expect(hasText(again.tree, '2 entries on the ring') || dotButtons(again.tree).some((n) => n.props.accessibilityLabel === '2 entries on the ring')).toBe(true);
  });

  it('UX-2 a long press on a quick action opens its full form, also for the stool tile that opens a sheet on a tap', async () => {
    const { tree } = await mount(today, nowDeps());
    await flush();
    const tile = tree.root.findAll((n) => n.props.accessibilityLabel === en.entry.stool.title && typeof n.props.onLongPress === 'function')[0]!;
    await act(async () => tile.props.onLongPress());
    expect(mockRouter.push).toHaveBeenLastCalledWith('/form/stool');
  });

  it('UX-2 Pin to Today is disabled at five pins', async () => {
    const edit = await mount(() => require('@/app/(tabs)/today/edit'), nowDeps());
    await flush();
    const pins = edit.tree.root.findAll((n) => n.props.accessibilityLabel === `${en.home.pin} ${en.entry.drink.title}` && n.props.accessibilityState !== undefined);
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

describe('Today states (UX-2, UX-3)', () => {
  beforeEach(() => {
    jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation((_o, cb) => cb(99));
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockRouter.push.mockClear();
  });
  afterEach(() => jest.restoreAllMocks());
  const today = () => require('@/app/(tabs)/today/index');

  it('UX-2 a merged dot lists its entries in a sheet; a tap on one opens that entry\'s Edit and Delete sheet', async () => {
    const deps = nowDeps();
    const at = Date.now() - 3 * 3600_000;
    await logMeal(deps, { description: 'Synthetic oats', ingredients: [], at: new Date(at) });
    await logDrink(deps, { name: 'Synthetic water', amountMl: 200, at: new Date(at + 600_000) });
    const { tree } = await mount(today, deps);
    await flush();
    const dot = tree.root.findAll((n) => n.props.accessibilityLabel === en.day.dot.replace('{{n}}', '2') && typeof n.props.onPress === 'function')[0]!;
    await act(async () => dot.props.onPress());
    await flush();
    expect(ActionSheetIOS.showActionSheetWithOptions).not.toHaveBeenCalled(); // the list comes first
    expect(hasText(tree, 'Synthetic oats')).toBe(true);
    expect(hasText(tree, 'Synthetic water, 200 ml')).toBe(true);
    const row = tree.root.findAll((n) => n.props.accessibilityLabel === 'Synthetic water, 200 ml' && typeof n.props.onPress === 'function')[0]!;
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
    await logChangeEvent(deps, { action: 'started', category: 'cat-product', name: 'Synthetic soap', at: new Date(Date.now() - 86_400_000) });
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
    expect(tree.root.findAll((n) => n.props.accessibilityRole === 'switch' && n.props.accessibilityLabel === en.regular.switch).length).toBeGreaterThan(0);
  });
});

describe('Meal extras: confirmations and results (IN-3, LL-5, LL-12)', () => {
  let alert: jest.SpyInstance;
  beforeEach(() => {
    alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    require('@/adapters/photos/pickPhotos').pickPhotoUris.mockResolvedValue(['file:///synthetic-meal.jpg']);
  });
  afterEach(() => {
    require('@/adapters/photos/pickPhotos').pickPhotoUris.mockResolvedValue([]);
    jest.restoreAllMocks();
  });
  const buttonOf = (name: string) => alert.mock.calls.at(-1)![2].find((b: { text: string }) => b.text === name) as { onPress: () => unknown };
  const meal = () => require('@/app/form/meal');

  it('LL-5 every confirmation names the model that will be used', async () => {
    const deps = nowDeps(new FakeLlm(['{"ingredients":["rice"],"uncertainty":null}']));
    await saveApiKey(deps, 'sk-synthetic-secret');
    const { tree } = await mount(meal, deps);
    await type(tree, en.meal.description, 'Synthetic dinner');
    await press(tree, en.meal.continue);
    await press(tree, en.meal.fromPhoto);
    await act(async () => {
      await buttonOf(en.photos.library).onPress();
    });
    expect(String(alert.mock.calls.at(-1)![1])).toContain(en.meal.confirmModel.replace('{{model}}', 'Haiku'));
    await press(tree, en.meal.fromName);
    expect(String(alert.mock.calls.at(-1)![1])).toContain(en.meal.confirmModel.replace('{{model}}', 'Haiku'));
  });

  it('IN-3 nothing is pre-selected: Add selected is disabled until an item is tapped', async () => {
    const deps = nowDeps(new FakeLlm(['{"ingredients":["rice","soy sauce"],"uncertainty":null}']));
    await saveApiKey(deps, 'sk-synthetic-secret');
    const { tree } = await mount(meal, deps);
    await type(tree, en.meal.description, 'Synthetic dinner');
    await press(tree, en.meal.continue);
    await press(tree, en.meal.fromPhoto);
    await act(async () => {
      await buttonOf(en.photos.library).onPress();
    });
    await act(async () => {
      void buttonOf(en.meal.photoSend).onPress();
    });
    await flush();
    const picked = () => tree.root.findAll((n) => n.props.accessibilityLabel === en.meal.estimateAddPicked && n.props.accessibilityState !== undefined);
    expect(picked().length).toBeGreaterThan(0);
    expect(picked().every((n) => n.props.accessibilityState.disabled === true)).toBe(true);
    await press(tree, 'soy sauce');
    expect(picked().every((n) => n.props.accessibilityState.disabled === false)).toBe(true);
  });

  it('IN-19, LL-8 a failed estimate says it added nothing and that the form is as it was', async () => {
    const { NettleError } = require('@/core/model/errors');
    const deps = nowDeps(new FakeLlm([new NettleError('llm_rate_limited')]));
    await saveApiKey(deps, 'sk-synthetic-secret');
    const { tree } = await mount(meal, deps);
    await type(tree, en.meal.description, 'Synthetic dinner');
    await press(tree, en.meal.continue);
    await press(tree, en.meal.fromName);
    await act(async () => {
      void buttonOf(en.meal.nameSend).onPress();
    });
    await flush();
    expect(hasText(tree, en.errors.llm_rate_limited)).toBe(true);
    expect(hasText(tree, en.meal.estimateUntouched)).toBe(true);
  });
});

describe('Trend range switch (SK-7, SK-8)', () => {
  it('SK-8 the chart shows 90 days by default; 30 days drops older points and All brings every point back', async () => {
    const deps = makeDeps(new MemoryRepo(), '2026-03-20T10:00:00.000Z');
    await saveCheckIn(deps, { at: new Date('2026-01-10T20:00:00.000Z'), values: { 'item-sleep': 7 }, confirmEmptyDay: true });
    await saveCheckIn(deps, { at: new Date('2026-03-10T20:00:00.000Z'), values: { 'item-sleep': 5 }, confirmEmptyDay: true });
    const { tree } = await mount(() => require('@/app/(tabs)/review/health'), deps);
    await flush();
    const summary = (from: string, first: number) => en.review.trendSummary.replace('{{label}}', en.tags['item-sleep']).replace('{{from}}', from).replace('{{to}}', '2026-03-10').replace('{{first}}', String(first)).replace('{{last}}', '5').replace('{{min}}', '5').replace('{{max}}', String(first === 5 ? 5 : 7));
    expect(hasText(tree, summary('2026-01-10', 7))).toBe(true); // 90 days back from 20 March reaches 20 Dec: January is in
    await press(tree, en.review.range['30d']);
    expect(hasText(tree, summary('2026-03-10', 5))).toBe(true); // only the March point
    await press(tree, en.review.range.all);
    expect(hasText(tree, summary('2026-01-10', 7))).toBe(true);
  });
});

describe('Settings additions (SK-8, NO-3, SE-9)', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('SK-8 the flare threshold has a scope: Same for all, or a value per skin area that the others follow', async () => {
    const deps = nowDeps();
    const { tree } = await mount(() => require('@/app/settings/logging'), deps);
    await flush();
    expect(hasText(tree, en.settings.flareScopeAreaHint)).toBe(false); // the per-area list is only there in the per-area scope
    await press(tree, en.settings.flareScopeArea);
    await flush();
    expect((await deps.repo.getPreferences())?.flareScope).toBe('perArea');
    expect(hasText(tree, en.settings.flareScopeAreaHint)).toBe(true);
    await press(tree, `${en.common.decrease} ${en.areas['area-chin']}`);
    await flush();
    expect((await deps.repo.getPreferences())?.flareThresholdByArea).toEqual({ 'area-chin': 7 }); // the common value 8, one lower
    await press(tree, `${en.settings.flareUseCommon} ${en.areas['area-chin']}`);
    await flush();
    expect((await deps.repo.getPreferences())?.flareThresholdByArea).toEqual({});
  });

  it('NO-3 with notifications blocked a coral banner offers the iPhone settings, and the reminder switches are disabled', async () => {
    const deps = nowDeps();
    (deps.notifier as unknown as { granted: boolean }).granted = false;
    const { tree } = await mount(() => require('@/app/settings/reminders'), deps);
    await flush();
    expect(hasText(tree, en.regular.denied)).toBe(true);
    expect(hasText(tree, en.regular.openSystem)).toBe(true);
    const sw = tree.root.findAll((n) => n.props.accessibilityRole === 'switch' && n.props.accessibilityLabel === en.reminders.checkIn && n.props.accessibilityState !== undefined);
    expect(sw.length).toBeGreaterThan(0);
    expect(sw.every((n) => n.props.accessibilityState.disabled === true)).toBe(true);
  });

  it('SE-9 Delete data stays disabled until something is chosen, and says so', async () => {
    const { tree } = await mount(() => require('@/app/settings/data'), nowDeps());
    await flush();
    expect(hasText(tree, en.delete.chooseFirst)).toBe(true);
    const btn = tree.root.findAll((n) => n.props.accessibilityLabel === en.delete.button && n.props.accessibilityState !== undefined);
    expect(btn.every((n) => n.props.accessibilityState.disabled === true)).toBe(true);
    await press(tree, en.delete.groups.health);
    expect(hasText(tree, en.delete.chooseFirst)).toBe(false);
  });
});

describe('Lock cover states (SE-8)', () => {
  it('SE-8 the cover is gone after the automatic prompt passes, and no entry is shown', async () => {
    const deps = nowDeps();
    await logMeal(deps, { description: 'Synthetic secret meal', ingredients: [], at: new Date(Date.now() - 3600_000) });
    await deps.settings.set('appLockEnabled', '1');
    const lock = new AppLock(deps);
    await lock.init();
    (deps.auth as unknown as FakeAuth).passes = true;
    services.__state.current = { deps, fileShare: { saveAndShare: jest.fn(), pickFile: jest.fn() }, analysisRunner: new AnalysisRunner(deps), appLock: lock };
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(React.createElement(require('@/ui/LockOverlay').LockOverlay));
    });
    await flush();
    expect(lock.locked).toBe(false); // the automatic prompt passed
    expect(hasText(tree, 'Synthetic secret meal')).toBe(false);
  });

  it('SE-8 a failed attempt reuses the cover with Try again and Use passcode', async () => {
    const deps = nowDeps();
    await deps.settings.set('appLockEnabled', '1');
    const lock = new AppLock(deps);
    await lock.init();
    (deps.auth as unknown as FakeAuth).passes = false;
    services.__state.current = { deps, fileShare: { saveAndShare: jest.fn(), pickFile: jest.fn() }, analysisRunner: new AnalysisRunner(deps), appLock: lock };
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(React.createElement(require('@/ui/LockOverlay').LockOverlay));
    });
    await flush();
    expect(lock.failed).toBe(true);
    expect(hasText(tree, en.lock.failedTitle)).toBe(true);
    expect(hasText(tree, en.lock.usePasscode)).toBe(true);
    (deps.auth as unknown as FakeAuth).passes = true;
    await press(tree, en.lock.usePasscode);
    await flush();
    expect(lock.locked).toBe(false);
    expect(lock.failed).toBe(false);
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
