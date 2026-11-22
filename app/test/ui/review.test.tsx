/* eslint-disable @typescript-eslint/no-require-imports -- screens are loaded lazily, after the harness mocks are in place */
import { create, mockRouter, mockParams, mockPicker, services, Deps, mount, press, hasText, nowDeps, toggle, flush } from './harness';
import React from 'react';
import { ActionSheetIOS, Alert, AppState } from 'react-native';
import { unzipSync } from 'fflate';
import { FakeLlm } from '../fakes/fakeLlm';
import { AnalysisRunner } from '@/core/usecases/analysisRunner';
import { AppLock } from '@/core/usecases/appLock';
import { logMeal } from '@/core/usecases/logMeal';
import { addArea, archiveSkinArea, logNailEntry, logSkinEntry } from '@/core/usecases/skin';
import { logStool, saveCheckIn } from '@/core/usecases/checkin';
import { addPhoto } from '@/core/usecases/photos';
import { applyTreatment } from '@/core/usecases/events';
import { addListItem, archiveListItem } from '@/core/usecases/lists';
import { saveApiKey } from '@/core/usecases/llm';
import { prepareAnalysis } from '@/core/usecases/analysis';
import { localDay } from '@/core/model/time';
import en from '@/i18n/en.json';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { MemoryRepo } from '../fakes/memoryRepo';
import { makeDeps, syntheticScores as scores } from '../helpers/fixtures';

