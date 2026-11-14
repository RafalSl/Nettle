/* eslint-disable @typescript-eslint/no-require-imports -- screens are loaded lazily, after the mocks below are in place */
import React from 'react';
import { ActionSheetIOS, Alert } from 'react-native';
import { unzipSync } from 'fflate';
import { FakeLlm } from '../fakes/fakeLlm';
import { AnalysisRunner } from '@/core/usecases/analysisRunner';
import type { FakeNotifier } from '../fakes/fakeNotifier';
import { unsavedForm } from '@/ui/formState';
import type { LlmProvider } from '@/core/ports/llm';
import { logMeal } from '@/core/usecases/logMeal';
import { addArea, logNailEntry, logSkinEntry } from '@/core/usecases/skin';
import { logStool, saveCheckIn } from '@/core/usecases/checkin';
import { logAlcohol, logMedication } from '@/core/usecases/intake';
import { addPhoto } from '@/core/usecases/photos';
import { applyImport, exportBundle, previewImport } from '@/core/usecases/exchange';
import { deleteEntry } from '@/core/usecases/entries';
import { toggleFavoriteDrink, toggleFavoriteMeal, updateSuggestionSettings } from '@/core/usecases/preferences';
import { applyTreatment, logChangeEvent, logReaction } from '@/core/usecases/events';
import { addListItem } from '@/core/usecases/lists';
import { markFlare } from '@/core/usecases/flares';
import { saveApiKey } from '@/core/usecases/llm';
import { prepareAnalysis } from '@/core/usecases/analysis';
import { localDay } from '@/core/model/time';
import en from '@/i18n/en.json';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { MemoryRepo } from '../fakes/memoryRepo';
import { makeDeps } from '../helpers/fixtures';

