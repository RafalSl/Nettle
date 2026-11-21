import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, View } from 'react-native';
import { Text } from '@/ui/themed';
import { addDays, atOnDay, localDay } from '@/core/model/time';
import type { ListItem, SkinArea } from '@/core/model/types';
import { logStool } from '@/core/usecases/checkin';
import { dayLog, treatmentShortcuts, type LogRow, type TreatmentShortcut } from '@/core/usecases/dayLog';
import { applyTreatment } from '@/core/usecases/events';
import { defaultPreferences, MAX_PINNED, type EntryType, type RegularItem } from '@/core/model/preferences';
import { logRegular } from '@/core/usecases/regular';
import { getPreferences, movePinnedEntryType, pinEntryType, unpinEntryType, unpinnedEntryTypes } from '@/core/usecases/preferences';
import { arcPosition, ringDots, type RingDot } from '@/core/model/ring';
import { todayContext, type TodayContext } from '@/core/usecases/today';
import { areaLabel, dayParts, errorMessage, itemLabel, t } from '@/i18n';
import { useServices } from '@/services';
import { DayLog, TODAY_LOG_LIMIT } from '@/ui/DayLog';
import { ENTRY_ROUTE, entrySubtitle, entryTitle } from '@/ui/entryTypes';
import { Button, Hint, Label, Screen, styles } from '@/ui/components';
import { chooseAction } from '@/ui/actionSheet';
import { ContextPills } from '@/ui/ContextPills';
import { DayRing } from '@/ui/DayRing';
import { GearButton } from '@/ui/GearButton';
import { GlassSurface } from '@/ui/GlassSurface';
import { describeRow } from '@/ui/logRow';
import { QuickActions } from '@/ui/QuickActions';
import { Rise } from '@/ui/Rise';
import { useEntryActions } from '@/ui/useEntryActions';

/** UX-2: how long a new row stays highlighted. */
export const HIGHLIGHT_MS = 3000;

/** IN-11: a shortcut chip is disabled this long after a tap so a double tap cannot log twice. */
const SHORTCUT_LOCK_MS = 3000;

/** A "YYYY-MM-DD" route parameter, or null. */
const validDay = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

const Card = ({ children }: { children: React.ReactNode }) => <GlassSurface style={{ borderRadius: 26, padding: 16, gap: 10 }}>{children}</GlassSurface>;

/**
 * UX-2: the start screen. A day switcher, quick actions (each opens a modal form), one-tap treatment shortcuts,
 * a stool quick sheet, context cards and the day's log; tapping a log row offers Edit and Delete in an action sheet
 * that names what goes with the entry (EN-1, UX-9) or opens it for editing. The highlight of a new row,
 * reordering the quick actions and the date jump are not built yet.
 */
