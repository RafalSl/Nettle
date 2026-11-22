/* eslint-disable @typescript-eslint/no-require-imports -- screens are loaded lazily, after the harness mocks are in place */
import { mockRouter, mockParams, mockScreen, mount, lastTree, press, type, hasText, nowDeps, flush } from './harness';
import { Alert } from 'react-native';
import { unzipSync } from 'fflate';
import { logMeal } from '@/core/usecases/logMeal';
import { logSkinEntry } from '@/core/usecases/skin';
import { logDrink } from '@/core/usecases/intake';
import { buildPack, importResult, listSuggestions } from '@/core/usecases/aiPack';
import { localDay } from '@/core/model/time';
import en from '@/i18n/en.json';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { syntheticScores as scores } from '../helpers/fixtures';

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
      await rendered.root
        .findAll((n) => n.props.accessibilityLabel === en.common.save && typeof n.props.onPress === 'function')[0]!
        .props.onPress();
    });
    await flush();
  };
  const switchOf = (tree: ReactTestRenderer, label: string) =>
    tree.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onValueChange === 'function')[0]!;
  const buttonOf = (name: string) =>
    alert.mock.calls.at(-1)![2].find((b: { text: string }) => b.text === name) as { onPress: () => unknown };
  const bytesOf = (o: object) => new TextEncoder().encode(JSON.stringify(o));
  const answer = (packId: string, over: object = {}) => ({ pack_id: packId, model: 'Synthetic Model 9', ...over });
  const longAgo = new Date('2026-06-12T10:00:00.000Z'); // three days before the pinned test date
  const days = () => ({
    dayFrom: localDay(longAgo.toISOString(), 'Europe/Warsaw'),
    dayTo: localDay(new Date().toISOString(), 'Europe/Warsaw'),
    language: 'en' as const,
  });

  it('IN-20 the meal and drink forms have the switch; the entry is saved as typed and its log row says it waits for AI', async () => {
    const deps = nowDeps();
    const meal = await mount(() => require('@/app/form/meal'), deps);
    await type(meal.tree, en.meal.description, 'Synthetic pancakes with jam');
    await press(meal.tree, en.meal.continue);
    expect(switchOf(meal.tree, en.fillLater.title).props.value).toBe(false);
    await act(async () => switchOf(meal.tree, en.fillLater.title).props.onValueChange(true));
    expect(hasText(meal.tree, en.fillLater.hint)).toBe(true);
    await headerSave();
    expect(await deps.repo.listRecords('meals')).toMatchObject([
      { description: 'Synthetic pancakes with jam', ingredients: [], fillLater: true },
    ]);
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
    const meal = await logMeal(deps, {
      description: 'Synthetic pancakes',
      ingredients: [],
      fillLater: true,
      at: new Date(Date.now() - 3600_000),
    });
    mockParams.current = { kind: 'meals', id: meal.id };
    const { tree } = await mount(() => require('@/app/form/edit'), deps);
    await flush();
    expect(switchOf(tree, en.fillLater.title).props.value).toBe(true);
    await act(async () => switchOf(tree, en.fillLater.title).props.onValueChange(false));
    await headerSave();
    expect((await deps.repo.listRecords('meals'))[0]!.fillLater).toBeUndefined();
  });

  it('IN-20 Today counts the suggestions and opens the list, whose rows open the entry with the suggestion', async () => {
    const deps = nowDeps();
    const meal = await logMeal(deps, { description: 'Synthetic pancakes', ingredients: [], fillLater: true, at: longAgo });
    const { packId } = await buildPack(deps, days());
    await importResult(
      deps,
      bytesOf(
        answer(packId, { fills: [{ kind: 'meal', id: meal.id, ingredients: ['wheat flour', 'milk'], allergens: ['milk'], note: null }] }),
      ),
    );
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
    await importResult(
      deps,
      bytesOf(
        answer(packId, {
          fills: [
            {
              kind: 'meal',
              id: meal.id,
              ingredients: ['wheat flour', 'milk', 'my own jam'],
              allergens: ['gluten', 'milk'],
              note: 'Recipes differ.',
            },
          ],
        }),
      ),
    );
    const [s] = await listSuggestions(deps);
    mockParams.current = { kind: 'meals', id: meal.id, suggestion: s!.id };
    const { tree } = await mount(() => require('@/app/form/edit'), deps);
    await flush();
    expect(hasText(tree, en.fillLater.panelIntro.replace('{{model}}', 'Synthetic Model 9'))).toBe(true);
    expect(hasText(tree, en.meal.unsure.replace('{{text}}', 'Recipes differ.'))).toBe(true);
    const selected = (label: string) =>
      tree.root.findAll((n) => n.props.accessibilityLabel === label && n.props.accessibilityState)[0]!.props.accessibilityState.selected;
    expect(selected(en.allergens.milk)).toBe(false);
    await press(tree, en.meal.estimateAddAll);
    const field = () =>
      tree.root.findAll((n) => n.props.accessibilityLabel === en.meal.ingredients && typeof n.props.onChangeText === 'function')[0]!.props
        .value;
    expect(field()).toBe('my own jam, wheat flour, milk, '); // typed text stays, a repeated name is not added twice
    await press(tree, en.meal.scanSelectTags);
    expect(selected(en.allergens.gluten)).toBe(true);
    await headerSave();
    expect((await deps.repo.listRecords('meals'))[0]).toMatchObject({
      ingredients: ['my own jam', 'wheat flour', 'milk'],
      allergens: ['gluten', 'milk'],
      source: { kind: 'name_estimate', edited: false, aiTags: true, llm: { model: 'Synthetic Model 9', manual: true } },
    });
    expect((await deps.repo.listRecords('meals'))[0]!.fillLater).toBeUndefined();
    expect(await listSuggestions(deps)).toEqual([]);
  });

  it('IN-20 dismissing removes the suggestion and keeps the mark; a drink works the same way and a later change marks it edited', async () => {
    const deps = nowDeps();
    const meal = await logMeal(deps, { description: 'Synthetic pancakes', ingredients: [], fillLater: true, at: longAgo });
    const drink = await logDrink(deps, { name: 'Synthetic smoothie', amountMl: 300, fillLater: true, at: longAgo });
    const { packId } = await buildPack(deps, days());
    await importResult(
      deps,
      bytesOf(
        answer(packId, {
          fills: [
            { kind: 'meal', id: meal.id, ingredients: ['flour'], allergens: [], note: null },
            { kind: 'drink', id: drink.id, ingredients: ['banana', 'milk'], allergens: [], note: null },
          ],
        }),
      ),
    );
    const [first, second] = await listSuggestions(deps);
    mockParams.current = { kind: 'meals', id: meal.id, suggestion: first!.id };
    const a = await mount(() => require('@/app/form/edit'), deps);
    await flush();
    await press(a.tree, en.fillLater.dismiss);
    expect(hasText(a.tree, en.fillLater.panelIntro.replace('{{model}}', 'Synthetic Model 9'))).toBe(false);
    expect((await listSuggestions(deps)).map((x) => x.id)).toEqual([second!.id]);
    expect((await deps.repo.listRecords('meals'))[0]!.fillLater).toBe(true);
    mockParams.current = { kind: 'drinks', id: drink.id, suggestion: second!.id };
    mockScreen.options = undefined;
    const b = await mount(() => require('@/app/form/edit'), deps);
    await flush();
    await press(b.tree, 'banana');
    await press(b.tree, en.meal.estimateAddPicked);
    await type(b.tree, en.more.drinkIngredients, 'banana, oat milk'); // changed after the names were added
    await headerSave();
    expect((await deps.repo.listRecords('drinks'))[0]).toMatchObject({
      ingredients: ['banana', 'oat milk'],
      source: { kind: 'name_estimate', edited: true, llm: { manual: true } },
    });
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
    for (const line of [
      en.plan.noteLeaves,
      en.plan.noteTerms,
      en.plan.noteBilling,
      en.plan.markedLine.replace('{{text}}', 'Synthetic pancakes'),
    ])
      expect(body).toContain(line);
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
    const result = bytesOf(
      answer(packId, {
        analysis: { summary: 'Synthetic summary', hypotheses: [], order_and_lag: 'none', data_limits: [], questions_for_doctor: [] },
        fills: [{ kind: 'meal', id: meal.id, ingredients: ['flour'], allergens: [], note: null }],
      }),
    );
    const pick = { saveAndShare: jest.fn(async () => undefined), pickFile: jest.fn(async () => result as unknown as null) };
    const { tree } = await mount(() => require('@/app/(tabs)/review/pack'), deps, pick);
    await press(tree, en.plan.import);
    await flush();
    expect(pick.pickFile).toHaveBeenCalledWith('json');
    const [title, body] = alert.mock.calls.at(-1) as unknown as [string, string];
    expect(title).toBe(en.plan.previewTitle);
    for (const line of [
      en.plan.previewModel.replace('{{model}}', 'Synthetic Model 9'),
      en.plan.previewAnalysis,
      en.plan.previewFills.replace('{{n}}', '1').replace('{{skipped}}', '0'),
      en.plan.previewNoChange,
    ])
      expect(body).toContain(line);
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
    const wrong = {
      saveAndShare: jest.fn(async () => undefined),
      pickFile: jest.fn(async () => bytesOf(answer('pack-aaaaaaaaaaaa', { report_summary: 'x' })) as unknown as null),
    };
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
    const { packId } = await buildPack(deps, {
      dayFrom: localDay(longAgo.toISOString(), 'Europe/Warsaw'),
      dayTo: localDay(new Date().toISOString(), 'Europe/Warsaw'),
      language: 'en',
    });
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