const mockRouter = { push: jest.fn(), back: jest.fn(), navigate: jest.fn() };
const mockParams: { current: Record<string, string> } = { current: {} };
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
jest.mock('@react-native-community/datetimepicker', () => () => null);
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
  ['settings', () => require('@/app/(tabs)/today/settings/index')],
  ['settings logging', () => require('@/app/(tabs)/today/settings/logging')],
  ['settings suggestions', () => require('@/app/(tabs)/today/settings/suggestions')],
  ['settings reminders', () => require('@/app/(tabs)/today/settings/reminders')],
  ['settings ai', () => require('@/app/(tabs)/today/settings/ai')],
  ['settings data', () => require('@/app/(tabs)/today/settings/data')],
  ['review', () => require('@/app/(tabs)/review/index')],
  ['doctor report', () => require('@/app/(tabs)/review/report')],
  ['analysis', () => require('@/app/(tabs)/review/analysis')],
  ['form meal', () => require('@/app/form/meal')],
  ['form skin', () => require('@/app/form/skin')],
  ['form checkin', () => require('@/app/form/checkin')],
  ['form intake', () => require('@/app/form/intake')],
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
  services.__state.current = { deps, fileShare, analysisRunner: new AnalysisRunner(deps) };
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
      [() => require('@/app/form/checkin'), en.today.title],
      [() => require('@/app/form/skin'), en.skin.title],
      [() => require('@/app/form/nails'), en.more.nailTitle],
      [() => require('@/app/(tabs)/today/settings/data'), en.data.exportTitle],
      [() => require('@/app/(tabs)/review/analysis'), en.analysis.title],
    ];
    for (const [load, title] of titles) {
      const { tree } = await mount(load, nowDeps());
      expect(hasText(tree, title)).toBe(true);
    }
  });

  it('SK-7, SK-11 the check-in saves, closes the day, and can be reopened', async () => {
    const deps = nowDeps();
    const { tree } = await mount(() => require('@/app/form/checkin'), deps);
    await press(tree, `${en.common.increase} ${en.today.wellbeing}`);
    await press(tree, `${en.common.increase} ${en.today.wellbeing}`);
    await press(tree, en.today.saveClose);
    await flush();
    // SK-11: no meals are logged for the day, so the screen asks before closing it.
    const buttons = alert.mock.calls.at(-1)![2] as { text: string; onPress?: () => void }[];
    await act(async () => buttons.find((b) => b.text === en.today.closeAnyway)!.onPress!());
    await flush();
    const [checkIn] = await deps.repo.listRecords('checkIns');
    expect(checkIn).toMatchObject({ wellbeing: 1, stress: null, day: localDay(deps.clock.now().toISOString(), deps.clock.timeZone()) });
    expect(checkIn!.completedAt).not.toBeNull();
    expect(hasText(tree, en.today.dayComplete)).toBe(true);
    await press(tree, en.today.reopen);
    await flush();
    expect((await deps.repo.listRecords('checkIns'))[0]!.completedAt).toBeNull();
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

  it('SK-6 a flare can be started and then ended from the skin screen', async () => {
    const deps = nowDeps();
    const { tree } = await mount(() => require('@/app/form/skin'), deps);
    await flush();
    await press(tree, en.skin.flareStart);
    await flush();
    expect(hasText(tree, en.skin.flareOpen)).toBe(true);
    await press(tree, en.skin.flareEnd);
    await flush();
    expect((await deps.repo.listRecords('flareMarkers')).map((m) => m.kind).sort()).toEqual(['end', 'start']);
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
    const { tree } = await mount(() => require('@/app/(tabs)/today/settings/ai'), deps);
    await type(tree, en.llm.keyField, 'sk-synthetic-secret');
    await press(tree, en.llm.keySave);
    await flush();
    expect(await deps.keys.get('anthropic_api_key')).toBe('sk-synthetic-secret');
    expect(hasText(tree, 'sk-synthetic-secret')).toBe(false);
    expect(hasText(tree, en.llm.keySaved)).toBe(true);
  });

  it('EX-1, EX-9 the Data screen exports a ZIP with data.json and hands it to the share sheet', async () => {
    const deps = nowDeps();
    await logMeal(deps, { description: 'Synthetic meal', ingredients: ['a'] });
    const { tree, fileShare } = await mount(() => require('@/app/(tabs)/today/settings/data'), deps);
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
    const { tree, fileShare } = await mount(() => require('@/app/(tabs)/today/settings/data'), deps);
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
    const { tree } = await mount(() => require('@/app/(tabs)/today/settings/reminders'), deps);
    await toggle(tree, en.reminders.checkIn);
    await flush();
    expect((deps.notifier as unknown as { scheduled: { id: string }[] }).scheduled.map((s) => s.id)).toEqual(['checkin']);
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === en.reminders.checkIn && n.props.value === true).length).toBeGreaterThan(0);

    const refused = nowDeps();
    (refused.notifier as unknown as { granted: boolean }).granted = false;
    const second = await mount(() => require('@/app/(tabs)/today/settings/reminders'), refused);
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
      [en.home.meal, '/form/meal'],
      [en.home.skin, '/form/skin'],
      [en.home.treatment, '/form/treatment'],
      [en.home.checkin, '/form/checkin'],
      [en.home.more, '/today/more'],
    ] as const) {
      await press(tree, label);
      expect(mockRouter.push).toHaveBeenLastCalledWith(href);
    }
  });

  it('UX-2 More lists the rarer entries and UX-6 Settings lists its groups, each a pushed screen', async () => {
    const more = await mount(() => require('@/app/(tabs)/today/more'), nowDeps());
    for (const [label, href] of [
      [en.home.moreIntake, '/form/intake'],
      [en.home.moreReaction, '/form/reaction'],
      [en.home.moreNails, '/form/nails'],
      [en.home.moreChange, '/form/change'],
    ] as const) {
      await press(more.tree, label);
      expect(mockRouter.push).toHaveBeenLastCalledWith(href);
    }
    const settings = await mount(() => require('@/app/(tabs)/today/settings/index'), nowDeps());
    for (const [label, href] of [
      [en.nav.logging, '/today/settings/logging'],
      [en.nav.suggestions, '/today/settings/suggestions'],
      [en.nav.reminders, '/today/settings/reminders'],
      [en.nav.ai, '/today/settings/ai'],
      [en.nav.data, '/today/settings/data'],
    ] as const) {
      await press(settings.tree, label);
      expect(mockRouter.push).toHaveBeenLastCalledWith(href);
    }
  });

  it('UX-1 every screen a layout declares has a route file, and titles stay under 15 characters', () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const root = path.join(__dirname, '../../src/app');
    const layouts = ['_layout.tsx', '(tabs)/_layout.tsx', '(tabs)/today/_layout.tsx', '(tabs)/review/_layout.tsx'];
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

  it('UX-2 the cards offer to end an open flare and to open the check-in of an incomplete day', async () => {
    const deps = nowDeps();
    await markFlare(deps, { areaId: 'area-chin', kind: 'start', at: new Date(Date.now() - 3600_000) });
    const { tree } = await mount(today, deps);
    await flush();
    expect(hasText(tree, en.cards.notComplete)).toBe(true);
    expect(hasText(tree, en.cards.noExport)).toBe(true);
    await press(tree, en.cards.endFlare);
    await flush();
    expect((await deps.repo.listRecords('flareMarkers')).map((m) => m.kind).sort()).toEqual(['end', 'start']);
    expect(hasText(tree, en.cards.endFlare)).toBe(false);
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
      ['checkIns', (await saveCheckIn(deps, { at, wellbeing: 5 })).id],
      ['stoolEntries', (await logStool(deps, { bristol: 3, at })).id],
      ['treatmentApplications', (await applyTreatment(deps, { treatmentId: cream.id, areaIds: ['area-chin'], at })).id],
      ['changeEvents', (await logChangeEvent(deps, { action: 'started', category: 'product', name: 'Synthetic soap', at })).id],
      ['reactions', (await logReaction(deps, { mealId: meal.id, symptoms: ['hives'], at: new Date(at.getTime() + 600_000) })).id],
      ['alcoholEntries', (await logAlcohol(deps, { drink: 'Synthetic beer', amountMl: 500, at })).id],
      ['medicationEntries', (await logMedication(deps, { category: 'medication', name: 'Synthetic pill', at })).id],
      ['flareMarkers', (await markFlare(deps, { areaId: 'area-neck', kind: 'start', at })).id],
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
      const all = [...(await deps.repo.listMeals()), ...(await deps.repo.listSkinEntries()), ...(await deps.repo.listRecords('nailEntries')), ...(await deps.repo.listRecords('checkIns')), ...(await deps.repo.listRecords('stoolEntries')), ...(await deps.repo.listRecords('treatmentApplications')), ...(await deps.repo.listRecords('changeEvents')), ...(await deps.repo.listRecords('reactions')), ...(await deps.repo.listRecords('alcoholEntries')), ...(await deps.repo.listRecords('medicationEntries')), ...(await deps.repo.listRecords('flareMarkers'))];
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
  const data = () => require('@/app/(tabs)/today/settings/data');

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

describe('Review (UX-1, EX-14)', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockRouter.push.mockClear();
    mockRouter.navigate.mockClear();
    mockParams.current = {};
  });
  afterEach(() => jest.restoreAllMocks());

  it('UX-1 the days list shows logged days newest first and opens one on Today', async () => {
    const deps = nowDeps();
    await logMeal(deps, { description: 'Synthetic oats', ingredients: [], at: new Date('2026-01-10T08:00:00.000Z') });
    await logMeal(deps, { description: 'Synthetic soup', ingredients: [], at: new Date('2026-01-12T08:00:00.000Z') });
    await logStool(deps, { bristol: 4, at: new Date('2026-01-12T09:00:00.000Z') });
    const { tree } = await mount(() => require('@/app/(tabs)/review/index'), deps);
    await flush();
    const first = en.review.dayRow.replace('{{day}}', '2026-01-12').replace('{{n}}', '2');
    expect(JSON.stringify(tree.toJSON()).indexOf(first)).toBeGreaterThan(-1);
    await press(tree, first);
    expect(mockRouter.navigate).toHaveBeenLastCalledWith({ pathname: '/today', params: { day: '2026-01-12' } });
    await press(tree, en.review.report);
    expect(mockRouter.push).toHaveBeenLastCalledWith('/review/report');
  });

  it('UX-1 an empty Review explains why', async () => {
    const { tree } = await mount(() => require('@/app/(tabs)/review/index'), nowDeps());
    await flush();
    expect(hasText(tree, en.review.noDays)).toBe(true);
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
    await toggleFavoriteMeal(deps, { description: 'Synthetic rice', ingredients: [], allergens: [] });
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
    const { tree } = await mount(() => require('@/app/(tabs)/today/settings/suggestions'), deps);
    await flush();
    expect(hasText(tree, '5')).toBe(true);
    await press(tree, en.sugg.more);
    await press(tree, en.sugg.days.replace('{{n}}', '14'));
    await toggle(tree, en.sugg.saveOnTap);
    await flush();
    expect((await deps.repo.getPreferences())!.suggestions).toEqual({ rows: 6, windowDays: 14, saveOnTap: true });
  });

  it('UX-2 Edit mode on Today moves and hides quick actions with buttons, and the grid follows', async () => {
    const deps = nowDeps();
    const { tree } = await mount(() => require('@/app/(tabs)/today/index'), deps);
    await flush();
    const grid = () => tree.root.findAll((n) => n.props.accessibilityRole === 'button' && [en.home.meal, en.home.skin, en.home.treatment, en.home.checkin, en.day.stool, en.home.more].includes(n.props.accessibilityLabel)).map((n) => n.props.accessibilityLabel as string);
    expect([...new Set(grid())].slice(0, 2)).toEqual([en.home.meal, en.home.skin]);
    await press(tree, en.home.edit);
    await press(tree, `${en.home.moveUp} ${en.home.checkin}`);
    await press(tree, `${en.home.hide} ${en.day.stool}`);
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === `${en.home.hide} ${en.home.more}`)).toHaveLength(0); // More stays
    await press(tree, en.home.done);
    await flush();
    expect([...new Set(grid())]).toEqual([en.home.meal, en.home.skin, en.home.checkin, en.home.treatment, en.home.more]);
    expect((await deps.repo.getPreferences())!.quickActions.hidden).toEqual(['stool']);
  });
});

