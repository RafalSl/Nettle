import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { MemoryRepo } from '../fakes/memoryRepo';
import { makeDeps } from '../helpers/fixtures';

// Native modules and the router are replaced; everything else (screens, components, i18n, use cases) is real.
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    useFocusEffect: (cb: () => void | (() => void)) => useEffect(cb, [cb]),
    useRouter: () => ({ push: jest.fn() }),
    Tabs: Object.assign(({ children }: { children: unknown }) => children, { Screen: () => null }),
  };
});
jest.mock('@react-native-community/datetimepicker', () => () => null);
jest.mock('expo-image-picker', () => ({}));
jest.mock('@/adapters/photos/pickPhotos', () => ({ pickPhotoUris: jest.fn(async () => []) }));
jest.mock('@/services', () => {
  const state: { current: unknown } = { current: null };
  return { __state: state, useServices: () => state.current, ServicesProvider: ({ children }: { children: unknown }) => children };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const services = require('@/services') as { __state: { current: unknown } };

const screens: [string, () => { default: React.ComponentType }][] = [
  ['meal (index)', () => require('@/app/index')],
  ['today', () => require('@/app/today')],
  ['skin', () => require('@/app/skin')],
  ['more', () => require('@/app/more')],
  ['data', () => require('@/app/data')],
  ['analysis', () => require('@/app/analysis')],
];

const textOf = (r: ReactTestRenderer): string => JSON.stringify(r.toJSON());

describe('screens render without crashing (NF-3)', () => {
  beforeEach(async () => {
    const deps = makeDeps(new MemoryRepo());
    services.__state.current = {
      deps,
      fileShare: { saveAndShare: jest.fn(), pickFile: jest.fn(async () => null) },
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

  it('the root layout declares every tab screen it lists', () => {
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
import { Alert } from 'react-native';
import { unzipSync } from 'fflate';
import { FakeLlm } from '../fakes/fakeLlm';
import { logMeal } from '@/core/usecases/logMeal';
import { logSkinEntry } from '@/core/usecases/skin';
import { saveApiKey } from '@/core/usecases/llm';
import { localDay } from '@/core/model/time';
import en from '@/i18n/en.json';

type Deps = ReturnType<typeof makeDeps>;
const scores = { severity: 1, itch: 2, pain: 3, dryness: 4, scaling: 5 };

async function mount(load: () => { default: React.ComponentType }, deps: Deps, fileShare = { saveAndShare: jest.fn(async () => undefined), pickFile: jest.fn(async () => null) }) {
  services.__state.current = { deps, fileShare };
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
const nowDeps = (llm = new FakeLlm()) => makeDeps(new MemoryRepo(), new Date().toISOString(), llm);
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
      [() => require('@/app/index'), en.meal.title],
      [() => require('@/app/today'), en.today.title],
      [() => require('@/app/skin'), en.skin.title],
      [() => require('@/app/more'), en.more.nailTitle],
      [() => require('@/app/data'), en.data.exportTitle],
      [() => require('@/app/analysis'), en.analysis.title],
    ];
    for (const [load, title] of titles) {
      const { tree } = await mount(load, nowDeps());
      expect(hasText(tree, title)).toBe(true);
    }
  });

  it('IN-1 typing a meal and pressing Save stores it and shows it under Recent', async () => {
    const deps = nowDeps();
    const { tree } = await mount(() => require('@/app/index'), deps);
    await type(tree, en.meal.ingredientPlaceholder, 'Synthetic oats');
    await type(tree, 'Meal description', 'x').catch(() => undefined);
    const description = tree.root.findAll((n) => n.props.onChangeText && n.props.value === '' && n.props.placeholder === undefined)[0]!;
    await act(async () => description.props.onChangeText('Synthetic breakfast'));
    await press(tree, en.common.save);
    await flush();
    const meals = await deps.repo.listMeals();
    expect(meals).toHaveLength(1);
    expect(meals[0]).toMatchObject({ description: 'Synthetic breakfast', ingredients: ['Synthetic oats'] });
    expect(hasText(tree, 'Synthetic breakfast')).toBe(true);
  });

  it('SK-7, SK-11 the check-in saves, closes the day, and can be reopened', async () => {
    const deps = nowDeps();
    const { tree } = await mount(() => require('@/app/today'), deps);
    await press(tree, `${en.common.increase} ${en.today.wellbeing}`);
    await press(tree, `${en.common.increase} ${en.today.wellbeing}`);
    await press(tree, en.today.saveClose);
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
    const { tree } = await mount(() => require('@/app/skin'), deps);
    await flush();
    await press(tree, en.skin.noChange);
    await flush();
    const entries = await deps.repo.listSkinEntries();
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.scores)).toEqual([scores, scores]);
  });

  it('SK-6 a flare can be started and then ended from the skin screen', async () => {
    const deps = nowDeps();
    const { tree } = await mount(() => require('@/app/skin'), deps);
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
    const { tree } = await mount(() => require('@/app/more'), deps);
    await type(tree, en.more.nailAreaName, 'Synthetic thumb');
    await press(tree, en.more.nailAddArea);
    await type(tree, en.more.treatmentNew, 'Synthetic cream');
    await press(tree, en.more.treatmentAdd);
    await flush();
    expect((await deps.repo.listAreas()).some((a) => a.kind === 'nail' && a.name === 'Synthetic thumb')).toBe(true);
    expect((await deps.repo.listItems('treatments')).map((t) => t.name)).toEqual(['Synthetic cream']);
  });

  it('SE-2 the key is saved to the key store, cleared from the field and never shown', async () => {
    const deps = nowDeps();
    const { tree } = await mount(() => require('@/app/data'), deps);
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
    const { tree, fileShare } = await mount(() => require('@/app/data'), deps);
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
    const { tree, fileShare } = await mount(() => require('@/app/data'), deps);
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
    const { tree } = await mount(() => require('@/app/analysis'), deps);
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
    const { tree } = await mount(() => require('@/app/analysis'), deps);
    await flush();
    await press(tree, en.analysis.review);
    const confirm = alert.mock.calls.find((c) => c[0] === en.analysis.confirmTitle)!;
    await act(async () => {
      await (confirm[2] as { text: string; onPress?: () => void }[]).find((b) => b.text === en.analysis.send)!.onPress!();
    });
    expect(alert.mock.calls.some((c) => c[0] === en.errors.llm_rate_limited)).toBe(true);
    expect(await deps.repo.listRecords('analyses')).toEqual([]);
  });
});
