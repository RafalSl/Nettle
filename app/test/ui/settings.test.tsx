/* eslint-disable @typescript-eslint/no-require-imports -- screens are loaded lazily, after the harness mocks are in place */
import { mockRouter, mockParams, mount, lastTree, press, hasText, nowDeps, toggle, flush } from './harness';
import { ActionSheetIOS, Alert } from 'react-native';
import type { FakeNotifier } from '../fakes/fakeNotifier';
import { addRegularMedication } from '@/core/usecases/regular';
import { pinEntryType, unpinEntryType } from '@/core/usecases/preferences';
import { addListItem } from '@/core/usecases/lists';
import en from '@/i18n/en.json';
import { act, type ReactTestRenderer } from 'react-test-renderer';

describe('Guide (UX-11)', () => {
  beforeEach(() => mockRouter.push.mockClear());

  it('UX-11 "Where do I log…?" lists everyday situations and each row opens the right form, with the entry type as its subtitle', async () => {
    const { GUIDE } = require('@/screens/GuideScreen') as { GUIDE: { id: string; entry: keyof typeof en.entry }[] };
    const { tree } = await mount(() => require('@/app/guide'), nowDeps());
    expect(GUIDE.length).toBeGreaterThanOrEqual(12);
    const routes: Record<string, string> = {
      meal: '/form/meal',
      drink: '/form/drink',
      medication: '/form/medication',
      skin: '/form/skin',
      nails: '/form/nails',
      treatment: '/form/treatment',
      checkin: '/form/checkin',
      stool: '/form/stool',
      reaction: '/form/reaction',
      change: '/form/change',
      medical: '/form/medical',
    };
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
      await rendered.root
        .findAll((n) => n.props.accessibilityLabel === en.common.save && typeof n.props.onPress === 'function')[0]!
        .props.onPress();
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

describe('Settings additions (SK-8, NO-3, SE-9)', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('UX-7 the Language page offers Device language, English and Polski; a choice is saved and applied at once', async () => {
    const deps = nowDeps();
    const { tree } = await mount(() => require('@/app/settings/language'), deps);
    await flush();
    const checked = (label: string) =>
      tree.root.findAll((n) => n.props.accessibilityRole === 'radio' && n.props.accessibilityLabel === label)[0]?.props.accessibilityState
        .checked;
    expect(checked(en.settings.languageDevice)).toBe(true); // the default
    await press(tree, en.settings.languageNamePl);
    await flush();
    expect((await deps.repo.getPreferences())?.language).toBe('pl');
    expect(checked(en.settings.languageNamePl)).toBe(true);
    await press(tree, en.settings.languageNameEn);
    await flush();
    expect((await deps.repo.getPreferences())?.language).toBe('en');
    expect(hasText(tree, en.settings.languageChangesApp)).toBe(true);
  });

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
    const sw = tree.root.findAll(
      (n) =>
        n.props.accessibilityRole === 'switch' &&
        n.props.accessibilityLabel === en.reminders.checkIn &&
        n.props.accessibilityState !== undefined,
    );
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