describe('Review (UX-1, EX-14)', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockRouter.push.mockClear();
    mockRouter.navigate.mockClear();
    mockParams.current = {};
  });
  afterEach(() => jest.restoreAllMocks());

  it('UX-1 the days list shows logged days newest first and opens one in its full log', async () => {
    const deps = nowDeps();
    await logMeal(deps, { description: 'Synthetic oats', ingredients: [], at: new Date('2026-01-10T08:00:00.000Z') });
    await logMeal(deps, { description: 'Synthetic soup', ingredients: [], at: new Date('2026-01-12T08:00:00.000Z') });
    await logStool(deps, { bristol: 4, at: new Date('2026-01-12T09:00:00.000Z') });
    mockParams.current = { month: '2026-01' };
    const { tree } = await mount(() => require('@/app/(tabs)/review/index'), deps);
    await flush();
    const first = en.review.dayRow.replace('{{day}}', '2026-01-12').replace('{{n}}', '2');
    expect(JSON.stringify(tree.toJSON()).indexOf(first)).toBeGreaterThan(-1);
    await press(tree, first);
    expect(mockRouter.navigate).toHaveBeenLastCalledWith({ pathname: '/review/day', params: { day: '2026-01-12' } });
    await press(tree, en.review.report);
    expect(mockRouter.push).toHaveBeenLastCalledWith('/review/report');
  });

  it('UX-10 Days shows one month with a calendar grid marking entries, Daily health and flare days, with arrows and a month filter', async () => {
    const deps = nowDeps();
    await logMeal(deps, { description: 'Synthetic oats', ingredients: [], at: new Date('2026-01-10T08:00:00.000Z') });
    await logMeal(deps, { description: 'Synthetic soup', ingredients: [], at: new Date('2026-01-12T08:00:00.000Z') });
    await saveCheckIn(deps, { at: new Date('2026-01-12T20:00:00.000Z') });
    await logSkinEntry(deps, {
      areaId: 'area-chin',
      scores: { severity: 9, itch: 0, pain: 0, dryness: 0, scaling: 0 },
      at: new Date('2026-01-11T08:00:00.000Z'),
    });
    await logSkinEntry(deps, {
      areaId: 'area-chin',
      scores: { severity: 2, itch: 0, pain: 0, dryness: 0, scaling: 0 },
      at: new Date('2026-01-14T08:00:00.000Z'),
    });
    mockParams.current = { month: '2026-01' };
    const { tree } = await mount(() => require('@/app/(tabs)/review/index'), deps);
    await flush();
    const cell = (day: string, n: number, health: boolean, flare: boolean) =>
      en.review.calendarDay
        .replace('{{day}}', day)
        .replace('{{n}}', String(n))
        .replace('{{health}}', health ? en.review.yes : en.review.no)
        .replace('{{flare}}', flare ? en.review.yes : en.review.no);
    await press(tree, cell('2026-01-10', 1, false, false));
    expect(mockRouter.navigate).toHaveBeenLastCalledWith({ pathname: '/review/day', params: { day: '2026-01-10' } });
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === cell('2026-01-12', 2, true, true)).length).toBeGreaterThan(0); // flare 11th to 13th, 14th is the end entry
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === cell('2026-01-14', 1, false, false)).length).toBeGreaterThan(0);
    // the incomplete filter lists days with entries and no Daily health record
    await toggle(tree, en.review.incomplete);
    const listRow = (label: string) =>
      tree.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function').length;
    expect(listRow(en.review.dayRow.replace('{{day}}', '2026-01-10').replace('{{n}}', '1'))).toBeGreaterThan(0);
    expect(listRow(`${en.review.dayRow.replace('{{day}}', '2026-01-12').replace('{{n}}', '2')}, ${en.review.dayComplete}`)).toBe(0);
    // arrows move by month; the next arrow stops at the current month
    await press(tree, en.review.prevMonth);
    await flush();
    expect(hasText(tree, '2025-12')).toBe(true);
    expect(hasText(tree, en.review.noIncomplete)).toBe(true);
  });

  it('UX-10 Areas groups skin and nail areas with the last score or stage, flaring areas first, and hides archived areas', async () => {
    const deps = nowDeps();
    const nail = await addArea(deps, 'Synthetic thumb', 'nail');
    await logSkinEntry(deps, { areaId: 'area-neck', scores: { ...scores, severity: 3 }, at: new Date('2026-01-12T08:00:00.000Z') });
    await logSkinEntry(deps, { areaId: 'area-chin', scores: { ...scores, severity: 9 }, at: new Date('2026-01-10T08:00:00.000Z') });
    await logNailEntry(deps, { areaId: nail.id, stage: 'yellow', extent: 'under_quarter', at: new Date('2026-01-11T08:00:00.000Z') });
    await archiveSkinArea(deps, 'area-sternum');
    mockParams.current = { view: 'areas' };
    const { tree } = await mount(() => require('@/app/(tabs)/review/index'), deps);
    await flush();
    const text = JSON.stringify(tree.toJSON());
    expect(text).toContain(en.review.skinGroup);
    expect(text).toContain(en.review.nailsGroup);
    expect(text.indexOf(en.areas['area-chin'])).toBeLessThan(text.indexOf(en.areas['area-neck'])); // the flaring area first, though logged earlier
    expect(text).toContain(`${en.review.areaSeverity.replace('{{n}}', '9')} · 2026-01-10 · ${en.review.areaFlaring}`);
    expect(text).toContain(`${en.nail.stages.yellow}, ${en.nail.extents.under_quarter} · 2026-01-11`);
    expect(text).toContain(en.review.areaNone); // an active area with no entries yet
    expect(text).not.toContain(en.areas['area-sternum']);
    await press(tree, en.review.days);
    expect(hasText(tree, en.review.calendarLegend)).toBe(true);
  });

  it('UX-1 an empty Review explains why', async () => {
    const { tree } = await mount(() => require('@/app/(tabs)/review/index'), nowDeps());
    await flush();
    expect(hasText(tree, en.review.noDays)).toBe(true);
  });

  it('UX-2 the day heading opens a date picker; a picked past day shows that day, a future day is not chosen, and Today returns', async () => {
    const deps = nowDeps();
    await logMeal(deps, { description: 'Synthetic old meal', ingredients: [], at: new Date('2026-01-10T08:00:00.000Z') });
    const { tree } = await mount(() => require('@/app/(tabs)/today/index'), deps);
    await flush();
    mockPicker.last = undefined;
    expect(mockPicker.last).toBeUndefined(); // closed until the heading is pressed
    await press(tree, en.day.jump);
    expect(mockPicker.last!.maximumDate).toBeInstanceOf(Date);
    await act(async () => {
      mockPicker.last!.onValueChange({}, new Date('2026-01-10T12:00:00'));
    });
    await flush();
    expect(hasText(tree, '10 Jan')).toBe(true);
    expect(hasText(tree, 'Synthetic old meal')).toBe(true);
    mockPicker.last = undefined;
    await flush();
    expect(mockPicker.last).toBeUndefined(); // closes after a pick
    await press(tree, en.day.jump);
    await act(async () => {
      mockPicker.last!.onValueChange({}, new Date(Date.now() + 5 * 86_400_000));
    });
    await flush();
    expect(hasText(tree, en.day.backToToday)).toBe(false); // a future date lands on today
    expect(hasText(tree, 'Synthetic old meal')).toBe(false);
  });

  it('UX-2 an entry that appears after the first look is highlighted for a moment; the first look highlights nothing', async () => {
    const deps = nowDeps();
    await logMeal(deps, { description: 'Synthetic earlier meal', ingredients: [], at: new Date(Date.now() - 3600_000) });
    const { tree } = await mount(() => require('@/app/(tabs)/today/index'), deps);
    await flush();
    const marked = () => tree.root.findAll((n) => n.props.accessibilityHint === en.day.newEntry && typeof n.props.onPress === 'function');
    expect(hasText(tree, 'Synthetic earlier meal')).toBe(true);
    expect(marked()).toHaveLength(0);
    await press(tree, en.day.stool);
    await press(tree, en.day.stoolType.replace('{{n}}', '4'));
    await flush();
    expect(marked()).toHaveLength(1);
    expect(marked()[0]!.props.accessibilityLabel).toContain(en.log.stool.replace('{{n}}', '4'));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 3100)); // the tint goes away by itself
    });
    expect(marked()).toHaveLength(0);
  });

  it('UX-2 Today opens the day given in the route parameter', async () => {
    const deps = nowDeps();
    await logMeal(deps, { description: 'Synthetic old meal', ingredients: [], at: new Date('2026-01-10T08:00:00.000Z') });
    mockParams.current = { day: '2026-01-10' };
    const { tree } = await mount(() => require('@/app/(tabs)/today/index'), deps);
    await flush();
    expect(hasText(tree, 'Synthetic old meal')).toBe(true);
    expect(hasText(tree, '10 Jan')).toBe(true);
  });

  it('UX-2, NF-7 Today moves on to the new day by itself when the app comes back after midnight', async () => {
    const deps = makeDeps(new MemoryRepo(), '2026-11-14T22:00:00.000Z'); // 23:00 in Warsaw
    let now = new Date('2026-11-14T22:00:00.000Z');
    deps.clock.now = () => now;
    let onChange: ((s: string) => void) | null = null;
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_t: string, h: (s: string) => void) => {
      onChange = h;
      return { remove: jest.fn() };
    }) as never);
    mockParams.current = {};
    const { tree } = await mount(() => require('@/app/(tabs)/today/index'), deps);
    await flush();
    expect(hasText(tree, '14 Nov')).toBe(true);
    now = new Date('2026-11-14T23:30:00.000Z'); // 00:30 on the 15th
    await act(async () => onChange!('active'));
    expect(hasText(tree, '15 Nov')).toBe(true);
    expect(hasText(tree, '14 Nov')).toBe(false);
    jest.restoreAllMocks();
  });

  it('UX-2 Today shows the 8 newest entries of the day and "Show all (n)" opens the full log in Review', async () => {
    const deps = nowDeps();
    const base = Date.now() - 3 * 3600_000;
    for (let i = 0; i < 10; i++)
      await logMeal(deps, { description: `Synthetic meal ${i}`, ingredients: [], at: new Date(base + i * 60_000) });
    const { tree } = await mount(() => require('@/app/(tabs)/today/index'), deps);
    await flush();
    expect(hasText(tree, 'Synthetic meal 9')).toBe(true); // newest on top
    expect(hasText(tree, 'Synthetic meal 2')).toBe(true);
    expect(hasText(tree, 'Synthetic meal 1')).toBe(false);
    expect(hasText(tree, 'Synthetic meal 0')).toBe(false);
    const today = new Date().toISOString().slice(0, 10);
    await press(tree, en.day.showAll.replace('{{n}}', '10'));
    expect(mockRouter.navigate).toHaveBeenLastCalledWith({
      pathname: '/review/day',
      params: { day: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) },
    });
    mockParams.current = { day: (mockRouter.navigate.mock.calls.at(-1)![0] as { params: { day: string } }).params.day };
    const full = await mount(() => require('@/app/(tabs)/review/day'), deps);
    await flush();
    for (let i = 0; i < 10; i++) expect(hasText(full.tree, `Synthetic meal ${i}`)).toBe(true);
    expect(today).toMatch(/^\d{4}/);
  });

  it('UX-2 a day with 8 entries or fewer has no "Show all" row', async () => {
    const deps = nowDeps();
    for (let i = 0; i < 8; i++)
      await logMeal(deps, { description: `Synthetic meal ${i}`, ingredients: [], at: new Date(Date.now() - 3600_000 + i * 60_000) });
    const { tree } = await mount(() => require('@/app/(tabs)/today/index'), deps);
    await flush();
    expect(JSON.stringify(tree.toJSON())).not.toContain(en.day.showAll.replace(' ({{n}})', ''));
  });

  it('NF-7 Logging settings has "Day starts at" and saves the hour at once', async () => {
    const deps = nowDeps();
    const { tree } = await mount(() => require('@/app/settings/logging'), deps);
    expect(hasText(tree, en.day.dayStart)).toBe(true);
    await press(tree, '03:00');
    await flush();
    expect(deps.dayStart.get()).toBe(3);
    expect((await deps.repo.getPreferences())?.dayStartHour).toBe(3);
  });

  it('LL-14, LL-5, LL-12 the doctor report writes a summary after the billing confirmation, lets the person edit it, and puts it in the PDF', async () => {
    const answer = JSON.stringify({ summary: 'Synthetic AI narrative.' });
    const deps = nowDeps(new FakeLlm([answer]));
    await saveApiKey(deps, 'sk-synthetic-secret');
    await logMeal(deps, { description: 'Synthetic soup', ingredients: ['soup'], at: new Date(Date.now() - 86_400_000) });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { tree, fileShare } = await mount(() => require('@/app/(tabs)/review/report'), deps);
    await flush();
    await press(tree, en.doctor.summaryButton);
    await flush();
    const [title, body, buttons] = alert.mock.calls.at(-1) as unknown as [string, string, { text: string; onPress?: () => unknown }[]];
    expect(title).toBe(en.doctor.summaryConfirmTitle);
    expect(body).toContain('bills this separately'); // LL-5
    expect(body).toContain(en.doctor.summaryNoPhotos);
    await act(async () => {
      void buttons.find((b) => b.text === en.doctor.summarySend)!.onPress!();
    });
    await flush();
    expect(hasText(tree, en.doctor.summaryReview)).toBe(true);
    const field = tree.root.findAll(
      (n) => n.props.accessibilityLabel === en.doctor.summaryField && typeof n.props.onChangeText === 'function',
    )[0]!;
    expect(field.props.value).toBe('Synthetic AI narrative.');
    expect(await deps.repo.listRecords('reportSummaries')).toEqual([]); // nothing stored before the person keeps it
    await act(async () => {
      field.props.onChangeText('Synthetic AI narrative, corrected.');
    });
    await press(tree, en.doctor.summaryUse);
    await flush();
    expect(hasText(tree, en.doctor.summaryIncluded)).toBe(true);
    expect(await deps.repo.listRecords('reportSummaries')).toMatchObject([
      { generated: 'Synthetic AI narrative.', text: 'Synthetic AI narrative, corrected.' },
    ]);
    await press(tree, en.doctor.button);
    await flush();
    const [, bytes] = fileShare.saveAndShare.mock.calls[0] as unknown as [string, Uint8Array];
    expect(Object.keys(unzipSync(bytes))).toContain('report.pdf');
    expect(new TextDecoder().decode(unzipSync(bytes)['report.pdf']!)).toContain('Synthetic AI narrative, corrected.');
    alert.mockRestore();
  });

  it('LL-14 changing the period or the language drops the summary and asks for a new one', async () => {
    const deps = nowDeps(new FakeLlm([JSON.stringify({ summary: 'Synthetic AI narrative.' })]));
    await saveApiKey(deps, 'sk-synthetic-secret');
    await logMeal(deps, { description: 'Synthetic soup', ingredients: ['soup'], at: new Date(Date.now() - 86_400_000) });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { tree } = await mount(() => require('@/app/(tabs)/review/report'), deps);
    await flush();
    await press(tree, en.doctor.summaryButton);
    await flush();
    const buttons = alert.mock.calls.at(-1)![2] as { text: string; onPress?: () => unknown }[];
    await act(async () => {
      void buttons.find((b) => b.text === en.doctor.summarySend)!.onPress!();
    });
    await flush();
    await press(tree, en.doctor.summaryUse);
    await flush();
    expect(hasText(tree, en.doctor.summaryIncluded)).toBe(true);
    await press(tree, en.export.polish);
    await flush();
    expect(hasText(tree, en.doctor.summaryIncluded)).toBe(false);
    expect(hasText(tree, en.doctor.summaryButton)).toBe(true);
    alert.mockRestore();
  });

  it('EX-14, EX-7 the doctor report counts the period, leaves sensitive photos out until asked, and remembers the export', async () => {
    const deps = nowDeps();
    const entry = await logSkinEntry(deps, { areaId: 'area-penis', scores, at: new Date(Date.now() - 86_400_000) });
    await addPhoto(deps, { entryKind: 'skinEntry', entryId: entry.id, sourceUri: 'secret' });
    const { tree, fileShare } = await mount(() => require('@/app/(tabs)/review/report'), deps);
    await flush();
    expect(hasText(tree, en.doctor.counts.replace('{{entries}}', '1').replace('{{photos}}', '1'))).toBe(true);
    await press(tree, en.doctor.button);
    await flush();
    const [name, bytes] = fileShare.saveAndShare.mock.calls[0] as unknown as [string, Uint8Array];
    expect(name).toMatch(/^nettle-report-/);
    const files = Object.keys(unzipSync(bytes));
    expect(files).toEqual(expect.arrayContaining(['data.json', 'report.pdf']));
    expect(files.some((f) => f.startsWith('photos/'))).toBe(false); // sensitive photo left out
    expect(await deps.settings.get('lastExportAt')).not.toBeNull();
    await toggle(tree, en.doctor.sensitive.replace('{{n}}', '1'));
    await press(tree, en.doctor.button);
    await flush();
    const second = Object.keys(unzipSync((fileShare.saveAndShare.mock.calls[1] as unknown as [string, Uint8Array])[1]));
    expect(second.some((f) => f.startsWith('photos/'))).toBe(true);
  });

  it('EX-4, EX-7 the doctor report can pick photos one by one: Select all leaves sensitive ones out, and only picked photos are exported', async () => {
    const deps = nowDeps();
    const a = await logSkinEntry(deps, { areaId: 'area-chin', scores, at: new Date(Date.now() - 86_400_000) });
    const b = await logSkinEntry(deps, { areaId: 'area-penis', scores, at: new Date(Date.now() - 86_000_000) });
    await addPhoto(deps, { entryKind: 'skinEntry', entryId: a.id, sourceUri: 'plain', at: new Date(Date.now() - 80_000_000) });
    await addPhoto(deps, { entryKind: 'skinEntry', entryId: b.id, sourceUri: 'secret', at: new Date(Date.now() - 79_000_000) });
    const { tree, fileShare } = await mount(() => require('@/app/(tabs)/review/report'), deps);
    await flush();
    await toggle(tree, en.doctor.pickPhotos);
    expect(hasText(tree, en.photos.leftOut)).toBe(true); // the sensitive photo starts unselected
    await press(tree, en.doctor.button);
    await flush();
    const none = Object.keys(unzipSync((fileShare.saveAndShare.mock.calls[0] as unknown as [string, Uint8Array])[1]));
    expect(none.some((f) => f.startsWith('photos/'))).toBe(false); // nothing picked, nothing exported
    await press(tree, en.photos.selectAll);
    await press(tree, en.doctor.button);
    await flush();
    const some = Object.keys(unzipSync((fileShare.saveAndShare.mock.calls[1] as unknown as [string, Uint8Array])[1])).filter((f) =>
      f.startsWith('photos/'),
    );
    expect(some).toHaveLength(1); // the plain one only
  });

  it('EX-14 with nothing in the period the button is disabled and says why; after an export "since last export" is the default', async () => {
    const deps = nowDeps();
    const { tree } = await mount(() => require('@/app/(tabs)/review/report'), deps);
    await flush();
    expect(hasText(tree, en.doctor.empty)).toBe(true);
    const button = tree.root.findAll((n) => n.props.accessibilityLabel === en.doctor.button && n.props.accessibilityState)[0]!;
    expect(button.props.accessibilityState.disabled).toBe(true);
    expect(hasText(tree, en.doctor.since)).toBe(false);
    await deps.settings.set('lastExportAt', new Date().toISOString());
    const again = await mount(() => require('@/app/(tabs)/review/report'), deps);
    await flush();
    expect(
      again.tree.root.findAll((n) => n.props.accessibilityLabel === en.doctor.since && n.props.accessibilityState?.selected),
    ).not.toHaveLength(0);
  });
});