export default function TodayScreen() {
  const { deps } = useServices();
  const router = useRouter();
  const { day: dayParam, sheet: sheetParam } = useLocalSearchParams<{ day?: string; sheet?: string }>();
  // A day picked on this screen wins until the route parameter (from the Review days list) changes again.
  const [pick, setPick] = useState<{ param: string | undefined; day: string | null } | null>(null);
  const chosen = pick && pick.param === dayParam ? pick.day : validDay(dayParam);
  const setChosen = (d: string | null) => setPick({ param: dayParam, day: d });
  const [rows, setRows] = useState<LogRow[]>([]);
  const [ctx, setCtx] = useState<{ areas: SkinArea[]; treatments: ListItem[]; categories: ListItem[] }>({ areas: [], treatments: [], categories: [] });
  const [shortcuts, setShortcuts] = useState<TreatmentShortcut[]>([]);
  const [context, setContext] = useState<TodayContext>({ isToday: true, firstRun: false, pills: [] });
  const [stoolOpen, setStoolOpen] = useState(false);
  const [regular, setRegular] = useState<RegularItem[]>([]);
  /** IN-17: the quick sheet of regular items that is open, if any. */
  const [sheetPick, setSheet] = useState<'medication' | 'treatment' | null | undefined>(undefined);
  // SK-9: a tap on a regular item's reminder opens Today with its quick sheet (until the user opens or closes one).
  const fromParam = sheetParam === 'medication' || sheetParam === 'treatment' ? (regular.some((r) => r.kind === sheetParam) ? sheetParam : null) : null;
  const sheet = sheetPick === undefined ? fromParam : sheetPick;
  const [highlight, setHighlight] = useState<Set<string>>(new Set());
  const seenIds = useRef<{ day: string; ids: Set<string>; loaded: boolean }>({ day: '', ids: new Set(), loaded: false });
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [picking, setPicking] = useState(false);
  const [layout, setLayout] = useState(defaultPreferences().quickActions);
  const [editing, setEditing] = useState(false);
  const [locked, setLocked] = useState<Set<string>>(new Set());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // After midnight an unchosen day moves on by itself. The clock is state, not a call in the render body: with the
  // React Compiler a `deps.clock.now()` there is cached and the screen would keep yesterday until it is reloaded.
  // It is read again on focus, when the app comes back to the foreground and every minute.
  const [now, setNow] = useState(() => deps.clock.now());
  const refreshNow = useCallback(() => setNow(deps.clock.now()), [deps]);
  useFocusEffect(refreshNow);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => state === 'active' && refreshNow());
    const timer = setInterval(refreshNow, 60_000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [refreshNow]);
  const today = localDay(now.toISOString(), deps.clock.timeZone(), deps.dayStart.get());
  const day = chosen && chosen < today ? chosen : today; // a chosen day is never in the future
  const isToday = day === today;
  const atNow = () => atOnDay(day, deps.clock.now(), deps.clock.timeZone(), deps.dayStart.get());

  const load = useCallback(() => {
    (async () => {
      const next = await dayLog(deps, day);
      // UX-2: an entry that appeared since the last look (a form just saved it) is highlighted for a moment.
      // The first load of a day highlights nothing.
      const seen = seenIds.current;
      if (seen.day === day && seen.loaded) {
        const fresh = next.filter((r) => !seen.ids.has(r.id)).map((r) => r.id);
        if (fresh.length > 0) {
          setHighlight(new Set(fresh));
          clearTimeout(highlightTimer.current);
          highlightTimer.current = setTimeout(() => setHighlight(new Set()), HIGHLIGHT_MS);
          (highlightTimer.current as { unref?: () => void }).unref?.(); // never keeps a test or a process alive
        }
      }
      seenIds.current = { day, ids: new Set(next.map((r) => r.id)), loaded: true };
      setRows(next);
      setCtx({ areas: await deps.repo.listAreas(), treatments: await deps.repo.listItems('treatments'), categories: await deps.repo.listItems('changeCategories') });
      setShortcuts(await treatmentShortcuts(deps));
      setContext(await todayContext(deps, day));
      const prefs = await getPreferences(deps);
      setLayout(prefs.quickActions);
      setRegular(prefs.regular);
    })().catch((e) => Alert.alert(errorMessage(e)));
  }, [deps, day]);
  useFocusEffect(load);
  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    clearTimeout(highlightTimer.current);
  }, []);

  async function run(action: () => Promise<unknown>) {
    try {
      await action();
      load();
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }

  const moveDay = (n: number) => {
    const next = addDays(day, n);
    if (next && next <= today) setChosen(next === today ? null : next);
  };

  function lockShortcut(key: string) {
    setLocked((l) => new Set(l).add(key));
    timers.current.push(
      setTimeout(() => setLocked((l) => new Set([...l].filter((k) => k !== key))), SHORTCUT_LOCK_MS),
    );
  }

  const setLayoutPinned = (pinned: EntryType[]) => setLayout((l) => ({ ...l, pinned }));
  /** UX-2: a pinned tile opens its form; Stool opens its quick sheet while it is pinned (from More it opens the full form). */
  const open = (id: EntryType) => () => {
    if (id === 'stool') return setStoolOpen((o) => !o);
    // IN-17: Medication and Treatment open the quick sheet of regular items; without any they open the full form.
    if ((id === 'medication' || id === 'treatment') && regular.some((r) => r.kind === id)) return setSheet(sheet === id ? null : id);
    router.push(isToday ? ENTRY_ROUTE[id] : { pathname: ENTRY_ROUTE[id], params: { day } });
  };

  const regularLabel = (r: RegularItem) => {
    if (r.kind === 'medication') return r.dose ? `${r.name} ${r.dose}` : (r.name ?? '');
    const treatment = ctx.treatments.find((x) => x.id === r.treatmentId);
    return `${treatment ? itemLabel(treatment) : r.treatmentId}: ${r.areaIds.map(areaName).join(', ')}`;
  };

  const areaName = (id: string) => {
    const a = ctx.areas.find((x) => x.id === id);
    return a ? areaLabel(a) : id;
  };

  const openEntry = useEntryActions(load);
  const dots = ringDots(
    rows.map((r) => ({ id: r.id, kind: r.kind, at: r.at })),
    day,
    deps.clock.timeZone(),
    deps.dayStart.get(),
  );
  const arc = arcPosition(now, day, today, deps.clock.timeZone(), deps.dayStart.get());
  const parts = dayParts(day);
  /** UX-2: a dot opens its entry's Edit and Delete sheet; a merged dot first lists its entries. */
  async function onDot(dot: RingDot) {
    const found = dot.ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is LogRow => !!r);
    let row: LogRow | undefined = found[0];
    if (found.length > 1) {
      const picked = await chooseAction({ title: t('day.dot', { n: found.length }), actions: found.map((r) => ({ label: describeRow(r, ctx).title })) });
      row = picked === null ? undefined : found[picked];
    }
    if (row) await openEntry(row.kind, row.id, describeRow(row, ctx).title);
  }

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <GearButton />
      </View>
      <Rise order={0}>
        <DayRing
          dots={dots}
          arc={arc}
          startHour={deps.dayStart.get()}
          weekday={parts.weekday}
          date={parts.date}
          count={rows.length}
          canGoNext={!isToday}
          onPrevious={() => moveDay(-1)}
          onNext={() => moveDay(1)}
          onPickDate={() => setPicking((p) => !p)}
          onDot={(d) => void onDot(d)}
        />
      </Rise>
      {picking && (
        // UX-2: jump to any past day; a picked date is a calendar day, and a day in the future is never chosen.
        <DateTimePicker
          mode="date"
          display="inline"
          themeVariant="dark"
          value={new Date(`${day}T12:00:00`)}
          maximumDate={now}
          onValueChange={(_e, d) => {
            const picked = localDay(d.toISOString(), deps.clock.timeZone());
            setChosen(picked >= today ? null : picked);
            setPicking(false);
          }}
        />
      )}

      <Rise order={1} style={{ gap: 8 }}>
        {!isToday && <Button kind="outline" title={t('day.backToToday')} onPress={() => setChosen(null)} />}
        {context.firstRun && (
          // UX-1: an empty diary says where to start; no tour and no onboarding.
          <Card>
            <Text style={styles.rowText}>{t('cards.firstRun')}</Text>
            <Button title={t('cards.firstMeal')} onPress={() => router.push('/form/meal')} />
            <Button kind="secondary" title={t('nav.guide')} onPress={() => router.push('/guide')} />
          </Card>
        )}
        <ContextPills pills={context.pills} areaName={areaName} startHour={deps.dayStart.get()} />
      </Rise>

      <Rise order={2} style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Label>{t('home.quickActions')}</Label>
          <Button kind="secondary" title={editing ? t('home.done') : t('home.edit')} onPress={() => setEditing((e) => !e)} />
        </View>
        {editing ? (
          // UX-2: two lists, On Today and In More, with buttons to reorder and to move between them, never by dragging.
          <View style={{ gap: 4 }}>
            <Label>{t('home.pinned')}</Label>
            {layout.pinned.map((id) => (
              <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowText}>{entryTitle(id)}</Text>
                  <Text style={styles.hint}>{entrySubtitle(id)}</Text>
                </View>
                <Button kind="secondary" title="▲" accessibilityLabel={`${t('home.moveUp')} ${entryTitle(id)}`} onPress={() => void run(async () => setLayoutPinned(await movePinnedEntryType(deps, id, -1)))} />
                <Button kind="secondary" title="▼" accessibilityLabel={`${t('home.moveDown')} ${entryTitle(id)}`} onPress={() => void run(async () => setLayoutPinned(await movePinnedEntryType(deps, id, 1)))} />
                <Button kind="secondary" title={t('home.unpin')} accessibilityLabel={`${t('home.unpin')} ${entryTitle(id)}`} onPress={() => void run(async () => setLayoutPinned(await unpinEntryType(deps, id)))} />
              </View>
            ))}
            <Hint>{t('home.moreFixed')}</Hint>
            <Label>{t('home.inMore')}</Label>
            {unpinnedEntryTypes({ ...defaultPreferences(), quickActions: layout }).map((id) => (
              <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowText}>{entryTitle(id)}</Text>
                  <Text style={styles.hint}>{entrySubtitle(id)}</Text>
                </View>
                <Button kind="secondary" title={t('home.pin')} accessibilityLabel={`${t('home.pin')} ${entryTitle(id)}`} disabled={layout.pinned.length >= MAX_PINNED} onPress={() => void run(async () => setLayoutPinned(await pinEntryType(deps, id)))} />
              </View>
            ))}
          </View>
        ) : (
          <QuickActions
            pinned={layout.pinned}
            onOpen={(id) => open(id)()}
            onFull={(id) => router.push(isToday ? ENTRY_ROUTE[id] : { pathname: ENTRY_ROUTE[id], params: { day } })}
            onMore={() => router.push('/today/more')}
          />
        )}
      </Rise>

      {stoolOpen && (
        <Card>
          <Label>{t('day.stoolTitle')}</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <Button
                key={n}
                kind="secondary"
                title={String(n)}
                accessibilityLabel={t('day.stoolType', { n })}
                onPress={() => {
                  setStoolOpen(false);
                  void run(() => logStool(deps, { bristol: n, at: atNow() }));
                }}
              />
            ))}
          </View>
          <Button kind="secondary" title={t('day.stoolEarlier')} onPress={() => router.push(isToday ? '/form/stool' : { pathname: '/form/stool', params: { day } })} />
        </Card>
      )}

      {sheet && (
        // IN-17, UX-3: one tap logs one regular item at the current time; the row is locked for 3 seconds against a double tap.
        <Card>
          <Label>{t(sheet === 'medication' ? 'regular.sheetMedication' : 'regular.sheetTreatment')}</Label>
          {regular
            .filter((r) => r.kind === sheet)
            .map((r) => (
              <Button
                key={r.id}
                kind="secondary"
                title={regularLabel(r)}
                disabled={locked.has(r.id)}
                onPress={() => {
                  lockShortcut(r.id);
                  void run(() => logRegular(deps, r.id, atNow()));
                }}
              />
            ))}
          <Button kind="secondary" title={t('regular.other')} onPress={() => router.push(isToday ? ENTRY_ROUTE[sheet] : { pathname: ENTRY_ROUTE[sheet], params: { day } })} />
        </Card>
      )}

      {shortcuts.length > 0 && (
        <View style={{ gap: 8 }}>
          <Label>{t('day.shortcuts')}</Label>
          {shortcuts.map((s) => {
            const key = `${s.treatmentId}|${s.areaIds.join(',')}`;
            const treatment = ctx.treatments.find((x) => x.id === s.treatmentId);
            return (
              <Button
                key={key}
                title={`${treatment ? itemLabel(treatment) : s.treatmentId}: ${s.areaIds.map(areaName).join(', ')}`}
                disabled={locked.has(key)}
                onPress={() => {
                  lockShortcut(key);
                  void run(() => applyTreatment(deps, { treatmentId: s.treatmentId, areaIds: s.areaIds, at: atNow() }));
                }}
              />
            );
          })}
        </View>
      )}

      <Rise order={3} style={{ gap: 8 }}>
        <DayLog rows={rows} ctx={ctx} onChanged={load} limit={TODAY_LOG_LIMIT} highlight={highlight} onShowAll={() => router.navigate({ pathname: '/review/day', params: { day } })} />
      </Rise>
    </Screen>
  );
}
