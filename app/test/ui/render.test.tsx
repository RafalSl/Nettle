/* eslint-disable @typescript-eslint/no-require-imports -- screens are loaded lazily, after the harness mocks are in place */
import { create, mockRouter, mockScreen, services, screens, textOf, mount, press, nowDeps } from './harness';
import React from 'react';
import { AnalysisRunner } from '@/core/usecases/analysisRunner';
import { AppLock } from '@/core/usecases/appLock';
import en from '@/i18n/en.json';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { MemoryRepo } from '../fakes/memoryRepo';
import { makeDeps } from '../helpers/fixtures';

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
      [en.nav.language, '/settings/language'], // UX-7: first row of the About group
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
    for (const screen of ['TodayScreen', 'ReviewScreen'])
      expect(fs.readFileSync(path.join(root, `../screens/${screen}.tsx`), 'utf8')).toContain('GearButton'); // both tabs draw their own header (UX-12)
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
      const names = [...fs.readFileSync(path.join(root, layout), 'utf8').matchAll(/<(?:Stack|Tabs)\.Screen name="([^"]+)"/g)].map(
        (m) => m[1]!,
      );
      for (const name of names) {
        const ok =
          ['.tsx', '/index.tsx'].some((ext) => fs.existsSync(path.join(dir, name + ext))) ||
          fs.existsSync(path.join(dir, name, '_layout.tsx'));
        expect(`${layout}: ${name} ${ok}`).toBe(`${layout}: ${name} true`);
      }
    }
    for (const key of [
      'settings',
      'more',
      'meal',
      'skin',
      'checkin',
      'intake',
      'treatment',
      'nails',
      'reaction',
      'change',
      'logging',
      'reminders',
      'ai',
      'data',
    ] as const) {
      expect(en.nav[key].length).toBeLessThan(15);
    }
    expect(Object.keys(en.tabs)).toEqual(['today', 'review']);
  });
});