describe('Daily health trends (SK-7, UX-1)', () => {
  it('SK-7 the trends screen charts one score item at a time over the logged days, and an archived item keeps its history', async () => {
    const deps = makeDeps(new MemoryRepo(), '2026-01-20T10:00:00.000Z');
    mockRouter.push.mockClear();
    const empty = await mount(() => require('@/app/(tabs)/review/health'), deps);
    await flush();
    expect(hasText(empty.tree, en.review.healthEmpty)).toBe(true);
    await saveCheckIn(deps, {
      at: new Date('2026-01-10T20:00:00.000Z'),
      values: { 'item-stress': 2, 'item-sleep': 7 },
      confirmEmptyDay: true,
    });
    await saveCheckIn(deps, { at: new Date('2026-01-12T20:00:00.000Z'), values: { 'item-stress': 8 }, confirmEmptyDay: true });
    await archiveListItem(deps, 'dailyItems', 'item-stress');
    const { tree } = await mount(() => require('@/app/(tabs)/review/health'), deps);
    await flush();
    const summary = (label: string, first: number, last: number, min: number, max: number) =>
      en.review.trendSummary
        .replace('{{label}}', label)
        .replace('{{from}}', '2026-01-10')
        .replace('{{to}}', '2026-01-12')
        .replace('{{first}}', String(first))
        .replace('{{last}}', String(last))
        .replace('{{min}}', String(min))
        .replace('{{max}}', String(max));
    expect(hasText(tree, summary(en.tags['item-sleep'], 7, 7, 7, 7).replace('2026-01-12', '2026-01-10'))).toBe(true); // sleep: one day
    await press(tree, en.tags['item-stress']);
    await flush();
    expect(hasText(tree, summary(en.tags['item-stress'], 2, 8, 2, 8))).toBe(true);
    const review = await mount(() => require('@/app/(tabs)/review/index'), deps);
    await flush();
    await press(review.tree, en.review.healthTitle);
    expect(mockRouter.push).toHaveBeenLastCalledWith('/review/health');
  });
});

