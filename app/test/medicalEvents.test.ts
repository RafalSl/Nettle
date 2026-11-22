import { strFromU8, unzipSync } from 'fflate';
import { SqliteRepo } from '@/adapters/storage/sqliteRepo';
import { buildAnalysisInput } from '@/core/llm/analysisInput';
import { analysisPrompt } from '@/core/llm/analysisPrompt';
import { buildReportHtml } from '@/core/export/report';
import { parseDataJson } from '@/core/export/validate';
import { DELETE_GROUPS } from '@/core/model/deleteGroups';
import { NettleError } from '@/core/model/errors';
import { saveCheckIn } from '@/core/usecases/checkin';
import { dayLog } from '@/core/usecases/dayLog';
import { deleteData } from '@/core/usecases/deleteData';
import { deleteEntry, editMedicalEvent, previewEntryDelete } from '@/core/usecases/entries';
import { logMedicalEvent } from '@/core/usecases/events';
import { exportBundle } from '@/core/usecases/exchange';
import { logSkinEntry } from '@/core/usecases/skin';
import { areaTimeline } from '@/core/usecases/timeline';
import { MemoryRepo } from './fakes/memoryRepo';
import { createNodeSqliteDb } from './helpers/nodeSqliteDb';
import { makeDeps } from './helpers/fixtures';

const code = async (p: Promise<unknown>) =>
  p.then(
    () => 'no error',
    (e: unknown) => (e instanceof NettleError ? e.code : 'other'),
  );
const at = (iso: string) => new Date(iso);
const scores = { severity: 3, itch: 1, pain: 1, dryness: 1, scaling: 1 };

