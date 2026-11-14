import { localDateTime } from '../model/time';
import type { Analysis, ListItem, Records, SkinArea } from '../model/types';
import type { Language } from '../ports/llm';

/** Text lookup for the report language, supplied by the app (core has no i18n). Keys are under `report.*`. */
export type ReportText = (key: string, vars?: Record<string, string | number>) => string;

export interface ReportInput {
  language: Language;
  text: ReportText;
  /** Display names in the report language (a predefined area is localized, a user area keeps its name). */
  areaName: (area: SkinArea) => string;
  itemName: (item: ListItem) => string;
  /** The records in the bundle, after the date range and the photo selection (EX-8). */
  records: Records;
  skinAreas: SkinArea[];
  dailyTags: ListItem[];
  treatments: ListItem[];
  /** Photo id → data URI of a small JPEG, for the photos in the bundle only. */
  photos: Map<string, string>;
  range: { from: string | null; to: string | null };
  exportedAt: { utc: string; tz: string };
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const when = (at: { utc: string; tz: string }) => localDateTime(at.utc, at.tz);
const dayOf = (at: { utc: string; tz: string }) => when(at).slice(0, 10);

const CSS = `
body{font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:11px;color:#111;margin:0}
h1{font-size:20px;margin:0 0 4px} h2{font-size:15px;margin:18px 0 6px;border-bottom:1px solid #999;padding-bottom:2px}
h3{font-size:12px;margin:10px 0 4px} table{border-collapse:collapse;width:100%;margin-bottom:6px}
td,th{border:1px solid #bbb;padding:2px 4px;text-align:left;vertical-align:top} th{background:#eee}
.note{color:#555;font-size:10px} .ai{border:2px solid #b36b00;padding:8px;margin-top:8px}
.pair{display:flex;gap:8px} .pair figure{margin:0} img{max-width:240px;max-height:240px} .strip img{max-width:110px;max-height:110px;margin-right:4px}
.page-break{page-break-before:always}`;

function table(headers: string[], rows: (string | number | null)[][]): string {
  if (rows.length === 0) return '';
  return `<table><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c ?? '')}</td>`).join('')}</tr>`)
    .join('')}</table>`;
}

/** A tiny line chart of one score over time, drawn as inline SVG so it works in any PDF renderer. */
function sparkline(values: number[]): string {
  if (values.length < 2) return '';
  const w = 160;
  const h = 28;
  const points = values.map((v, i) => `${Math.round((i / (values.length - 1)) * w)},${Math.round(h - (v / 10) * h)}`).join(' ');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${points}" fill="none" stroke="#c0392b" stroke-width="1.5"/></svg>`;
}

/**
 * EX-3, EX-4: the doctor-facing report as HTML (a renderer turns it into report.pdf). Sections: flares,
 * per-area skin trends, nails, photo comparisons and a per-nail photo timeline, check-in and digestion trends,
 * treatments, change events, the intake log, and AI analyses in their own labelled section.
 */