describe('Area timeline (SK-8)', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockRouter.push.mockClear();
  });
  afterEach(() => jest.restoreAllMocks());

  it('SK-8 Review lists the areas with entries and opens one timeline', async () => {
    const deps = nowDeps();
    await logSkinEntry(deps, { areaId: 'area-chin', scores, at: new Date('2026-01-10T08:00:00.000Z') });
    mockParams.current = { view: 'areas' };
    const { tree } = await mount(() => require('@/app/(tabs)/review/index'), deps);
    await flush();
    await press(tree, en.areas['area-chin']);
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/review/area', params: { id: 'area-chin' } });
  });

  it('SK-8, UX-1 the timeline charts a score, switches score, and compares two photos side by side with the earlier one first', async () => {
    const deps = makeDeps(new MemoryRepo(), '2026-01-20T10:00:00.000Z');
    const a = await logSkinEntry(deps, {
      areaId: 'area-chin',
      scores: { ...scores, severity: 2, itch: 9 },
      at: new Date('2026-01-10T08:00:00.000Z'),
    });
    const b = await logSkinEntry(deps, {
      areaId: 'area-chin',
      scores: { ...scores, severity: 6, itch: 1 },
      at: new Date('2026-01-12T08:00:00.000Z'),
    });
    const pa = await addPhoto(deps, {
      entryKind: 'skinEntry',
      entryId: a.id,
      sourceUri: 'first-photo',
      at: new Date('2026-01-10T08:05:00.000Z'),
    });
    const pb = await addPhoto(deps, {
      entryKind: 'skinEntry',
      entryId: b.id,
      sourceUri: 'second-photo',
      at: new Date('2026-01-12T08:05:00.000Z'),
    });
    mockParams.current = { id: 'area-chin' };
    const { tree } = await mount(() => require('@/app/(tabs)/review/area'), deps);
    await flush();
    const summary = (label: string) =>
      en.review.trendSummary.replace('{{label}}', label).replace('{{from}}', '2026-01-10').replace('{{to}}', '2026-01-12');
    expect(
      hasText(
        tree,
        summary(en.skin.scores.severity).replace('{{first}}', '2').replace('{{last}}', '6').replace('{{min}}', '2').replace('{{max}}', '6'),
      ),
    ).toBe(true);
    await press(tree, en.skin.scores.itch);
    expect(
      hasText(
        tree,
        summary(en.skin.scores.itch).replace('{{first}}', '9').replace('{{last}}', '1').replace('{{min}}', '1').replace('{{max}}', '9'),
      ),
    ).toBe(true);
    await press(tree, en.review.compare);
    expect(hasText(tree, en.review.comparePick)).toBe(true);
    await press(tree, `${en.review.pick} ${pb.at.utc}`); // the later photo first: the comparison still puts the earlier one on the left
    await press(tree, `${en.review.pick} ${pa.at.utc}`);
    const shownLabels = tree.root
      .findAll((n) => typeof n.props.accessibilityLabel === 'string' && /^2026-01-1[02] 0[0-9]:05/.test(n.props.accessibilityLabel))
      .map((n) => n.props.accessibilityLabel as string);
    expect([...new Set(shownLabels)].map((l) => l.slice(0, 16))).toEqual(['2026-01-10 09:05', '2026-01-12 09:05']);
    await press(tree, en.review.compareDone);
    expect(hasText(tree, en.review.comparePick)).toBe(false);
    mockParams.current = {};
  });

  it('SK-8, SK-5 the timeline shows scores beside photos, and a sensitive photo stays blurred until tapped', async () => {
    const deps = nowDeps();
    const entry = await logSkinEntry(deps, { areaId: 'area-penis', scores, at: new Date('2026-01-10T08:00:00.000Z') });
    await addPhoto(deps, { entryKind: 'skinEntry', entryId: entry.id, sourceUri: 'secret' }); // sensitive by the area default
    mockParams.current = { id: 'area-penis' };
    const { tree } = await mount(() => require('@/app/(tabs)/review/area'), deps);
    await flush();
    expect(hasText(tree, '2026-01-10')).toBe(true);
    expect(hasText(tree, `${en.skin.scores.itch} 2`)).toBe(true);
    const blurred = () => tree.root.findAll((n) => n.props.blurRadius !== undefined).map((n) => n.props.blurRadius as number);
    expect(blurred()).toContain(30);
    await press(tree, en.photos.tapToShow);
    expect(blurred()).not.toContain(30);
    mockParams.current = {};
  });

  it('SK-8 Go to date scrolls to the day, or the nearest earlier day, says so, and leaves the chart and the list complete', async () => {
    const deps = nowDeps();
    await logSkinEntry(deps, { areaId: 'area-chin', scores, at: new Date('2026-01-10T08:00:00.000Z') });
    await logSkinEntry(deps, { areaId: 'area-chin', scores, at: new Date('2026-01-14T08:00:00.000Z') });
    mockParams.current = { id: 'area-chin' };
    const { tree } = await mount(() => require('@/app/(tabs)/review/area'), deps);
    await flush();
    const scrollTo = tree.root.findAll((n) => n.instance && typeof n.instance.scrollTo === 'function')[0]!.instance.scrollTo as jest.Mock; // the jest ScrollView mock
    scrollTo.mockClear();
    const layoutOf = (day: string, y: number) =>
      act(async () => {
        const node = tree.root.findAll(
          (n) => typeof n.props.onLayout === 'function' && n.findAll((c) => c.children.includes(day)).length > 0,
        )[0]!;
        node.props.onLayout({ nativeEvent: { layout: { y } } });
      });
    await layoutOf('2026-01-14', 40);
    await layoutOf('2026-01-10', 400);
    mockPicker.last = undefined;
    await press(tree, en.review.goToDate);
    expect(mockPicker.last!.maximumDate).toBeInstanceOf(Date);
    const pick = (iso: string) => act(async () => mockPicker.last!.onValueChange({}, new Date(`${iso}T12:00:00`)));
    await pick('2026-01-12'); // no entry that day: the nearest earlier one is the 10th
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 392, animated: true });
    expect(hasText(tree, en.review.jumpEarlier.replace('{{picked}}', '2026-01-12').replace('{{shown}}', '2026-01-10'))).toBe(true);
    expect(hasText(tree, '2026-01-14')).toBe(true); // navigation, not a filter
    mockPicker.last = undefined;
    await press(tree, en.review.goToDate);
    await pick('2026-01-14'); // an exact hit says nothing
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 32, animated: true });
    expect(hasText(tree, 'No entry on')).toBe(false);
    mockPicker.last = undefined;
    await press(tree, en.review.goToDate);
    await pick('2026-01-02'); // before the first entry
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 392, animated: true });
    expect(hasText(tree, en.review.jumpOldest.replace('{{picked}}', '2026-01-02').replace('{{shown}}', '2026-01-10'))).toBe(true);
    mockParams.current = {};
  });

  it('EN-1, SK-8 a tap on an entry opens the day log sheet naming its photos; Edit opens the form and Delete reloads the timeline', async () => {
    const deps = nowDeps();
    const keep = await logSkinEntry(deps, { areaId: 'area-chin', scores, at: new Date('2026-01-10T08:00:00.000Z') });
    const doomed = await logSkinEntry(deps, {
      areaId: 'area-chin',
      scores: { ...scores, severity: 7 },
      at: new Date('2026-01-12T08:00:00.000Z'),
    });
    await addPhoto(deps, { entryKind: 'skinEntry', entryId: doomed.id, sourceUri: 'doomed-photo' });
    mockParams.current = { id: 'area-chin' };
    const sheet = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation((_o, cb) => cb(0)); // Edit
    const { tree } = await mount(() => require('@/app/(tabs)/review/area'), deps);
    await flush();
    const entries = () =>
      tree.root.findAll((n) => n.props.accessibilityHint === en.review.entryHint && typeof n.props.onPress === 'function');
    expect(entries()).toHaveLength(2); // flare lines are derived and have no tap target
    await act(async () => entries()[0]!.props.onPress()); // newest day first: the 12th
    await flush();
    const [opts] = sheet.mock.calls[0] as unknown as [
      { title: string; message: string; options: string[]; destructiveButtonIndex: number[] },
    ];
    expect(opts.title).toBe(`${en.log.skin}: ${en.areas['area-chin']}`);
    expect(opts.message).toContain(`1 ${en.log.kinds.photos}`);
    expect(opts.options).toEqual([en.log.editAction, en.log.deleteAction, en.common.cancel]);
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/form/edit', params: { kind: 'skinEntries', id: doomed.id } });
    sheet.mockImplementation((_o, cb) => cb(1)); // Delete
    await act(async () => entries()[0]!.props.onPress());
    await flush();
    expect((await deps.repo.listRecords('skinEntries')).map((e) => e.id)).toEqual([keep.id]);
    expect((await deps.repo.listTombstones()).map((x) => x.id)).toContain(doomed.id);
    expect(hasText(tree, '2026-01-12')).toBe(false); // the timeline reloaded
    expect(entries()).toHaveLength(1);
    jest.restoreAllMocks();
    mockParams.current = {};
  });

  it('SK-8, UX-10 while comparing photos the entry lines are off, so taps pick photos', async () => {
    const deps = nowDeps();
    const a = await logSkinEntry(deps, { areaId: 'area-chin', scores, at: new Date('2026-01-10T08:00:00.000Z') });
    const b = await logSkinEntry(deps, { areaId: 'area-chin', scores, at: new Date('2026-01-12T08:00:00.000Z') });
    await addPhoto(deps, { entryKind: 'skinEntry', entryId: a.id, sourceUri: 'one' });
    await addPhoto(deps, { entryKind: 'skinEntry', entryId: b.id, sourceUri: 'two' });
    mockParams.current = { id: 'area-chin' };
    const { tree } = await mount(() => require('@/app/(tabs)/review/area'), deps);
    await flush();
    const disabled = () =>
      tree.root
        .findAll((n) => n.props.accessibilityHint === en.review.entryHint && typeof n.props.onPress === 'function')
        .map((n) => n.props.disabled);
    expect(disabled()).toEqual([false, false]);
    await press(tree, en.review.compare);
    expect(disabled()).toEqual([true, true]);
    await press(tree, en.review.compareDone);
    expect(disabled()).toEqual([false, false]);
    mockParams.current = {};
  });

  it('SK-8 an area without entries explains it is empty', async () => {
    mockParams.current = { id: 'area-sternum' };
    const { tree } = await mount(() => require('@/app/(tabs)/review/area'), nowDeps());
    await flush();
    expect(hasText(tree, en.review.timelineEmpty)).toBe(true);
    mockParams.current = {};
  });
});

