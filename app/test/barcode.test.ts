import { openFoodFacts, parseOffResponse } from '@/adapters/barcode/openFoodFacts';
import { allergensFromTags, isInStoreCode, normalizeBarcode, parseIngredientText } from '@/core/model/barcode';
import { NettleError } from '@/core/model/errors';
import { lookupProduct } from '@/core/usecases/barcode';
import { logDrink } from '@/core/usecases/intake';
import { logMeal } from '@/core/usecases/logMeal';
import { FakeBarcode } from './fakes/fakeBarcode';
import { MemoryRepo } from './fakes/memoryRepo';
import { makeDeps } from './helpers/fixtures';

const code = async (p: Promise<unknown>) =>
  p.then(
    () => 'no error',
    (e: unknown) => (e instanceof NettleError ? e.code : 'other'),
  );

describe('barcode numbers (IN-2)', () => {
  it('IN-2 accepts EAN-13, EAN-8, UPC-A and GTIN-14 with a correct check digit, ignoring spaces and dashes', () => {
    expect(normalizeBarcode('3017620422003')).toBe('3017620422003');
    expect(normalizeBarcode(' 5900 1234-56786 ')).toBe(null); // wrong check digit
    expect(normalizeBarcode('4006381333931')).toBe('4006381333931');
    expect(normalizeBarcode('96385074')).toBe('96385074');
    expect(normalizeBarcode('036000291452')).toBe('036000291452');
    expect(normalizeBarcode('10012345678902')).toBe('10012345678902');
  });

  it('IN-2 refuses anything else: letters, a wrong length, a wrong check digit', () => {
    for (const bad of ['', 'abc', '123', '3017620422004', '30176204220', '30176204220031', '12345678901234567']) {
      expect(normalizeBarcode(bad)).toBeNull();
    }
  });

  it('IN-2 prefixes 20 to 29 are in-store codes; Polish 590 and others are not', () => {
    expect(isInStoreCode('2000000000008')).toBe(true);
    expect(isInStoreCode('2912345678908')).toBe(true);
    expect(isInStoreCode('5900000000000')).toBe(false);
    expect(isInStoreCode('3017620422003')).toBe(false);
    expect(isInStoreCode('204000000003')).toBe(true); // UPC-A starting with 2
    expect(isInStoreCode('96385074')).toBe(false);
  });
});

describe('ingredient text and allergen tags (IN-2, IN-10)', () => {
  it('IN-2 splits at top-level commas, drops brackets, emphasis marks, percentages and repeats', () => {
    expect(parseIngredientText('Ingredients: flour (wheat, _barley_), sugar 5%, Sugar; milk powder (28%), salt.')).toEqual([
      'flour',
      'sugar',
      'milk powder',
      'salt',
    ]);
    expect(parseIngredientText('')).toEqual([]);
    expect(parseIngredientText(' , ; ')).toEqual([]);
  });

  it('IN-10 maps Open Food Facts allergen tags to the 14 EU allergens and ignores unknown ones', () => {
    expect(
      allergensFromTags([
        'en:milk',
        'en:nuts',
        'en:soybeans',
        'en:sesame-seeds',
        'en:sulphur-dioxide-and-sulphites',
        'en:made-up',
        3,
        'en:milk',
      ]),
    ).toEqual(['milk', 'tree_nuts', 'soybeans', 'sesame', 'sulphites']);
  });
});