describe('medical events (IN-18)', () => {
  it('IN-18 logs a visit, test result, diagnosis, illness or other with a date, a short title and a note', async () => {
    const deps = makeDeps(new MemoryRepo());
    const visit = await logMedicalEvent(deps, {
      kind: 'visit',
      title: '  Synthetic dermatology visit ',
      note: ' prescribed a cream ',
      at: at('2026-01-10T09:00:00.000Z'),
    });
    expect(visit).toMatchObject({
      kind: 'visit',
      title: 'Synthetic dermatology visit',
      note: 'prescribed a cream',
      endDay: null,
      at: { utc: '2026-01-10T09:00:00.000Z' },
    });
    for (const kind of ['test_result', 'diagnosis', 'illness', 'other'] as const)
      expect(await logMedicalEvent(deps, { kind, title: 'Synthetic' })).toMatchObject({ kind });
    expect(await deps.repo.listRecords('medicalEvents')).toHaveLength(5);
  });

  it('IN-18 needs a kind and a title of 1 to 120 characters, and says what is wrong', async () => {
    const deps = makeDeps(new MemoryRepo());
    expect(await code(logMedicalEvent(deps, { kind: 'visit', title: '   ' }))).toBe('empty_title');
    expect(await code(logMedicalEvent(deps, { kind: 'visit', title: 'x'.repeat(121) }))).toBe('invalid_value');
    expect(await code(logMedicalEvent(deps, { kind: 'x-ray' as never, title: 'Synthetic' }))).toBe('invalid_value');
    expect((await logMedicalEvent(deps, { kind: 'visit', title: 'x'.repeat(120) })).title).toHaveLength(120);
    expect(await deps.repo.listRecords('medicalEvents')).toHaveLength(1);
  });

  it('IN-18 only an illness has an end date, which is a real day that is not before the day it started', async () => {
    const deps = makeDeps(new MemoryRepo());
    const start = at('2026-01-10T09:00:00.000Z');
    expect(
      await logMedicalEvent(deps, { kind: 'illness', title: 'Synthetic throat infection', at: start, endDay: '2026-01-14' }),
    ).toMatchObject({ endDay: '2026-01-14' });
    expect((await logMedicalEvent(deps, { kind: 'illness', title: 'Synthetic same day', at: start, endDay: '2026-01-10' })).endDay).toBe(
      '2026-01-10',
    );
    expect((await logMedicalEvent(deps, { kind: 'illness', title: 'Synthetic ongoing', at: start })).endDay).toBeNull();
    expect(await code(logMedicalEvent(deps, { kind: 'illness', title: 'Synthetic', at: start, endDay: '2026-01-09' }))).toBe(
      'invalid_value',
    );
    expect(await code(logMedicalEvent(deps, { kind: 'illness', title: 'Synthetic', at: start, endDay: '2026-02-30' }))).toBe(
      'invalid_value',
    );
    expect(await code(logMedicalEvent(deps, { kind: 'illness', title: 'Synthetic', at: start, endDay: 'tomorrow' }))).toBe('invalid_value');
    expect(await code(logMedicalEvent(deps, { kind: 'visit', title: 'Synthetic', at: start, endDay: '2026-01-14' }))).toBe('invalid_value');
  });

  it('EN-1, IN-18 an edit keeps the id and the date, can add, change or clear the end date, and cannot give a visit an end', async () => {
    const deps = makeDeps(new MemoryRepo());
    const e = await logMedicalEvent(deps, { kind: 'illness', title: 'Synthetic cold', at: at('2026-01-10T09:00:00.000Z') });
    const ended = await editMedicalEvent(deps, e.id, { kind: 'illness', title: 'Synthetic cold', endDay: '2026-01-13' });
    expect(ended).toMatchObject({ id: e.id, endDay: '2026-01-13', at: e.at });
    expect((await editMedicalEvent(deps, e.id, { kind: 'illness', title: 'Synthetic cold', endDay: null })).endDay).toBeNull();
    const asVisit = await editMedicalEvent(deps, e.id, { kind: 'visit', title: 'Synthetic cold' });
    expect(asVisit).toMatchObject({ kind: 'visit', endDay: null });
    expect(await code(editMedicalEvent(deps, e.id, { kind: 'visit', title: 'Synthetic', endDay: '2026-01-13' }))).toBe('invalid_value');
    expect(await deps.repo.listRecords('medicalEvents')).toHaveLength(1);
  });

  it('EN-1, EX-13 a delete leaves a tombstone, and bulk delete by health group removes them without one', async () => {
    const deps = makeDeps(new MemoryRepo());
    const a = await logMedicalEvent(deps, { kind: 'diagnosis', title: 'Synthetic one' });
    const b = await logMedicalEvent(deps, { kind: 'visit', title: 'Synthetic two' });
    expect(await previewEntryDelete(deps, 'medicalEvents', a.id)).toEqual({});
    await deleteEntry(deps, 'medicalEvents', a.id);
    expect((await deps.repo.listTombstones()).map((t) => [t.id, t.kind])).toEqual([[a.id, 'medicalEvents']]);
    await deleteData(deps, { kinds: DELETE_GROUPS.health });
    expect(await deps.repo.listRecords('medicalEvents')).toEqual([]);
    expect((await deps.repo.listTombstones()).map((t) => t.id)).not.toContain(b.id);
  });

  it('UX-2 a medical event is a row in the day log, on the day it is dated', async () => {
    const deps = makeDeps(new MemoryRepo());
    const e = await logMedicalEvent(deps, { kind: 'test_result', title: 'Synthetic blood test', at: at('2026-01-12T07:30:00.000Z') });
    expect((await dayLog(deps, '2026-01-12')).map((r) => [r.kind, r.id])).toEqual([['medicalEvents', e.id]]);
    expect(await dayLog(deps, '2026-01-13')).toEqual([]);
  });
});