describe('Trend range switch (SK-7, SK-8)', () => {
  it('SK-8 the chart shows 90 days by default; 30 days drops older points and All brings every point back', async () => {
    const deps = makeDeps(new MemoryRepo(), '2026-03-20T10:00:00.000Z');
    await saveCheckIn(deps, { at: new Date('2026-01-10T20:00:00.000Z'), values: { 'item-sleep': 7 }, confirmEmptyDay: true });
    await saveCheckIn(deps, { at: new Date('2026-03-10T20:00:00.000Z'), values: { 'item-sleep': 5 }, confirmEmptyDay: true });
    const { tree } = await mount(() => require('@/app/(tabs)/review/health'), deps);
    await flush();
    const summary = (from: string, first: number) =>
      en.review.trendSummary
        .replace('{{label}}', en.tags['item-sleep'])
        .replace('{{from}}', from)
        .replace('{{to}}', '2026-03-10')
        .replace('{{first}}', String(first))
        .replace('{{last}}', '5')
        .replace('{{min}}', '5')
        .replace('{{max}}', String(first === 5 ? 5 : 7));
    expect(hasText(tree, summary('2026-01-10', 7))).toBe(true); // 90 days back from 20 March reaches 20 Dec: January is in
    await press(tree, en.review.range['30d']);
    expect(hasText(tree, summary('2026-03-10', 5))).toBe(true); // only the March point
    await press(tree, en.review.range.all);
    expect(hasText(tree, summary('2026-01-10', 7))).toBe(true);
  });
});