describe('Open Food Facts adapter (IN-9)', () => {
  const found = {
    status: 1,
    product: { product_name: ' Synthetic spread ', ingredients_text: 'sugar, palm oil', allergens_tags: ['en:milk'] },
  };

  it('IN-9 turns a found product into name, ingredients and allergens, an unknown one into null', () => {
    expect(parseOffResponse('3017620422003', found)).toEqual({
      barcode: '3017620422003',
      name: 'Synthetic spread',
      ingredients: ['sugar', 'palm oil'],
      allergens: ['milk'],
    });
    expect(parseOffResponse('3017620422003', { status: 0 })).toBeNull();
    // IN-2: the Polish text wins when there is one; it is marked as a translation unless the product was entered in Polish
    const pl = { product_name: 'Krem', ingredients_text: 'sugar, milk', ingredients_text_pl: 'cukier, mleko', allergens_tags: [] };
    expect(parseOffResponse('3017620422003', { status: 1, product: { ...pl, lang: 'en' } })).toMatchObject({
      ingredients: ['cukier', 'mleko'],
      translated: true,
    });
    expect(parseOffResponse('3017620422003', { status: 1, product: { ...pl, lang: 'pl' } })).toEqual({
      barcode: '3017620422003',
      name: 'Krem',
      ingredients: ['cukier', 'mleko'],
      allergens: [],
    });
    expect(parseOffResponse('3017620422003', { status: 1, product: { ...pl, ingredients_text_pl: ' ', lang: 'en' } })).toMatchObject({
      ingredients: ['sugar', 'milk'],
    });
    expect(parseOffResponse('3017620422003', { status: 1, product: { ...pl, ingredients_text_pl: ' ', lang: 'en' } })).not.toHaveProperty(
      'translated',
    );
    expect(parseOffResponse('3017620422003', { status: 1, product: {} })).toMatchObject({ name: '', ingredients: [], allergens: [] });
  });

  it('IN-9 a body that is not the expected shape is a lookup failure', () => {
    for (const bad of [null, 'text', 5, { status: 1 }, { status: 2, product: {} }, {}]) {
      expect(() => parseOffResponse('3017620422003', bad)).toThrow(NettleError);
    }
  });

  describe('over the network', () => {
    const real = global.fetch;
    afterEach(() => {
      global.fetch = real;
    });
    const answer = (status: number, body: unknown) =>
      jest.fn(async () => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response);

    it('IN-9 asks only for the barcode and a few fields, and names the app without personal details', async () => {
      const fetchMock = answer(200, found);
      global.fetch = fetchMock as unknown as typeof fetch;
      await openFoodFacts.lookup('3017620422003');
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { headers: Record<string, string> }];
      expect(url).toBe(
        'https://world.openfoodfacts.org/api/v2/product/3017620422003.json?fields=code,product_name,ingredients_text,ingredients_text_pl,lang,allergens_tags',
      );
      expect(init.headers['User-Agent']).toBe('Nettle/1.0 (private diary app)');
    });

    it('IN-9 a 404 with status 0 is "not found", other statuses and network errors are failures', async () => {
      global.fetch = answer(404, { status: 0 }) as unknown as typeof fetch;
      expect(await openFoodFacts.lookup('3017620422003')).toBeNull();
      global.fetch = answer(503, {}) as unknown as typeof fetch;
      expect(await code(openFoodFacts.lookup('3017620422003'))).toBe('barcode_lookup_failed');
      global.fetch = jest.fn(async () => {
        throw new TypeError('Network request failed');
      }) as unknown as typeof fetch;
      expect(await code(openFoodFacts.lookup('3017620422003'))).toBe('barcode_lookup_failed');
      global.fetch = jest.fn(
        async () =>
          ({
            ok: true,
            status: 200,
            json: async () => {
              throw new SyntaxError('x');
            },
          }) as unknown as Response,
      ) as unknown as typeof fetch;
      expect(await code(openFoodFacts.lookup('3017620422003'))).toBe('barcode_lookup_failed');
    });
  });
});

describe('looking a product up (IN-2, IN-8)', () => {
  const info = { barcode: '5900000000008', name: 'Synthetic yoghurt', ingredients: ['milk', 'cultures'], allergens: ['milk' as const] };
  const depsWith = (src: FakeBarcode) => ({ ...makeDeps(new MemoryRepo()), barcode: src });

  it('IN-2 a found product comes with its ingredients and allergen suggestions, and nothing is saved', async () => {
    const deps = depsWith(new FakeBarcode({ '5900000000008': info }));
    const result = await lookupProduct(deps, ' 5900 0000 00008 ');
    expect(result).toEqual({ barcode: '5900000000008', inStore: false, product: info, incomplete: false, history: null });
    expect(await deps.repo.listMeals()).toEqual([]);
  });

  it('IN-2 a barcode the diary already knows is answered from the latest entry, without asking the source', async () => {
    const source = new FakeBarcode({ '5900000000008': info });
    const deps = depsWith(source);
    const src = {
      kind: 'label_scan' as const,
      edited: true,
      llm: { model: 'm', at: '2026-01-01T00:00:00.000Z', promptVersion: 'p' },
      aiTags: false,
    };
    await logMeal(deps, { description: 'Old name', ingredients: ['a'], barcode: '5900000000008', at: new Date('2026-01-01T10:00:00Z') });
    await logDrink(deps, {
      name: 'Newer name',
      amountMl: 200,
      ingredients: ['milk'],
      allergens: ['milk'],
      barcode: '5900000000008',
      source: src,
      at: new Date('2026-01-05T10:00:00Z'),
    });
    const result = await lookupProduct(deps, '5900000000008');
    expect(result.history).toMatchObject({
      name: 'Newer name',
      ingredients: ['milk'],
      allergens: ['milk'],
      source: src,
      at: '2026-01-05T10:00:00.000Z',
    });
    expect(result.product).toBeNull();
    expect(source.lookups).toEqual([]);
  });

  it('IN-8 an unknown code and a product without ingredients both lead to manual entry', async () => {
    const deps = depsWith(new FakeBarcode({ '5900000000008': { ...info, ingredients: [] } }));
    expect(await lookupProduct(deps, '5900000000008')).toMatchObject({ incomplete: true });
    expect(await lookupProduct(deps, '3017620422003')).toMatchObject({ product: null, incomplete: false });
  });

  it('IN-2 an in-store code is flagged so the user confirms the match', async () => {
    const deps = depsWith(new FakeBarcode({ '2000000000008': { ...info, barcode: '2000000000008' } }));
    expect(await lookupProduct(deps, '2000000000008')).toMatchObject({ inStore: true });
  });

  it('IN-2, IN-9 an invalid code is refused without asking the source, and an unreachable source says so', async () => {
    const src = new FakeBarcode();
    const deps = depsWith(src);
    expect(await code(lookupProduct(deps, '1234'))).toBe('invalid_barcode');
    expect(src.lookups).toEqual([]);
    src.failing.add('3017620422003');
    expect(await code(lookupProduct(deps, '3017620422003'))).toBe('barcode_lookup_failed');
  });
});
