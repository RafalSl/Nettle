/* eslint-disable @typescript-eslint/no-require-imports -- screens are loaded lazily, after the mocks below are in place */
/**
 * The shared harness of the screen tests: native modules and the router are mocked, everything else (screens,
 * components, i18n, use cases) is real. Import it first in a screen test file, so the mocks are in place before any
 * screen is required. Its beforeEach and afterEach pin the date and unmount every tree after a test.
 */
import React from 'react';
import { FakeLlm } from '../fakes/fakeLlm';
import { AnalysisRunner } from '@/core/usecases/analysisRunner';
import { AppLock } from '@/core/usecases/appLock';
import type { LlmProvider } from '@/core/ports/llm';
import { act, create as createRenderer, type ReactTestRenderer } from 'react-test-renderer';
import { MemoryRepo } from '../fakes/memoryRepo';
import { makeDeps } from '../helpers/fixtures';

// The first test of a file loads and compiles every screen it touches; with the files running in parallel that can
// take longer than Jest's 5 seconds, so screen tests get more time.
jest.setTimeout(30_000);

// Every tree a test creates is unmounted after it, so no screen timer (Today refreshes every minute) keeps Jest alive.
const created: ReactTestRenderer[] = [];
export const create: typeof createRenderer = (...args) => {
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

export const mockRouter = { push: jest.fn(), back: jest.fn(), navigate: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) };
export const mockCamera: { props?: { onBarcodeScanned?: (e: { data: string }) => void } } = {};
export const mockPermission: { current: { granted: boolean; canAskAgain: boolean } | null } = {
  current: { granted: true, canAskAgain: true },
};
export const mockParams: { current: Record<string, string> } = { current: {} };
export type MockPickerProps = { maximumDate?: Date; value?: Date; onValueChange: (e: object, d: Date) => void };
export const mockPicker: { last?: MockPickerProps; all: MockPickerProps[] } = { all: [] };
export type MockScreenOptions = { headerLeft?: () => React.ReactElement; headerRight?: () => React.ReactElement; gestureEnabled?: boolean };
export const mockScreen: { options?: MockScreenOptions; byName: Record<string, MockScreenOptions | undefined> } = { byName: {} };

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
        // A left header item (hidesSharedBackground, iOS 26) is exposed as headerLeft so tests press it the same way.
        const o = options as { unstable_headerLeftItems?: () => { element: React.ReactElement }[] } | undefined;
        const seen = (
          o?.unstable_headerLeftItems ? { ...o, headerLeft: () => o.unstable_headerLeftItems!()[0]!.element } : options
        ) as MockScreenOptions;
        mockScreen.options = seen;
        if (name) mockScreen.byName[name] = seen;
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
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(async () => undefined),
  hideAsync: jest.fn(async () => undefined),
}));
jest.mock('expo-camera', () => ({
  CameraView: (props: typeof mockCamera.props) => {
    mockCamera.props = props;
    return null;
  },
  useCameraPermissions: () => [mockPermission.current, jest.fn()],
}));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '9.9.9' } } }));
jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(async () => undefined),
  deactivateKeepAwake: jest.fn(async () => undefined),
}));
jest.mock('expo-image-picker', () => ({}));
jest.mock('@/adapters/photos/pickPhotos', () => ({ pickPhotoUris: jest.fn(async () => []) }));
jest.mock('@/services', () => {
  const state: { current: unknown } = { current: null };
  return { __state: state, useServices: () => state.current, ServicesProvider: ({ children }: { children: unknown }) => children };
});

export const services = require('@/services') as { __state: { current: unknown } };

// The route files themselves, so the wiring from route to screen is tested too (UX-1, UX-3).
export const screens: [string, () => { default: React.ComponentType }][] = [
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

export const textOf = (r: ReactTestRenderer): string => JSON.stringify(r.toJSON());

// ---- Interaction tests: tap through the real screens against in-memory services ----

export type Deps = ReturnType<typeof makeDeps>;

export async function mount(
  load: () => { default: React.ComponentType },
  deps: Deps,
  fileShare = { saveAndShare: jest.fn(async () => undefined), pickFile: jest.fn(async () => null) },
) {
  services.__state.current = { deps, fileShare, analysisRunner: new AnalysisRunner(deps), appLock: new AppLock(deps) };
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(React.createElement(load().default));
  });
  lastMounted.current = tree;
  return { tree, fileShare };
}
/** The tree of the latest `mount`: a form's floating Save is part of it (UX-3). */
export const lastMounted: { current: ReactTestRenderer | undefined } = { current: undefined };
export const lastTree = (): ReactTestRenderer => lastMounted.current!;
export const press = async (tree: ReactTestRenderer, label: string) => {
  const node = tree.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
  if (!node) throw new Error(`no button "${label}"`);
  await act(async () => {
    await node.props.onPress();
  });
};
export const type = async (tree: ReactTestRenderer, placeholderOrLabel: string, value: string) => {
  const node = tree.root.findAll(
    (n) =>
      (n.props.placeholder === placeholderOrLabel || n.props.accessibilityLabel === placeholderOrLabel) &&
      typeof n.props.onChangeText === 'function',
  )[0];
  if (!node) throw new Error(`no input "${placeholderOrLabel}"`);
  await act(async () => node.props.onChangeText(value));
};
export const hasText = (tree: ReactTestRenderer, text: string) => JSON.stringify(tree.toJSON()).includes(text);
/** Real time, like the app: the screens read today's date from the device clock. */
export const nowDeps = (llm: LlmProvider = new FakeLlm()) => makeDeps(new MemoryRepo(), new Date().toISOString(), llm);
export const toggle = async (tree: ReactTestRenderer, label: string) => {
  const node = tree.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onValueChange === 'function')[0];
  if (!node) throw new Error(`no switch "${label}"`);
  await act(async () => node.props.onValueChange(true));
};
export const flush = () => act(async () => new Promise((r) => setTimeout(r, 0)));

// Only the date is pinned (to midday), so a test that logs an entry "3 hours ago" does not land on yesterday when the
// suite runs between midnight and 03:00. Timers stay real.
const DATE_ONLY = [
  'hrtime',
  'nextTick',
  'performance',
  'queueMicrotask',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'requestIdleCallback',
  'cancelIdleCallback',
  'setImmediate',
  'clearImmediate',
  'setInterval',
  'clearInterval',
  'setTimeout',
  'clearTimeout',
] as const;
beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-06-15T10:00:00.000Z'), doNotFake: [...DATE_ONLY] });
});
afterEach(() => {
  jest.useRealTimers();
});