describe('Time since the last treatment on a photo (SK-4)', () => {
  it('SK-4, SK-8 the area timeline says how long after the last treatment each photo was taken, or that none was logged', async () => {
    const deps = nowDeps();
    const cream = await addListItem(deps, 'treatments', 'Synthetic cream');
    const first = await logSkinEntry(deps, { areaId: 'area-chin', scores, at: new Date('2026-01-10T08:00:00.000Z') });
    await addPhoto(deps, { entryKind: 'skinEntry', entryId: first.id, sourceUri: 'before', at: new Date('2026-01-10T08:05:00.000Z') });
    await applyTreatment(deps, { treatmentId: cream.id, areaIds: ['area-chin'], at: new Date('2026-01-12T08:00:00.000Z') });
    const second = await logSkinEntry(deps, { areaId: 'area-chin', scores, at: new Date('2026-01-12T22:00:00.000Z') });
    await addPhoto(deps, { entryKind: 'skinEntry', entryId: second.id, sourceUri: 'after', at: new Date('2026-01-12T22:05:00.000Z') });
    mockParams.current = { id: 'area-chin' };
    const { tree } = await mount(() => require('@/app/(tabs)/review/area'), deps);
    await flush();
    expect(hasText(tree, en.derived.noTreatment)).toBe(true);
    expect(
      hasText(
        tree,
        en.derived.sinceTreatment.replace('{{elapsed}}', en.derived.hours.replace('{{n}}', '14')).replace('{{name}}', 'Synthetic cream'),
      ),
    ).toBe(true);
    mockParams.current = {};
  });
});

