import { NettleError } from '@/core/model/errors';
import { buildAnalysisInput } from '@/core/llm/analysisInput';
import { markFlare, openFlareAreas } from '@/core/usecases/flares';
import { archiveSkinArea } from '@/core/usecases/skin';
import { MemoryRepo } from './fakes/memoryRepo';
import { makeDeps } from './helpers/fixtures';

const code = async (p: Promise<unknown>) =>
  p.then(
    () => 'no error',
    (e: unknown) => (e instanceof NettleError ? e.code : 'other'),
  );

describe('flare markers (SK-6)', () => {
  it('SK-6 marks a start and an end per area, independently of the scores', async () => {
    const repo = new MemoryRepo();
    const deps = makeDeps(repo);
    await markFlare(deps, { areaId: 'area-chin', kind: 'start', at: new Date('2026-01-10T08:00:00.000Z') });
    await markFlare(deps, { areaId: 'area-neck', kind: 'start', at: new Date('2026-01-11T08:00:00.000Z'), note: ' n ' });
    expect([...(await openFlareAreas(deps))].sort()).toEqual(['area-chin', 'area-neck']);
    await markFlare(deps, { areaId: 'area-chin', kind: 'end', at: new Date('2026-01-14T08:00:00.000Z') });
    expect([...(await openFlareAreas(deps))]).toEqual(['area-neck']);
    await markFlare(deps, { areaId: 'area-chin', kind: 'start', at: new Date('2026-01-20T08:00:00.000Z') }); // a new flare
    expect((await openFlareAreas(deps)).has('area-chin')).toBe(true);
    expect((await repo.listRecords('flareMarkers')).find((m) => m.areaId === 'area-neck')?.note).toBe('n');
    expect(await repo.listSkinEntries()).toEqual([]);
  });

  it('SK-6 refuses a second start, an end without a start, unknown and archived areas', async () => {
    const deps = makeDeps(new MemoryRepo());
    expect(await code(markFlare(deps, { areaId: 'area-chin', kind: 'end' }))).toBe('flare_not_started');
    await markFlare(deps, { areaId: 'area-chin', kind: 'start' });
    expect(await code(markFlare(deps, { areaId: 'area-chin', kind: 'start' }))).toBe('flare_already_started');
    expect(await code(markFlare(deps, { areaId: 'nope', kind: 'start' }))).toBe('unknown_area');
    await archiveSkinArea(deps, 'area-neck');
    expect(await code(markFlare(deps, { areaId: 'area-neck', kind: 'start' }))).toBe('area_archived');
  });

  it('SK-6 keeps start and end alternating when a marker is backdated', async () => {
    const deps = makeDeps(new MemoryRepo());
    const at = (day: string) => new Date(`2026-01-${day}T08:00:00.000Z`);
    await markFlare(deps, { areaId: 'area-chin', kind: 'start', at: at('10') });
    await markFlare(deps, { areaId: 'area-chin', kind: 'end', at: at('14') });
    await markFlare(deps, { areaId: 'area-chin', kind: 'start', at: at('20') });
    expect(await code(markFlare(deps, { areaId: 'area-chin', kind: 'end', at: at('16') }))).toBe('flare_not_started'); // between end and start
    expect(await code(markFlare(deps, { areaId: 'area-chin', kind: 'start', at: at('12') }))).toBe('flare_already_started');
    expect(await code(markFlare(deps, { areaId: 'area-chin', kind: 'end', at: at('12') }))).toBe('flare_overlap'); // a second end before the first
    await markFlare(deps, { areaId: 'area-chin', kind: 'end', at: at('25') }); // the normal case still works
  });

  it('LL-2 flare markers appear in the analysis timeline by area name', async () => {
    const repo = new MemoryRepo();
    const deps = makeDeps(repo);
    await markFlare(deps, { areaId: 'area-chin', kind: 'start', at: new Date('2026-01-10T08:00:00.000Z') });
    const data = JSON.parse(buildAnalysisInput(await repo.snapshot(), '2026-01-10', '2026-01-11').json);
    expect(data.days[0].flares).toEqual([{ time: '09:00', area: 'Chin', marker: 'start' }]);
  });
});
