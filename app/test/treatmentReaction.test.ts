import { buildAnalysisInput } from '@/core/llm/analysisInput';
import { analysisPrompt } from '@/core/llm/analysisPrompt';
import { buildReportHtml } from '@/core/export/report';
import { NettleError } from '@/core/model/errors';
import { PREDEFINED_ITEMS } from '@/core/model/lists';
import { SqliteRepo } from '@/adapters/storage/sqliteRepo';
import { editTreatmentApplication } from '@/core/usecases/entries';
import { applyTreatment } from '@/core/usecases/events';
import { addListItem } from '@/core/usecases/lists';
import { MemoryRepo } from './fakes/memoryRepo';
import { createNodeSqliteDb } from './helpers/nodeSqliteDb';
import { makeDeps } from './helpers/fixtures';

const code = async (p: Promise<unknown>) =>
  p.then(
    () => 'no error',
    (e: unknown) => (e instanceof NettleError ? e.code : 'other'),
  );

async function setup() {
  const repo = new MemoryRepo();
  const deps = makeDeps(repo);
  const cream = await addListItem(deps, 'treatments', 'Synthetic cream');
  return { repo, deps, cream };
}

describe('reaction after applying a treatment (IN-11)', () => {
  it('IN-11 one-tap logging records no reaction, and "not recorded" stays different from "none"', async () => {
    const { deps, cream } = await setup();
    const app = await applyTreatment(deps, { treatmentId: cream.id, areaIds: ['area-chin'] });
    expect(app.reaction).toBeNull();
    const none = await editTreatmentApplication(deps, app.id, { treatmentId: cream.id, areaIds: ['area-chin'], reaction: 'none' });
    expect(none).toMatchObject({ id: app.id, reaction: 'none' });
    const cleared = await editTreatmentApplication(deps, app.id, { treatmentId: cream.id, areaIds: ['area-chin'], reaction: null });
    expect(cleared.reaction).toBeNull();
  });

  it('IN-11 the reaction is none, mild or strong; anything else is refused and nothing changes', async () => {
    const { deps, cream } = await setup();
    const app = await applyTreatment(deps, { treatmentId: cream.id, areaIds: ['area-chin'], reaction: 'mild' });
    expect(app.reaction).toBe('mild');
    expect(await code(applyTreatment(deps, { treatmentId: cream.id, areaIds: ['area-chin'], reaction: 'burning' as never }))).toBe(
      'invalid_value',
    );
    expect(
      await code(editTreatmentApplication(deps, app.id, { treatmentId: cream.id, areaIds: ['area-chin'], reaction: 'severe' as never })),
    ).toBe('invalid_value');
    expect((await deps.repo.listRecords('treatmentApplications')).map((a) => a.reaction)).toEqual(['mild']);
  });

  it('IN-11 SQLite refuses a reaction outside the three values', async () => {
    const db = createNodeSqliteDb();
    await SqliteRepo.open(db);
    await expect(
      db.run(
        `INSERT INTO treatment_application (id, ts_utc, tz, treatment_id, area_ids_json, reaction) VALUES ('x', '2026-01-01T00:00:00.000Z', 'UTC', 't', '[]', 'severe')`,
      ),
    ).rejects.toThrow();
  });

  it('LL-2 the analysis input lists the reaction only when recorded, and the prompt says empty is not none', async () => {
    const { repo, deps, cream } = await setup();
    await applyTreatment(deps, { treatmentId: cream.id, areaIds: ['area-chin'], reaction: 'strong', at: new Date('2026-01-12T08:00:00Z') });
    await applyTreatment(deps, { treatmentId: cream.id, areaIds: ['area-neck'], at: new Date('2026-01-12T09:00:00Z') });
    const data = JSON.parse(buildAnalysisInput(await repo.snapshot(), '2026-01-10', '2026-01-14').json);
    const apps = data.days.flatMap((d: { treatments?: object[] }) => d.treatments ?? []) as { areas: string[]; reaction?: string }[];
    expect(apps.map((a) => a.reaction).sort()).toEqual(['strong', undefined]);
    expect(apps.find((a) => a.reaction)?.areas.join()).toMatch(/chin/i);
    expect(analysisPrompt('en', { json: '{}', photoNotes: [] }).system).toMatch(/no reaction recorded, which is not the same as none/);
  });

  it('EX-3 the report shows a Reaction column only when one was recorded, and an unrecorded one stays empty', async () => {
    const { repo, deps, cream } = await setup();
    await applyTreatment(deps, { treatmentId: cream.id, areaIds: ['area-chin'], reaction: 'mild', at: new Date('2026-01-12T08:00:00Z') });
    await applyTreatment(deps, { treatmentId: cream.id, areaIds: ['area-chin'], at: new Date('2026-01-13T08:00:00Z') });
    const snap = await repo.snapshot();
    const html = (apps: typeof snap.treatmentApplications) =>
      buildReportHtml({
        language: 'en',
        text: (key: string) => `[${key}]`,
        areaName: (a: { name: string }) => a.name,
        itemName: (i: { name: string }) => i.name,
        records: { ...snap, treatmentApplications: apps },
        skinAreas: snap.skinAreas,
        dailyItems: [],
        changeCategories: [],
        treatments: snap.treatments,
        photos: new Map(),
        range: { from: null, to: null },
        exportedAt: { utc: '2026-01-20T10:00:00.000Z', tz: 'Europe/Warsaw' },
      } as never);
    const out = html(snap.treatmentApplications);
    expect(out).toContain('<th>[report.treatmentReaction]</th>');
    expect(out).toContain('<td>[treatmentReaction.mild]</td>');
    expect(out).toContain('<td></td>');
    expect(html(snap.treatmentApplications.map((a) => ({ ...a, reaction: null })))).not.toContain('report.treatmentReaction');
  });
});

describe('two more daily tags (IN-6)', () => {
  it('IN-6 the hot or long shower and friction in the intimate area are seeded yes/no items, after the other tags', () => {
    const items = PREDEFINED_ITEMS.dailyItems;
    for (const id of ['tag-hot-shower', 'tag-intimate-friction'])
      expect(items.find((i) => i.id === id)).toMatchObject({ valueKind: 'yesno', predefined: true, archived: false });
    expect(items.map((i) => i.id).slice(-2)).toEqual(['tag-hot-shower', 'tag-intimate-friction']);
  });

  it('IN-6 a phone that already has the diary gets them on the next start, and a user rename survives', async () => {
    const db = createNodeSqliteDb();
    const first = await SqliteRepo.open(db);
    expect((await first.listItems('dailyItems')).map((i) => i.id)).toEqual(
      expect.arrayContaining(['tag-hot-shower', 'tag-intimate-friction']),
    );
    await db.run(`DELETE FROM list_item WHERE id = 'tag-hot-shower'`); // as on a database made before IN-6 changed
    await db.run(`UPDATE list_item SET name_override = 'Friction' WHERE id = 'tag-intimate-friction'`);
    const again = await SqliteRepo.open(db);
    const items = await again.listItems('dailyItems');
    expect(items.find((i) => i.id === 'tag-hot-shower')).toBeDefined();
    expect(items.find((i) => i.id === 'tag-intimate-friction')?.nameOverride).toBe('Friction');
  });
});