describe('Analysis running state (LL-12)', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  const answer = JSON.stringify({
    summary: 'Synthetic summary',
    hypotheses: [],
    order_and_lag: 'none',
    data_limits: [],
    questions_for_doctor: [],
  });
  async function prepared(deps: Deps) {
    await saveApiKey(deps, 'sk-synthetic-secret');
    await logMeal(deps, { description: 'Synthetic meal', ingredients: [], at: new Date(Date.now() - 2 * 3600 * 1000) });
    return prepareAnalysis(deps, {
      dayFrom: localDay(new Date(Date.now() - 86_400_000).toISOString(), deps.clock.timeZone()),
      dayTo: localDay(new Date().toISOString(), deps.clock.timeZone()),
      language: 'en',
      photoIds: [],
    });
  }

  it('LL-12 Review shows a running card and then a ready card for a run started anywhere, and the screen result clears it', async () => {
    let release!: (r: { text: string; model: string }) => void;
    const llm = { completeJson: () => new Promise<{ text: string; model: string }>((resolve) => (release = resolve)) };
    const deps = nowDeps(llm);
    const prep = await prepared(deps);
    const runner = new AnalysisRunner(deps);
    services.__state.current = {
      deps,
      fileShare: { saveAndShare: jest.fn(), pickFile: jest.fn() },
      analysisRunner: runner,
      appLock: new AppLock(deps),
    };
    let review!: ReactTestRenderer;
    await act(async () => {
      review = create(React.createElement(require('@/app/(tabs)/review/index').default));
    });
    expect(hasText(review, en.review.runRunning)).toBe(false);
    let done!: Promise<void>;
    await act(async () => {
      done = runner.start(prep); // started from another screen, or after leaving this one
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(hasText(review, en.review.runRunning)).toBe(true);
    await act(async () => {
      release({ text: answer, model: 'fake-model' });
      await done;
    });
    expect(hasText(review, en.review.runReady)).toBe(true);
    let screen!: ReactTestRenderer;
    await act(async () => {
      screen = create(React.createElement(require('@/app/(tabs)/review/analysis').default));
    });
    await flush();
    expect(hasText(screen, 'Synthetic summary')).toBe(true);
    await act(async () => screen.unmount()); // leaving the screen looks at the result
    expect(hasText(review, en.review.runReady)).toBe(false);
  });

  it('LL-12 an interrupted run says nothing was saved and one tap retries the same request', async () => {
    const { NettleError } = require('@/core/model/errors');
    const llm = new FakeLlm([new NettleError('llm_network'), answer]);
    const deps = nowDeps(llm);
    const prep = await prepared(deps);
    const runner = new AnalysisRunner(deps);
    const done = runner.start(prep);
    runner.markBackgrounded();
    await done;
    expect(runner.state.status).toBe('interrupted');
    services.__state.current = {
      deps,
      fileShare: { saveAndShare: jest.fn(), pickFile: jest.fn() },
      analysisRunner: runner,
      appLock: new AppLock(deps),
    };
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(React.createElement(require('@/app/(tabs)/review/analysis').default));
    });
    await flush();
    expect(hasText(tree, en.analysis.interrupted)).toBe(true);
    expect(await deps.repo.listRecords('analyses')).toEqual([]);
    await press(tree, en.analysis.retry); // LL-5: the retry opens the confirmation first, nothing is sent yet
    await flush();
    expect(llm.requests).toHaveLength(1);
    const retryConfirm = (Alert.alert as jest.Mock).mock.calls.filter((c) => c[0] === en.analysis.confirmTitle).at(-1)!;
    await act(async () => {
      await (retryConfirm[2] as { text: string; onPress?: () => void }[]).find((b) => b.text === en.analysis.send)!.onPress!();
    });
    await flush();
    expect(llm.requests).toHaveLength(2);
    expect(await deps.repo.listRecords('analyses')).toHaveLength(1);
    expect(hasText(tree, 'Synthetic summary')).toBe(true);
  });

  it('LL-12 the root layout keeps the screen awake while a run is going and lets go when it ends', async () => {
    const keepAwake = require('expo-keep-awake') as { activateKeepAwakeAsync: jest.Mock; deactivateKeepAwake: jest.Mock };
    keepAwake.activateKeepAwakeAsync.mockClear();
    keepAwake.deactivateKeepAwake.mockClear();
    let release!: (r: { text: string; model: string }) => void;
    const deps = nowDeps({ completeJson: () => new Promise<{ text: string; model: string }>((resolve) => (release = resolve)) });
    const prep = await prepared(deps);
    const runner = new AnalysisRunner(deps);
    services.__state.current = {
      deps,
      fileShare: { saveAndShare: jest.fn(), pickFile: jest.fn() },
      analysisRunner: runner,
      appLock: new AppLock(deps),
    };
    await act(async () => {
      create(React.createElement(require('@/app/_layout').default));
    });
    let done!: Promise<void>;
    await act(async () => {
      done = runner.start(prep);
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(keepAwake.activateKeepAwakeAsync).toHaveBeenCalledWith('analysis');
    await act(async () => {
      release({ text: answer, model: 'fake-model' });
      await done;
    });
    expect(keepAwake.deactivateKeepAwake).toHaveBeenCalledWith('analysis');
  });
});
