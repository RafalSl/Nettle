/* eslint-disable @typescript-eslint/no-require-imports -- screens are loaded lazily, after the harness mocks are in place */
import { mockRouter, mockPicker, mount, lastTree, press, type, hasText, nowDeps, toggle, flush } from './harness';
import React from 'react';
import { ActionSheetIOS, Alert } from 'react-native';
import { unzipSync } from 'fflate';
import { FakeLlm } from '../fakes/fakeLlm';
import type { FakeNotifier } from '../fakes/fakeNotifier';
import { logMeal } from '@/core/usecases/logMeal';
import { logSkinEntry } from '@/core/usecases/skin';
import { saveCheckIn } from '@/core/usecases/checkin';
import { addPhoto } from '@/core/usecases/photos';
import { toggleFavoriteDrink, toggleFavoriteMeal } from '@/core/usecases/preferences';
import { archiveListItem } from '@/core/usecases/lists';
import { saveApiKey } from '@/core/usecases/llm';
import { localDay } from '@/core/model/time';
import en from '@/i18n/en.json';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { syntheticScores as scores } from '../helpers/fixtures';

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
    await saveCheckIn(deps, {
      at: yesterday,
      values: { 'item-wellbeing': 7, 'item-stress': 2, 'item-bloating': true },
      confirmEmptyDay: true,
    });
    const { tree } = await mount(() => require('@/app/form/checkin'), deps);
    await flush();
    const shown = () =>
      tree.root.findAll((n) => n.props.accessibilityLabel === `${en.common.increase} ${en.tags['item-wellbeing']}`).length;
    expect(shown()).toBeGreaterThan(0);
    const showsValue = (v: string) => tree.root.findAll((n) => (n.type as unknown) === 'Text' && String(n.props.children) === v).length > 0;
    expect(showsValue('7')).toBe(false); // today's form starts empty
    await press(tree, en.today.sameAsYesterday);
    expect(showsValue('7')).toBe(true);
    const bloating = tree.root.findAll(
      (n) => n.props.accessibilityLabel === en.tags['item-bloating'] && typeof n.props.onPress === 'function',
    )[0]!;
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
      await rendered.root
        .findAll((n) => n.props.accessibilityLabel === en.common.save && typeof n.props.onPress === 'function')[0]!
        .props.onPress();
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
    const entries = await deps.repo.listRecords('skinEntries');
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
    const sw = () =>
      tree.root.findAll(
        (n) => n.props.accessibilityLabel === en.settings.sensitiveDefault && typeof n.props.onValueChange === 'function',
      )[0]!;
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
    await toggleFavoriteMeal(deps, {
      description: 'Synthetic rice',
      ingredients: [],
      allergens: [],
      barcode: null,
      source: { kind: 'typed', edited: false, llm: null, aiTags: false },
    });
    await toggleFavoriteDrink(deps, {
      name: 'Synthetic tea',
      amountMl: 200,
      alcohol: false,
      ingredients: [],
      allergens: [],
      barcode: null,
      source: { kind: 'typed', edited: false, llm: null, aiTags: false },
    });
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
    const selected = () =>
      tree.root.findAll(
        (n) =>
          n.props.accessibilityLabel === 'Haiku' && n.props.accessibilityState?.selected === true && typeof n.props.onPress === 'function',
      );
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
    expect(await deps.repo.listRecords('meals')).toEqual([]);
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
      expect(await deps.repo.listRecords('meals')).toHaveLength(1);
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
    const meals = JSON.parse(new TextDecoder().decode(files['data.json']!)).records.meals.map(
      (m: { description: string }) => m.description,
    );
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
    expect(
      JSON.parse(new TextDecoder().decode(files['data.json']!)).records.meals.map((m: { description: string }) => m.description),
    ).toEqual(['Synthetic inside']);
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
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === en.reminders.checkIn && n.props.value === true).length).toBeGreaterThan(
      0,
    );

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
