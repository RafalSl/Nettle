/* eslint-disable @typescript-eslint/no-require-imports -- screens are loaded lazily, after the harness mocks are in place */
import {
  create,
  mockRouter,
  mockCamera,
  mockPermission,
  mockParams,
  mockScreen,
  mount,
  lastTree,
  press,
  type,
  hasText,
  nowDeps,
  flush,
} from './harness';
import { ActionSheetIOS, Alert } from 'react-native';
import { FakeLlm } from '../fakes/fakeLlm';
import { FakeBarcode } from '../fakes/fakeBarcode';
import type { LlmProvider } from '@/core/ports/llm';
import { logMeal } from '@/core/usecases/logMeal';
import { toggleFavoriteMeal, updateSuggestionSettings } from '@/core/usecases/preferences';
import { saveApiKey } from '@/core/usecases/llm';
import { localDay } from '@/core/model/time';
import en from '@/i18n/en.json';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { MemoryPhotoStore } from '../fakes/memoryPhotoStore';

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
    expect(await deps.repo.listRecords('meals')).toEqual([]);
    await header('headerRight', en.common.save);
    await flush();
    expect(await deps.repo.listRecords('meals')).toMatchObject([
      { description: 'Synthetic breakfast', ingredients: ['Synthetic oats'], allergens: [] },
    ]);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('IN-7, IN-10, IN-14 a suggestion fills the review with its latest ingredients and tags and saves a new, independent entry', async () => {
    const deps = nowDeps();
    const old = await logMeal(deps, {
      description: 'Synthetic porridge',
      ingredients: ['oats', 'milk'],
      allergens: ['milk'],
      at: new Date(Date.now() - 2 * 86_400_000),
    });
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
    const saved = await deps.repo.listRecords('meals');
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
    await toggleFavoriteMeal(deps, {
      description: 'Synthetic rice',
      ingredients: [],
      allergens: [],
      barcode: null,
      source: { kind: 'typed', edited: false, llm: null, aiTags: false },
    });
    const { tree } = await mount(meal, deps);
    await flush();
    const labels = () => [
      ...new Set(
        tree.root
          .findAll(
            (n) =>
              n.props.accessibilityRole === 'button' &&
              typeof n.props.accessibilityLabel === 'string' &&
              n.props.accessibilityLabel.startsWith('Synthetic'),
          )
          .map((n) => n.props.accessibilityLabel as string),
      ),
    ];
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
    expect((await deps.repo.getPreferences())!.favorites.meals).toMatchObject([
      { key: 'synthetic breakfast', description: 'Synthetic breakfast' },
    ]);
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
    const [saved] = await deps.repo.listRecords('meals');
    expect(localDay(saved!.at.utc, saved!.at.tz)).toBe('2026-01-10');
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
  const buttonOf = (name: string) =>
    alert.mock.calls.at(-1)![2].find((b: { text: string }) => b.text === name) as { onPress: () => unknown };

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
    const llm = {
      completeJson: (req: { signal?: AbortSignal }) =>
        new Promise<never>((_r, reject) => req.signal?.addEventListener('abort', () => reject(new Error('aborted')))),
    };
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
    expect(await deps.repo.listRecords('meals')).toEqual([]);
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
    const selected = (label: string) =>
      tree.root.findAll((n) => n.props.accessibilityLabel === label && n.props.accessibilityState)[0]!.props.accessibilityState.selected;
    expect(selected(en.allergens.milk)).toBe(false);
    expect(hasText(tree, en.meal.aiAllergensHint.replace('{{list}}', `${en.allergens.milk}, ${en.allergens.gluten}`))).toBe(true);
    await press(tree, en.meal.scanSelectTags);
    expect(selected(en.allergens.milk)).toBe(true);
    expect(selected(en.allergens.gluten)).toBe(true);
    expect(await deps.repo.listRecords('meals')).toEqual([]);
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
    const values = () =>
      tree.root
        .findAll((n) => n.props.placeholder === en.meal.ingredientPlaceholder)
        .map((n) => n.props.value)
        .filter((v, i, a) => a.indexOf(v) === i);
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
      await rendered.root
        .findAll((n) => n.props.accessibilityLabel === en.common.save && typeof n.props.onPress === 'function')[0]!
        .props.onPress();
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
    const selected = (label: string) =>
      tree.root.findAll((n) => n.props.accessibilityLabel === label && n.props.accessibilityState)[0]!.props.accessibilityState.selected;
    expect(selected(en.allergens.milk)).toBe(false); // IN-10: the estimate never selects a tag
    expect(await deps.repo.listRecords('meals')).toEqual([]); // nothing saved until Save
    await saveMeal();
    expect((await deps.repo.listRecords('meals'))[0]).toMatchObject({
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
    expect(await deps.repo.listRecords('meals')).toEqual([]);
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
    const llm = {
      completeJson: (req: { signal?: AbortSignal }) =>
        new Promise<never>(
          (_r, reject) => ((signal = req.signal), req.signal?.addEventListener('abort', () => reject(new Error('aborted')))),
        ),
    };
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
    expect((await deps.repo.listRecords('drinks'))[0]).toMatchObject({
      name: 'Synthetic banana smoothie',
      ingredients: ['milk', 'banana'],
      source: { kind: 'name_estimate', edited: false, llm: { promptVersion: 'name-1' } },
    });
  });

  const LABEL = JSON.stringify({
    ingredients: ['mleko (3,2%)', 'cukier'],
    allergens: ['milk'],
    traces: ['peanuts'],
    text_read: 'Składniki: mleko, cukier. Może zawierać orzeszki ziemne.',
    note: 'The last line is cut off.',
  });

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
    const selected = (label: string) =>
      tree.root.findAll((n) => n.props.accessibilityLabel === label && n.props.accessibilityState)[0]!.props.accessibilityState.selected;
    expect(selected(en.allergens.milk)).toBe(false);
    await press(tree, en.meal.scanSelectTags);
    expect(selected(en.allergens.milk)).toBe(true);
    expect(selected(en.allergens.peanuts)).toBe(true);
    expect(await deps.repo.listRecords('meals')).toEqual([]); // nothing saved by the scan
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
    const saved = (await deps.repo.listRecords('meals'))[0]!;
    expect(saved).toMatchObject({
      ingredients: ['mleko (3,2%)', 'cukier'],
      allergens: ['milk', 'peanuts'],
      source: { kind: 'label_scan', edited: false, llm: { model: 'fake-model', promptVersion: 'label-1' }, aiTags: true },
    });
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
    expect(await deps.repo.listRecords('meals')).toEqual([]);
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
      await rendered.root
        .findAll((n) => n.props.accessibilityLabel === en.common.save && typeof n.props.onPress === 'function')[0]!
        .props.onPress();
    });
    await flush();
    expect(await deps.repo.listRecords('drinks')).toMatchObject([
      {
        name: 'Synthetic kefir',
        amountMl: 250,
        ingredients: ['mleko (3,2%)', 'cukier'],
        allergens: ['milk', 'peanuts'],
        source: { kind: 'label_scan', edited: false },
      },
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
      await rendered.root
        .findAll((n) => n.props.accessibilityLabel === en.common.save && typeof n.props.onPress === 'function')[0]!
        .props.onPress();
    });
    await flush();
    expect(await deps.repo.listRecords('meals')).toMatchObject([{ barcode: '5900000000008', source: { kind: 'label_scan' } }]);
    const { lookupProduct } = require('@/core/usecases/barcode');
    expect(await lookupProduct(deps, '5900000000008')).toMatchObject({
      history: { name: 'Synthetic yoghurt', source: { kind: 'label_scan' } },
    });
  });

  it('IN-3, LL-12 saving while the estimate runs uses the fields as they are and aborts the request', async () => {
    let aborted = false;
    const llm = {
      completeJson: (req: { signal?: AbortSignal }) =>
        new Promise<never>((_r, reject) => req.signal?.addEventListener('abort', () => ((aborted = true), reject(new Error('aborted'))))),
    };
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
    expect(await deps.repo.listRecords('meals')).toMatchObject([{ description: 'Synthetic dinner', ingredients: ['my own rice'] }]);
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
  const values = (tree: ReactTestRenderer) => [
    ...new Set(tree.root.findAll((n) => n.props.placeholder === en.meal.ingredientPlaceholder).map((n) => n.props.value)),
  ];

  it('IN-2, IN-10 a typed code fills the review form; the database allergens are only suggested until the user selects them', async () => {
    const { deps, tree } = await open();
    await type(tree, en.meal.scanCode, '5900 0000 00008');
    await press(tree, en.meal.scanLookup);
    await flush();
    expect(hasText(tree, en.meal.scanFromDb)).toBe(true);
    expect(
      tree.root.findAll((n) => n.props.accessibilityLabel === en.meal.description && n.props.value === 'Synthetic yoghurt'),
    ).not.toHaveLength(0);
    expect(values(tree)).toEqual(['milk', 'cultures']);
    const milk = () =>
      tree.root.findAll((n) => n.props.accessibilityLabel === en.allergens.milk && n.props.accessibilityState)[0]!.props.accessibilityState
        .selected;
    expect(milk()).toBe(false);
    expect(hasText(tree, en.meal.scanTagsHint.replace('{{list}}', en.allergens.milk))).toBe(true);
    expect(await deps.repo.listRecords('meals')).toEqual([]); // nothing saved by a lookup
    await press(tree, en.meal.scanSelectTags);
    expect(milk()).toBe(true);
    await header();
    await flush();
    expect(await deps.repo.listRecords('meals')).toMatchObject([
      {
        description: 'Synthetic yoghurt',
        ingredients: ['milk', 'cultures'],
        allergens: ['milk'],
        barcode: '5900000000008',
        source: { kind: 'open_food_facts', edited: false, llm: null, aiTags: false },
      },
    ]);
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
    await logMeal(deps, {
      description: 'Synthetic earlier',
      ingredients: ['oat milk', 'oat milk', 'rice'],
      at: new Date(Date.now() - 3600_000),
    });
    const { tree } = await mount(meal, deps);
    await flush();
    await type(tree, en.meal.description, 'Synthetic new');
    await press(tree, en.meal.continue);
    const field = () =>
      tree.root.findAll((n) => n.props.placeholder === en.meal.ingredientPlaceholder && typeof n.props.onFocus === 'function')[0]!;
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
    expect((await deps.repo.getPreferences())!.favorites.meals).toMatchObject([
      { description: 'Synthetic yoghurt', barcode: '5900000000008', source: { kind: 'open_food_facts' } },
    ]);
    const again = await mount(meal, deps);
    await flush();
    await press(again.tree, 'Synthetic yoghurt');
    await header();
    await flush();
    expect(await deps.repo.listRecords('meals')).toMatchObject([
      { description: 'Synthetic yoghurt', barcode: '5900000000008', source: { kind: 'open_food_facts', edited: true } },
    ]);
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
    expect((await deps.repo.listRecords('meals'))[0]!.source).toEqual({ kind: 'open_food_facts', edited: true, llm: null, aiTags: false });
  });

  it('IN-2 a code the diary already knows is filled from history without asking the database', async () => {
    const { deps, tree, fake } = await open();
    await logMeal(deps, {
      description: 'Synthetic kefir',
      ingredients: ['kefir'],
      allergens: ['milk'],
      barcode: '5900000000008',
      at: new Date(Date.now() - 86_400_000),
    });
    await type(tree, en.meal.scanCode, '5900000000008');
    await press(tree, en.meal.scanLookup);
    await flush();
    expect(fake.lookups).toEqual([]);
    expect(
      tree.root.findAll((n) => n.props.accessibilityLabel === en.meal.description && n.props.value === 'Synthetic kefir'),
    ).not.toHaveLength(0);
    expect(
      tree.root.findAll((n) => n.props.accessibilityLabel === en.allergens.milk && n.props.accessibilityState)[0]!.props.accessibilityState
        .selected,
    ).toBe(true);
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
      {
        name: 'Synthetic yoghurt',
        amountMl: 250,
        alcohol: false,
        ingredients: ['milk', 'cultures'],
        barcode: '5900000000008',
        source: { kind: 'open_food_facts', edited: true },
      },
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
  const buttonOf = (name: string) =>
    alert.mock.calls.at(-1)![2].find((b: { text: string }) => b.text === name) as { onPress: () => unknown };
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
    const picked = () =>
      tree.root.findAll((n) => n.props.accessibilityLabel === en.meal.estimateAddPicked && n.props.accessibilityState !== undefined);
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