export function buildReportHtml(input: ReportInput): string {
  const { text: tx, records: r } = input;
  const areaById = new Map(input.skinAreas.map((a) => [a.id, a]));
  const area = (id: string) => (areaById.has(id) ? input.areaName(areaById.get(id)!) : id);
  const tags = new Map(input.dailyTags.map((t) => [t.id, input.itemName(t)]));
  const treatments = new Map(input.treatments.map((t) => [t.id, input.itemName(t)]));
  const byTime = <T extends { at: { utc: string } }>(rows: readonly T[]) => [...rows].sort((a, b) => a.at.utc.localeCompare(b.at.utc));
  const out: string[] = [];

  out.push(`<h1>${esc(tx('report.title'))}</h1>`);
  out.push(
    `<div class="note">${esc(tx('report.period', { from: input.range.from ? input.range.from.slice(0, 10) : '…', to: input.range.to ? input.range.to.slice(0, 10) : '…' }))} · ${esc(tx('report.exported', { date: when(input.exportedAt) }))}</div>`,
  );
  out.push(`<p class="note">${esc(tx('report.disclaimer'))}</p>`);

  // Flares (SK-6)
  const flares = byTime(r.flareMarkers);
  if (flares.length > 0) {
    out.push(`<h2>${esc(tx('report.flares'))}</h2>`);
    const rows: string[][] = [];
    const open = new Map<string, string>();
    for (const f of flares) {
      if (f.kind === 'start') {
        open.set(f.areaId, when(f.at));
      } else {
        rows.push([area(f.areaId), open.get(f.areaId) ?? '?', when(f.at)]);
        open.delete(f.areaId);
      }
    }
    for (const [id, start] of open) rows.push([area(id), start, tx('report.ongoing')]);
    out.push(table([tx('report.area'), tx('report.start'), tx('report.end')], rows));
  }

  // Skin trends per area (SK-3)
  const skin = byTime(r.skinEntries);
  const skinAreas = [...new Set(skin.map((e) => e.areaId))];
  if (skinAreas.length > 0) {
    out.push(`<h2>${esc(tx('report.skin'))}</h2>`);
    const heads = [tx('report.date'), ...['severity', 'itch', 'pain', 'dryness', 'scaling'].map((k) => tx(`report.scores.${k}`)), tx('report.note')];
    for (const id of skinAreas) {
      const entries = skin.filter((e) => e.areaId === id);
      out.push(`<h3>${esc(area(id))}</h3>${sparkline(entries.map((e) => e.scores.severity))}`);
      out.push(
        table(
          heads,
          entries.map((e) => [when(e.at), e.scores.severity, e.scores.itch, e.scores.pain, e.scores.dryness, e.scores.scaling, e.note]),
        ),
      );
    }
  }

  // Nails (SK-10)
  const nails = byTime(r.nailEntries);
  if (nails.length > 0) {
    out.push(`<h2>${esc(tx('report.nails'))}</h2>`);
    out.push(table([tx('report.area'), tx('report.date'), tx('report.stage'), tx('report.extent')], nails.map((e) => [area(e.areaId), when(e.at), tx(`nail.stages.${e.stage}`), tx(`nail.extents.${e.extent}`)])));
  }

  // Photos (SK-4): first and last per skin area side by side, and a timeline per nail (EX-3)
  const entryArea = new Map([...r.skinEntries, ...r.nailEntries].map((e) => [e.id, e.areaId]));
  const photos = byTime(r.photos).filter((p) => input.photos.has(p.id));
  if (photos.length > 0) {
    out.push(`<h2>${esc(tx('report.photos'))}</h2>`);
    const figure = (p: (typeof photos)[number]) => `<figure><img src="${input.photos.get(p.id)}"/><figcaption class="note">${esc(dayOf(p.at))}</figcaption></figure>`;
    const nailIds = new Set(r.nailEntries.map((e) => e.areaId));
    for (const id of [...new Set(photos.map((p) => entryArea.get(p.entryId) ?? ''))]) {
      const mine = photos.filter((p) => entryArea.get(p.entryId) === id);
      if (nailIds.has(id)) {
        out.push(`<h3>${esc(area(id))}: ${esc(tx('report.nailTimeline'))}</h3><div class="strip">${mine.map(figure).join('')}</div>`);
      } else if (mine.length > 0) {
        const pair = mine.length > 1 ? [mine[0]!, mine[mine.length - 1]!] : [mine[0]!];
        out.push(`<h3>${esc(area(id))}: ${esc(tx('report.firstLast'))}</h3><div class="pair">${pair.map(figure).join('')}</div>`);
      }
    }
  }

  // Check-ins and digestion (SK-7)
  const checkIns = byTime(r.checkIns);
  if (checkIns.length > 0) {
    out.push(`<h2>${esc(tx('report.checkins'))}</h2>`);
    out.push(
      table(
        [tx('report.date'), tx('report.wellbeing'), tx('report.stress'), tx('report.sleep'), tx('report.abdominalPain'), tx('report.bloating'), tx('report.tags'), tx('report.dayComplete')],
        checkIns.map((c) => [c.day, c.wellbeing, c.stress, c.sleep, c.abdominalPain, c.bloating ? tx('report.yes') : tx('report.no'), c.tags.map((id) => tags.get(id) ?? id).join(', '), c.completedAt ? tx('report.yes') : tx('report.no')]),
      ),
    );
  }
  const stool = byTime(r.stoolEntries);
  if (stool.length > 0) {
    out.push(`<h3>${esc(tx('report.stool'))}</h3>`);
    out.push(table([tx('report.date'), tx('report.bristol')], stool.map((s) => [when(s.at), s.bristol])));
  }

  // Treatments, change events, medication, alcohol
  const apps = byTime(r.treatmentApplications);
  if (apps.length > 0) {
    out.push(`<h2>${esc(tx('report.treatments'))}</h2>`);
    out.push(table([tx('report.date'), tx('report.treatment'), tx('report.areas')], apps.map((a) => [when(a.at), treatments.get(a.treatmentId) ?? a.treatmentId, a.areaIds.map(area).join(', ')])));
  }
  const events = byTime(r.changeEvents);
  if (events.length > 0) {
    out.push(`<h2>${esc(tx('report.changes'))}</h2>`);
    out.push(table([tx('report.date'), tx('report.what'), tx('report.name')], events.map((e) => [when(e.at), `${tx(`change.actions.${e.action}`)} (${tx(`change.categories.${e.category}`)})`, e.name])));
  }
  const meds = byTime(r.medicationEntries);
  if (meds.length > 0) {
    out.push(`<h2>${esc(tx('report.medication'))}</h2>`);
    out.push(table([tx('report.date'), tx('report.name'), tx('report.dose')], meds.map((m) => [when(m.at), m.name, m.dose])));
  }

  // Intake log (IN-1, IN-4, IN-10, IN-13)
  const meals = byTime(r.meals);
  if (meals.length > 0 || r.alcoholEntries.length > 0) {
    out.push(`<h2>${esc(tx('report.intake'))}</h2>`);
    out.push(table([tx('report.date'), tx('report.meal'), tx('report.ingredients'), tx('report.allergens')], meals.map((m) => [when(m.at), m.description, m.ingredients.join(', '), m.allergens.map((a) => tx(`allergens.${a}`)).join(', ')])));
    out.push(table([tx('report.date'), tx('report.drink'), 'ml'], byTime(r.alcoholEntries).map((a) => [when(a.at), a.drink, a.amountMl])));
  }
  const reactions = byTime(r.reactions);
  if (reactions.length > 0) {
    const mealById = new Map(r.meals.map((m) => [m.id, m]));
    out.push(`<h3>${esc(tx('report.reactions'))}</h3>`);
    out.push(table([tx('report.onset'), tx('report.meal'), tx('report.symptoms')], reactions.map((x) => [when(x.at), mealById.get(x.mealId)?.description ?? '', x.symptoms.map((s) => tx(`symptoms.${s}`)).join(', ')])));
  }

  // AI analyses (EX-4): separate, clearly labelled.
  if (r.analyses.length > 0) out.push(analysesHtml(input, byTime(r.analyses)));

  return `<!doctype html><html lang="${input.language}"><head><meta charset="utf-8"><style>${CSS}</style></head><body>${out.join('\n')}</body></html>`;
}