describe('medical events in storage and export (IN-18, EX-1)', () => {
  it('IN-18 SQLite stores them, and refuses a bad kind, an empty title or an end day on anything but an illness', async () => {
    const db = createNodeSqliteDb();
    const repo = await SqliteRepo.open(db);
    const row = {
      id: 'm1',
      at: { utc: '2026-01-10T09:00:00.000Z', tz: 'Europe/Warsaw' },
      kind: 'illness' as const,
      title: 'Synthetic flu',
      endDay: '2026-01-14',
      note: null,
    };
    await repo.addRecord('medicalEvents', row);
    await repo.addRecord('medicalEvents', { ...row, id: 'm2', kind: 'visit', endDay: null, note: 'n' });
    expect(await repo.listRecords('medicalEvents')).toEqual([row, { ...row, id: 'm2', kind: 'visit', endDay: null, note: 'n' }]);
    const insert = (id: string, kind: string, title: string, end: string | null) =>
      db.run(`INSERT INTO medical_event (id, ts_utc, tz, kind, title, end_day) VALUES (?, '2026-01-01T00:00:00.000Z', 'UTC', ?, ?, ?)`, [
        id,
        kind,
        title,
        end,
      ]);
    await expect(insert('a', 'x-ray', 't', null)).rejects.toThrow();
    await expect(insert('b', 'visit', '', null)).rejects.toThrow();
    await expect(insert('c', 'visit', 't', '2026-01-02')).rejects.toThrow();
  });

  it('EX-1 data.json carries medical_events, and an import refuses a bad kind, title, end day or an end on a visit', async () => {
    const deps = makeDeps(new MemoryRepo());
    await logMedicalEvent(deps, { kind: 'illness', title: 'Synthetic flu', endDay: '2026-01-20', at: at('2026-01-10T09:00:00.000Z') });
    await logMedicalEvent(deps, { kind: 'visit', title: 'Synthetic visit', note: 'n', at: at('2026-01-11T09:00:00.000Z') });
    const json = JSON.parse(strFromU8(unzipSync(await exportBundle(deps, { parts: { records: true, settings: true } }))['data.json']!));
    expect(json.records.medical_events.map((e: { kind: string; end_day: string | null }) => [e.kind, e.end_day]).sort()).toEqual([
      ['illness', '2026-01-20'],
      ['visit', null],
    ]);
    expect(parseDataJson(json).records?.medicalEvents).toHaveLength(2);
    const withEvents = (patch: object) => ({
      ...json,
      records: {
        ...json.records,
        medical_events: [{ ...json.records.medical_events.find((e: { kind: string }) => e.kind === 'illness'), ...patch }],
      },
    });
    const err = (raw: unknown) => {
      try {
        parseDataJson(raw);
        return 'no error';
      } catch (e) {
        return e instanceof NettleError ? e.code : 'other';
      }
    };
    expect(err(withEvents({}))).toBe('no error');
    for (const patch of [
      { kind: 'x-ray' },
      { title: '' },
      { title: 'x'.repeat(121) },
      { end_day: '2026-13-01' },
      { end_day: undefined },
      { kind: 'visit' },
    ])
      expect(err(withEvents(patch))).toBe('import_invalid_data');
    const missing = { ...json, records: { ...json.records } };
    delete missing.records.medical_events;
    expect(err(missing)).toBe('import_invalid_data'); // required, like every other kind
  });
});

