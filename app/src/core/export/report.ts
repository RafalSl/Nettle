import { baseThreshold, DEFAULT_FLARE_THRESHOLD, deriveFlares, type FlareRule } from '../model/flares';
import { sinceCaption, sinceLastTreatment, timeToRelapse } from '../model/derived';
import { isAiSource, type IngredientSource } from '../model/source';
import { localDateTime, localDay } from '../model/time';
import type { Analysis, ListItem, Records, ReportSummary, SkinArea } from '../model/types';
import type { Language } from '../ports/llm';

/** Text lookup for the report language, supplied by the app (core has no i18n). Keys are under `report.*`. */
export type ReportText = (key: string, vars?: Record<string, string | number>) => string;

export interface ReportInput {
  /** SK-6: severity at or above which a skin entry counts as a flare (default 8). */
  flareThreshold?: FlareRule;
  language: Language;
  text: ReportText;
  /** Display names in the report language (a predefined area is localized, a user area keeps its name). */
  areaName: (area: SkinArea) => string;
  itemName: (item: ListItem) => string;
  /** The records in the bundle, after the date range and the photo selection (EX-8). */
  records: Records;
  skinAreas: SkinArea[];
  dailyItems: ListItem[];
  changeCategories: ListItem[];
  treatments: ListItem[];
  /** Photo id → data URI of a small JPEG, for the photos in the bundle only. */
  photos: Map<string, string>;
  range: { from: string | null; to: string | null };
  exportedAt: { utc: string; tz: string };
  /** LL-14: the reviewed AI summary that opens the report, if the person included one. */
  summary?: ReportSummary;
  /** NF-7: the diary day starts at this hour (default midnight). */
  dayStartHour?: number;
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const when = (at: { utc: string; tz: string }) => localDateTime(at.utc, at.tz);

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

/** A tiny line chart of one value over time, drawn as inline SVG so it works in any PDF renderer. `max` is the top of the scale (10 for a score). */
function sparkline(values: number[], max = 10): string {
  if (values.length < 2) return '';
  const w = 160;
  const h = 28;
  const points = values.map((v, i) => `${Math.round((i / (values.length - 1)) * w)},${Math.round(h - (v / max) * h)}`).join(' ');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${points}" fill="none" stroke="#c0392b" stroke-width="1.5"/></svg>`;
}

/**
 * EX-3, EX-4: the doctor-facing report as HTML (a renderer turns it into report.pdf). Sections: flares,
 * per-area skin trends, nails, photo comparisons and a per-nail photo timeline, check-in and digestion trends,
 * treatments, change events, the intake log, and AI analyses in their own labelled section.
 */
export function buildReportHtml(input: ReportInput): string {
  const { text: tx, records: r } = input;
  const dayOf = (at: { utc: string; tz: string }) => localDay(at.utc, at.tz, input.dayStartHour ?? 0);
  const areaById = new Map(input.skinAreas.map((a) => [a.id, a]));
  const area = (id: string) => (areaById.has(id) ? input.areaName(areaById.get(id)!) : id);
  const dailyItems = input.dailyItems;
  const categoryName = (id: string) => {
    const c = input.changeCategories.find((x) => x.id === id);
    return c ? input.itemName(c) : id;
  };
  const treatments = new Map(input.treatments.map((t) => [t.id, input.itemName(t)]));
  const byTime = <T extends { at: { utc: string } }>(rows: readonly T[]) => [...rows].sort((a, b) => a.at.utc.localeCompare(b.at.utc));
  const out: string[] = [];

  out.push(`<h1>${esc(tx('report.title'))}</h1>`);
  out.push(
    `<div class="note">${esc(tx('report.period', { from: input.range.from ? input.range.from.slice(0, 10) : '…', to: input.range.to ? input.range.to.slice(0, 10) : '…' }))} · ${esc(tx('report.exported', { date: when(input.exportedAt) }))}</div>`,
  );
  out.push(`<p class="note">${esc(tx('report.disclaimer'))}</p>`);

  // LL-14, EX-4: the reviewed AI summary opens the report, with the same AI label as an analysis.
  if (input.summary) {
    const s = input.summary;
    out.push(
      `<div class="ai"><h2>${esc(tx('report.summaryTitle'))}</h2><p><strong>${esc(tx('report.aiWarning'))}</strong></p>${s.text
        .split(/\n{2,}/)
        .map((p) => `<p>${esc(p.trim()).replace(/\n/g, '<br/>')}</p>`)
        .join('')}<div class="note">${esc(tx('report.summaryMeta', { date: when(s.at), from: s.dayFrom, to: s.dayTo, model: s.model }))}${s.manual ? ` · ${esc(tx('report.manual'))}` : ''}${s.text === s.generated ? '' : ` · ${esc(tx('report.summaryEdited'))}`}</div></div>`,
    );
  }

  // Flares (SK-6): derived from the skin entries and the threshold, so the table says how they were found.
  const flares = deriveFlares(r.skinEntries, input.flareThreshold ?? DEFAULT_FLARE_THRESHOLD);
  if (flares.length > 0) {
    out.push(`<h2>${esc(tx('report.flares'))}</h2>`);
    const rule = input.flareThreshold ?? DEFAULT_FLARE_THRESHOLD;
    const byArea = typeof rule === 'number' ? '' : Object.entries(rule.perArea).map(([id, n]) => `${area(id)} ${n}`).join(', ');
    out.push(`<p class="note">${esc(tx('report.flaresBasis', { n: baseThreshold(rule) }))}${byArea ? ` ${esc(tx('report.flaresBasisByArea', { list: byArea }))}` : ''}</p>`);
    out.push(
      table(
        [tx('report.areas'), tx('report.start'), tx('report.end')],
        flares.map((f) => [f.areaIds.map(area).join(', '), when(f.start), f.end ? when(f.end) : tx('report.openAtLastEntry', { date: when(f.lastEntryAt) })]),
      ),
    );
  }

  // Skin trends per area (SK-3)
  const skin = byTime(r.skinEntries);
  const skinAreas = [...new Set(skin.map((e) => e.areaId))];
  if (skinAreas.length > 0) {
    out.push(`<h2>${esc(tx('report.skin'))}</h2>`);
    for (const id of skinAreas) {
      const entries = skin.filter((e) => e.areaId === id);
      // SK-3, EX-3: entries with cracks or open wounds are marked, and a size in mm is a column and a trend where one is logged.
      const hasCracks = entries.some((e) => e.cracks);
      const sizes = entries.flatMap((e) => (e.sizeMm === null ? [] : [e.sizeMm]));
      const heads = [
        tx('report.date'),
        ...['severity', 'itch', 'pain', 'dryness', 'scaling'].map((k) => tx(`report.scores.${k}`)),
        ...(hasCracks ? [tx('report.cracks')] : []),
        ...(sizes.length > 0 ? [tx('report.sizeMm')] : []),
        tx('report.note'),
      ];
      out.push(`<h3>${esc(area(id))}</h3>${sparkline(entries.map((e) => e.scores.severity))}`);
      if (sizes.length >= 2) out.push(`<p class="note">${esc(tx('report.sizeTrend'))}</p>${sparkline(sizes, Math.max(...sizes))}`);
      out.push(
        table(
          heads,
          entries.map((e) => [
            when(e.at),
            e.scores.severity,
            e.scores.itch,
            e.scores.pain,
            e.scores.dryness,
            e.scores.scaling,
            ...(hasCracks ? [e.cracks ? tx('report.cracksYes') : ''] : []),
            ...(sizes.length > 0 ? [e.sizeMm] : []),
            e.note,
          ]),
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
    // SK-4: each photo says how long after the last treatment on its area it was taken; computed from the timestamps.
    const caption = (p: (typeof photos)[number]) => sinceCaption(sinceLastTreatment(entryArea.get(p.entryId) ?? '', p.at.utc, r.treatmentApplications), (id) => treatments.get(id) ?? id, tx);
    const figure = (p: (typeof photos)[number]) => `<figure><img src="${input.photos.get(p.id)}"/><figcaption class="note">${esc(dayOf(p.at))}<br/>${esc(caption(p))}</figcaption></figure>`;
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

  // Daily health (SK-7): one column per score item that has a value in the range, then the yes items of the day.
  const checkIns = byTime(r.checkIns);
  if (checkIns.length > 0) {
    out.push(`<h2>${esc(tx('report.checkins'))}</h2>`);
    const used = new Set(checkIns.flatMap((c) => Object.keys(c.values)));
    const scoreItems = dailyItems.filter((i) => i.valueKind === 'score' && used.has(i.id));
    const yesName = (id: string) => {
      const item = dailyItems.find((i) => i.id === id);
      return item ? input.itemName(item) : id;
    };
    out.push(
      table(
        [tx('report.date'), ...scoreItems.map((i) => input.itemName(i)), tx('report.tags')],
        checkIns.map((c) => [
          c.day,
          ...scoreItems.map((i) => (typeof c.values[i.id] === 'number' ? (c.values[i.id] as number) : '')),
          Object.entries(c.values).filter(([id, v]) => v === true || (typeof v === 'number' && !scoreItems.some((i) => i.id === id))).map(([id]) => yesName(id)).join(', '),
        ]),
      ),
    );
  }
  const stool = byTime(r.stoolEntries);
  if (stool.length > 0) {
    out.push(`<h3>${esc(tx('report.stool'))}</h3>`);
    out.push(table([tx('report.date'), tx('report.bristol')], stool.map((s) => [when(s.at), s.bristol])));
  }

  // Treatments, change events, medication
  const apps = byTime(r.treatmentApplications);
  if (apps.length > 0) {
    out.push(`<h2>${esc(tx('report.treatments'))}</h2>`);
    // IN-11: the reaction column only where one was recorded; an empty cell means not recorded.
    const hasReaction = apps.some((a) => a.reaction !== null);
    out.push(
      table(
        [tx('report.date'), tx('report.treatment'), tx('report.areas'), ...(hasReaction ? [tx('report.treatmentReaction')] : [])],
        apps.map((a) => [when(a.at), treatments.get(a.treatmentId) ?? a.treatmentId, a.areaIds.map(area).join(', '), ...(hasReaction ? [a.reaction ? tx(`treatmentReaction.${a.reaction}`) : ''] : [])]),
      ),
    );
  }
  // SK-12: time to relapse per area and treatment, derived by the program (never by the model).
  const relapse = timeToRelapse(r.skinEntries, r.treatmentApplications, input.flareThreshold ?? DEFAULT_FLARE_THRESHOLD, input.exportedAt.utc);
  if (relapse.length > 0) {
    out.push(`<h3>${esc(tx('report.relapse'))}</h3><p class="note">${esc(tx('report.relapseIntro'))}</p>`);
    out.push(
      table(
        [tx('report.area'), tx('report.treatment'), tx('report.relapseCourse'), tx('report.relapseApplications'), tx('report.relapseDays'), tx('report.relapseOthers')],
        relapse.map((x) => [
          area(x.areaId),
          treatments.get(x.treatmentId) ?? x.treatmentId,
          tx('report.relapseCourseText', { from: when(x.start), to: when(x.end) }),
          x.applications,
          x.days === null ? tx('report.relapseNoFlare') : tx('derived.days', { n: x.days }),
          x.otherTreatmentIds.map((id) => treatments.get(id) ?? id).join(', '),
        ]),
      ),
    );
  }
  const events = byTime(r.changeEvents);
  if (events.length > 0) {
    out.push(`<h2>${esc(tx('report.changes'))}</h2>`);
    out.push(table([tx('report.date'), tx('report.what'), tx('report.name')], events.map((e) => [e.dateUnknown ? tx('report.dateUnknown') : when(e.at), `${tx(`change.actions.${e.action}`)} (${categoryName(e.category)})`, e.name])));
  }
  // IN-18: medical events as recorded; an illness shows its end date when it has one.
  const medical = byTime(r.medicalEvents);
  if (medical.length > 0) {
    out.push(`<h2>${esc(tx('report.medical'))}</h2>`);
    out.push(table([tx('report.date'), tx('report.medicalKind'), tx('report.medicalTitle'), tx('report.medicalUntil'), tx('report.note')], medical.map((e) => [when(e.at).slice(0, 10), tx(`medical.kinds.${e.kind}`), e.title, e.endDay, e.note])));
  }
  const meds = byTime(r.medicationEntries);
  if (meds.length > 0) {
    out.push(`<h2>${esc(tx('report.medication'))}</h2>`);
    out.push(table([tx('report.date'), tx('report.name'), tx('report.dose')], meds.map((m) => [when(m.at), m.name, m.dose])));
  }

  // Intake log (IN-1, IN-4, IN-10, IN-13)
  const meals = byTime(r.meals);
  const tagsWithMark = (text: string, s: IngredientSource) => (s.aiTags && text ? `${text} [${tx('report.aiMark')}]` : text);
  const withMark = (text: string, s: IngredientSource) => (isAiSource(s) ? `${text} [${tx(s.edited ? 'report.aiMarkEdited' : 'report.aiMark')}]` : text);
  if (meals.length > 0 || r.drinks.length > 0) {
    out.push(`<h2>${esc(tx('report.intake'))}</h2>`);
    out.push(table([tx('report.date'), tx('report.meal'), tx('report.ingredients'), tx('report.allergens')], meals.map((m) => [when(m.at), m.description, withMark(m.ingredients.join(', '), m.source), tagsWithMark(m.allergens.map((a) => tx(`allergens.${a}`)).join(', '), m.source)])));
    out.push(table([tx('report.date'), tx('report.drink'), 'ml', tx('report.alcohol'), tx('report.ingredients'), tx('report.allergens')], byTime(r.drinks).map((a) => [when(a.at), a.name, a.amountMl, a.alcohol ? '✓' : '', withMark(a.ingredients.join(', '), a.source), tagsWithMark(a.allergens.map((x) => tx(`allergens.${x}`)).join(', '), a.source)])));
  }
  // EX-4: intake whose ingredients an AI model read, or whose allergen tags came from an AI suggestion, gets a mark, and the legend says what it means.
  if ([...meals, ...r.drinks].some((e) => isAiSource(e.source) || e.source.aiTags)) out.push(`<p class="note">${esc(tx('report.aiMarkLegend'))}</p>`);
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
      (a) => `<div class="ai"><div class="note">${esc(tx('report.aiMeta', { date: when(a.at), from: a.dayFrom, to: a.dayTo, model: a.model }))}${a.manual ? ` · ${esc(tx('report.manual'))}` : ''}</div>
<h3>${esc(tx('report.aiSummary'))}</h3><p>${esc(a.result.summary)}</p>
${a.result.hypotheses
  .map(
    (h) => `<h3>${esc(h.title)} (${esc(tx(`analysis.strength.${h.strength}`))})</h3><p>${esc(h.explanation)}</p>${list(tx('report.aiEvidence'), h.evidence)}${list(tx('report.aiAgainst'), h.counterEvidence)}<p class="note">${esc(tx('report.aiUncertainty'))}: ${esc(h.uncertainty)}</p>`,
  )
  .join('')}
<h3>${esc(tx('report.aiOrder'))}</h3><p>${esc(a.result.orderAndLag)}</p>${list(tx('report.aiLimits'), a.result.dataLimits)}${list(tx('report.aiQuestions'), a.result.doctorQuestions)}</div>`,
    )
    .join('');
  return `<h2 class="page-break">${esc(tx('report.aiTitle'))}</h2><p><strong>${esc(tx('report.aiWarning'))}</strong></p>${body}`;
}