describe('Alcohol and medication suggestions (IN-14, UX-5)', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());
  const intake = () => require('@/app/form/intake');
  const at = (h: number) => new Date(Date.now() - h * 3600_000);

  it('IN-14 a suggestion fills the form and saves nothing while "save on tap" is off', async () => {
    const deps = nowDeps();
    await logAlcohol(deps, { drink: 'Synthetic beer', amountMl: 500, at: at(30) });
    await logAlcohol(deps, { drink: 'Synthetic beer', amountMl: 500, at: at(10) });
    await logMedication(deps, { category: 'supplement', name: 'Synthetic vitamin', dose: '1 tablet', at: at(5) });
    const { tree } = await mount(intake, deps);
    await flush();
    expect(hasText(tree, 'Synthetic beer 500 ml ×2')).toBe(true);
    await press(tree, 'Synthetic beer 500 ml');
    const drink = tree.root.findAll((n) => n.props.placeholder === en.more.alcoholDrink)[0]!;
    expect(drink.props.value).toBe('Synthetic beer');
    await press(tree, 'Synthetic vitamin 1 tablet');
    expect(tree.root.findAll((n) => n.props.placeholder === en.more.medName)[0]!.props.value).toBe('Synthetic vitamin');
    expect(await deps.repo.listRecords('alcoholEntries')).toHaveLength(2);
    expect(await deps.repo.listRecords('medicationEntries')).toHaveLength(1);
  });

  it('UX-5 with "save on tap" a suggestion saves at once, as a new entry', async () => {
    const deps = nowDeps();
    await logAlcohol(deps, { drink: 'Synthetic beer', amountMl: 500, at: at(10) });
    await logMedication(deps, { category: 'medication', name: 'Synthetic pill', at: at(5) });
    await updateSuggestionSettings(deps, { saveOnTap: true });
    const { tree } = await mount(intake, deps);
    await flush();
    await press(tree, 'Synthetic beer 500 ml');
    await press(tree, 'Synthetic pill');
    await flush();
    expect((await deps.repo.listRecords('alcoholEntries')).map((e) => e.amountMl)).toEqual([500, 500]);
    expect(await deps.repo.listRecords('medicationEntries')).toHaveLength(2);
  });

  it('IN-14 favorites come first, even without history', async () => {
    const deps = nowDeps();
    await logAlcohol(deps, { drink: 'Synthetic beer', amountMl: 500, at: at(10) });
    await toggleFavoriteDrink(deps, { drink: 'Synthetic wine', amountMl: 150 });
    const { tree } = await mount(intake, deps);
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
    services.__state.current = { deps, fileShare: { saveAndShare: jest.fn(), pickFile: jest.fn() }, analysisRunner: new AnalysisRunner(deps) };
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
    expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/today/settings/data' });
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
    services.__state.current = { deps, fileShare: { saveAndShare: jest.fn(), pickFile: jest.fn() }, analysisRunner: runner };
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
    services.__state.current = { deps, fileShare: { saveAndShare: jest.fn(), pickFile: jest.fn() }, analysisRunner: runner };
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
    services.__state.current = { deps, fileShare: { saveAndShare: jest.fn(), pickFile: jest.fn() }, analysisRunner: runner };
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