describe('medical events in the analysis, the timeline and the report (IN-18, LL-2, SK-8, EX-3)', () => {
  async function diary() {
    const repo = new MemoryRepo();
    const deps = makeDeps(repo);
    await logSkinEntry(deps, { areaId: 'area-chin', scores, at: at('2026-01-11T08:00:00.000Z') });
    await logMedicalEvent(deps, {
      kind: 'illness',
      title: 'Synthetic throat infection',
      at: at('2026-01-12T08:00:00.000Z'),
      endDay: '2026-01-14',
    });
    await logMedicalEvent(deps, { kind: 'visit', title: 'Synthetic GP visit', at: at('2026-01-13T08:00:00.000Z'), note: 'a cream' });
    await logMedicalEvent(deps, { kind: 'diagnosis', title: 'Synthetic earlier diagnosis', at: at('2025-12-30T08:00:00.000Z') }); // inside the 21 day lookback
    return { repo, deps };
  }

  it('LL-2, LL-3 the analysis input lists them with their end date, also from the lookback, and counts them', async () => {
    const { repo } = await diary();
    const built = buildAnalysisInput(await repo.snapshot(), '2026-01-10', '2026-01-16');
    const data = JSON.parse(built.json);
    const byDate = Object.fromEntries(data.days.map((d: { date: string }) => [d.date, d]));
    expect(byDate['2026-01-12'].medical).toEqual([
      { time: expect.any(String), kind: 'illness', title: 'Synthetic throat infection', until: '2026-01-14' },
    ]);
    expect(byDate['2026-01-13'].medical[0]).toMatchObject({ kind: 'visit', note: 'a cream' });
    expect(byDate['2025-12-30']).toMatchObject({ context: true, medical: [{ kind: 'diagnosis' }] });
    expect(built.counts.medicalEvents).toBe(3);
  });

  it('IN-18, IN-6 a day is an illness day once, whether the tag, an illness event or both say so; other kinds do not make one', async () => {
    const { repo, deps } = await diary();
    await saveCheckIn(deps, { at: at('2026-01-13T20:00:00.000Z'), values: { 'tag-illness-or-infection': true }, confirmEmptyDay: true }); // inside the event's range too
    await saveCheckIn(deps, { at: at('2026-01-16T20:00:00.000Z'), values: { 'tag-illness-or-infection': true }, confirmEmptyDay: true }); // tag only
    const data = JSON.parse(buildAnalysisInput(await repo.snapshot(), '2026-01-10', '2026-01-17').json);
    const flagged = data.days.filter((d: { illness_day?: boolean }) => d.illness_day).map((d: { date: string }) => d.date);
    expect(flagged).toEqual(['2026-01-12', '2026-01-13', '2026-01-14', '2026-01-16']);
    expect(flagged).not.toContain('2026-01-15');
    const open = makeDeps(new MemoryRepo());
    await logMedicalEvent(open, { kind: 'illness', title: 'Synthetic ongoing', at: at('2026-01-12T08:00:00.000Z') });
    const ongoing = JSON.parse(buildAnalysisInput(await open.repo.snapshot(), '2026-01-10', '2026-01-17').json);
    expect(ongoing.days.filter((d: { illness_day?: boolean }) => d.illness_day).map((d: { date: string }) => d.date)).toEqual([
      '2026-01-12',
    ]); // no end date: its own day
    expect(analysisPrompt('en', { json: '{}', photoNotes: [] }).system).toMatch(/illness_day[\s\S]*Count such a day once/);
  });

  it('SK-8 an area timeline shows the start of each event and the end of an illness as markers, and an unused area stays empty', async () => {
    const { deps } = await diary();
    const days = await areaTimeline(deps, 'area-chin');
    const markers = Object.fromEntries(days.map((d) => [d.day, d.medical.map((m) => `${m.edge}:${m.event.title}`)]));
    expect(markers['2026-01-12']).toEqual(['start:Synthetic throat infection']);
    expect(markers['2026-01-14']).toEqual(['end:Synthetic throat infection']);
    expect(markers['2026-01-13']).toEqual(['start:Synthetic GP visit']);
    expect(await areaTimeline(deps, 'area-neck')).toEqual([]);
  });

  it('EX-3 the report has a medical events table with kind, title, end date and note', async () => {
    const { repo } = await diary();
    const snap = await repo.snapshot();
    const html = buildReportHtml({
      language: 'en',
      text: (key: string) => `[${key}]`,
      areaName: (a: { name: string }) => a.name,
      itemName: (i: { name: string }) => i.name,
      records: snap,
      skinAreas: snap.skinAreas,
      dailyItems: [],
      changeCategories: [],
      treatments: [],
      photos: new Map(),
      range: { from: null, to: null },
      exportedAt: { utc: '2026-01-20T10:00:00.000Z', tz: 'Europe/Warsaw' },
    } as never);
    expect(html).toContain('<h2>[report.medical]</h2>');
    for (const text of [
      'Synthetic throat infection',
      'Synthetic GP visit',
      '[medical.kinds.illness]',
      '[medical.kinds.visit]',
      '2026-01-14',
      'a cream',
    ])
      expect(html).toContain(text);
    expect(html.indexOf('Synthetic earlier diagnosis')).toBeLessThan(html.indexOf('Synthetic throat infection')); // oldest first
  });
});