function analysesHtml(input: ReportInput, analyses: Analysis[]): string {
  const tx = input.text;
  const list = (title: string, items: string[]) => (items.length === 0 ? '' : `<h3>${esc(title)}</h3><ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`);
  const body = analyses
    .map(
      (a) => `<div class="ai"><div class="note">${esc(tx('report.aiMeta', { date: when(a.at), from: a.dayFrom, to: a.dayTo, model: a.model }))}</div>
<h3>${esc(tx('report.aiSummary'))}</h3><p>${esc(a.result.summary)}</p>
${a.result.hypotheses
  .map(
    (h) => `<h3>${esc(h.title)} (${esc(tx(`analysis.strength.${h.strength}`))})</h3><p>${esc(h.explanation)}</p>${list(tx('report.aiEvidence'), h.evidence)}${list(tx('report.aiAgainst'), h.counterEvidence)}<p class="note">${esc(tx('report.aiUncertainty'))}: ${esc(h.uncertainty)}</p>`,
  )
  .join('')}
<h3>${esc(tx('report.aiOrder'))}</h3><p>${esc(a.result.orderAndLag)}</p>${list(tx('report.aiLimits'), a.result.dataLimits)}</div>`,
    )
    .join('');
  return `<h2 class="page-break">${esc(tx('report.aiTitle'))}</h2><p><strong>${esc(tx('report.aiWarning'))}</strong></p>${body}`;
}
