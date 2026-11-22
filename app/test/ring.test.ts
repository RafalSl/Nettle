import { arcPosition, hourLabels, ringDots, ringPosition, trackOf, type RingEntry } from '@/core/model/ring';
import { searchItems } from '@/core/model/search';

const TZ = 'Europe/Warsaw';
const e = (id: string, kind: string, utc: string): RingEntry => ({ id, kind, at: { utc, tz: TZ } });

describe('the day ring (UX-2)', () => {
  it('UX-2 a position is the fraction of the diary day: noon Warsaw is 0.5, the day start is 0', () => {
    expect(ringPosition('2026-01-14T23:00:00.000Z', '2026-01-15', TZ)).toBe(0); // 00:00 Warsaw
    expect(ringPosition('2026-01-15T11:00:00.000Z', '2026-01-15', TZ)).toBe(0.5); // 12:00 Warsaw
    expect(ringPosition('2026-01-15T12:00:00.000Z', '2026-01-15', TZ)).toBeCloseTo(13 / 24, 10);
  });

  it('NF-7 the ring starts at the day start: with 04:00, 04:00 is 0 and 02:00 the next morning is 22/24', () => {
    expect(ringPosition('2026-01-15T03:00:00.000Z', '2026-01-15', TZ, 4)).toBe(0); // 04:00 Warsaw
    expect(ringPosition('2026-01-16T01:00:00.000Z', '2026-01-15', TZ, 4)).toBeCloseTo(22 / 24, 10); // 02:00 Warsaw, next date
    expect(hourLabels(4)).toEqual(['04', '10', '16', '22']);
    expect(hourLabels()).toEqual(['00', '06', '12', '18']);
  });

  it('UX-2 a daylight saving day is shorter, and the position still runs from 0 to 1', () => {
    // 2026-03-29 in Warsaw has 23 hours; 12:00 local (CEST) is 10:00Z, 11 hours after 00:00 local (23:00Z the day before)
    expect(ringPosition('2026-03-29T10:00:00.000Z', '2026-03-29', TZ)).toBeCloseTo(11 / 23, 10);
    expect(ringPosition('2026-03-29T21:59:59.999Z', '2026-03-29', TZ)).toBeCloseTo(1, 5);
  });

  it('UX-2 a position outside the day is clamped, an invalid day gives null', () => {
    expect(ringPosition('2026-01-20T00:00:00.000Z', '2026-01-15', TZ)).toBe(1);
    expect(ringPosition('2026-01-10T00:00:00.000Z', '2026-01-15', TZ)).toBe(0);
    expect(ringPosition('2026-01-15T00:00:00.000Z', 'nope', TZ)).toBeNull();
  });

  it('UX-2 meals, drinks and medication are intake; everything else is body and care', () => {
    for (const k of ['meals', 'drinks', 'medicationEntries']) expect(trackOf(k)).toBe('intake');
    for (const k of [
      'skinEntries',
      'nailEntries',
      'checkIns',
      'stoolEntries',
      'treatmentApplications',
      'changeEvents',
      'medicalEvents',
      'reactions',
    ])
      expect(trackOf(k)).toBe('care');
  });

  it('UX-2 the arc runs up to now on today and is absent on a past day', () => {
    const now = new Date('2026-01-15T11:00:00.000Z');
    expect(arcPosition(now, '2026-01-15', '2026-01-15', TZ)).toBe(0.5);
    expect(arcPosition(now, '2026-01-14', '2026-01-15', TZ)).toBeNull();
  });

  it('UX-2 close dots on one track merge into one dot at their mean; the other track stays apart', () => {
    const dots = ringDots(
      [
        e('m1', 'meals', '2026-01-15T07:00:00.000Z'), // 08:00
        e('d1', 'drinks', '2026-01-15T07:20:00.000Z'), // 08:20, 20 minutes later: merges with the meal
        e('s1', 'skinEntries', '2026-01-15T07:15:00.000Z'), // 08:15, other track
        e('m2', 'meals', '2026-01-15T11:00:00.000Z'), // 12:00, far away
      ],
      '2026-01-15',
      TZ,
    );
    expect(dots.map((d) => [d.track, d.ids])).toEqual([
      ['intake', ['m1', 'd1']],
      ['care', ['s1']],
      ['intake', ['m2']],
    ]);
    expect(dots[0]!.position).toBeCloseTo((8 + 20 / 120) / 24, 6);
  });

  it('UX-2 a chain of close entries stays one dot, and entries a gap apart do not merge', () => {
    const chain = ringDots(
      [
        e('a', 'meals', '2026-01-15T07:00:00.000Z'),
        e('b', 'meals', '2026-01-15T07:30:00.000Z'),
        e('c', 'meals', '2026-01-15T08:00:00.000Z'),
      ],
      '2026-01-15',
      TZ,
    );
    expect(chain).toHaveLength(1);
    expect(chain[0]!.ids).toEqual(['a', 'b', 'c']);
    const apart = ringDots([e('a', 'meals', '2026-01-15T07:00:00.000Z'), e('b', 'meals', '2026-01-15T09:00:00.000Z')], '2026-01-15', TZ);
    expect(apart).toHaveLength(2);
  });
});

describe('the More search (UX-11)', () => {
  const items = [
    { title: 'Meal', subtitle: 'What you ate', keywords: 'food lunch', value: 'meal' },
    { title: 'Routine change', subtitle: 'A new product, soap or diet', value: 'change' },
    { title: 'A new cream or soap', subtitle: 'Routine change', value: 'g-soap' },
    { title: 'Skóra', subtitle: 'Skin', value: 'skin' },
  ];
  it('UX-11 an empty query keeps everything in order; words match in any order, without case or accents', () => {
    expect(searchItems(items, '  ').map((i) => i.value)).toEqual(['meal', 'change', 'g-soap', 'skin']);
    expect(searchItems(items, 'SOAP').map((i) => i.value)).toEqual(['g-soap', 'change']); // title hit first
    expect(searchItems(items, 'soap new').map((i) => i.value)).toEqual(['g-soap', 'change']);
    expect(searchItems(items, 'skora').map((i) => i.value)).toEqual(['skin']);
    expect(searchItems(items, 'lunch').map((i) => i.value)).toEqual(['meal']);
    expect(searchItems(items, 'zzz')).toEqual([]);
  });
});
