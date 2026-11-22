import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Text } from '@/ui/themed';
import { addDays, atOnDay, localDateTime, localDay } from '@/core/model/time';
import type { ListItem, SkinArea } from '@/core/model/types';
import { logStool } from '@/core/usecases/checkin';
import { dayLog, treatmentShortcuts, type LogRow, type TreatmentShortcut } from '@/core/usecases/dayLog';
import { applyTreatment } from '@/core/usecases/events';
import { defaultPreferences, type EntryType, type RegularItem } from '@/core/model/preferences';
import { logRegular } from '@/core/usecases/regular';
import { getPreferences } from '@/core/usecases/preferences';
import { arcPosition, ringDots, type RingDot } from '@/core/model/ring';
import { todayContext, type TodayContext } from '@/core/usecases/today';
import { areaLabel, dayParts, errorMessage, itemLabel, t } from '@/i18n';
import { useServices } from '@/services';
import { useNow } from '@/ui/useNow';
import { DayLog, TODAY_LOG_LIMIT } from '@/ui/DayLog';
import { ENTRY_ROUTE } from '@/ui/entryTypes';
import { Button, Screen, styles } from '@/ui/components';
import { ENTRY_ICON, KIND_ENTRY } from '@/ui/entryIcons';
import { Icon } from '@/ui/Icon';
import { Sheet, SheetLabel, SheetRow } from '@/ui/Sheet';
import { color } from '@/ui/theme';
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

const Card = ({ children }: { children: React.ReactNode }) => (
  <GlassSurface style={{ borderRadius: 26, padding: 16, gap: 10 }}>{children}</GlassSurface>
);

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
  const [ctx, setCtx] = useState<{ areas: SkinArea[]; treatments: ListItem[]; categories: ListItem[] }>({
    areas: [],
    treatments: [],
    categories: [],
  });
  const [shortcuts, setShortcuts] = useState<TreatmentShortcut[]>([]);
  const [context, setContext] = useState<TodayContext>({ isToday: true, firstRun: false, pills: [] });
  const [stoolOpen, setStoolOpen] = useState(false);
  const [regular, setRegular] = useState<RegularItem[]>([]);
  /** IN-17: the quick sheet of regular items that is open, if any. */
  const [sheetPick, setSheet] = useState<'medication' | 'treatment' | null | undefined>(undefined);
  // SK-9: a tap on a regular item's reminder opens Today with its quick sheet (until the user opens or closes one).
  const fromParam =
    sheetParam === 'medication' || sheetParam === 'treatment' ? (regular.some((r) => r.kind === sheetParam) ? sheetParam : null) : null;
  const sheet = sheetPick === undefined ? fromParam : sheetPick;
  const [highlight, setHighlight] = useState<Set<string>>(new Set());
  const seenIds = useRef<{ day: string; ids: Set<string>; loaded: boolean }>({ day: '', ids: new Set(), loaded: false });
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [picking, setPicking] = useState(false);
  const [layout, setLayout] = useState(defaultPreferences().quickActions);
  const [locked, setLocked] = useState<Set<string>>(new Set());
  /** UX-3: what a quick sheet row did, shown on the row until the sheet closes: "Taken 08:05". */
  const [done, setDone] = useState<Record<string, string>>({});
  /** UX-2: the entries of a merged ring dot, listed in a sheet. */
  const [merged, setMerged] = useState<LogRow[] | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // After midnight an unchosen day moves on by itself: the clock is state (`useNow`), not a call in the render body.
  const now = useNow(deps);
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
      setCtx({
        areas: await deps.repo.listAreas(),
        treatments: await deps.repo.listItems('treatments'),
        categories: await deps.repo.listItems('changeCategories'),
      });
      setShortcuts(await treatmentShortcuts(deps));
      setContext(await todayContext(deps, day));
      const prefs = await getPreferences(deps);
      setLayout(prefs.quickActions);
      setRegular(prefs.regular);
    })().catch((e) => Alert.alert(errorMessage(e)));
  }, [deps, day]);
  useFocusEffect(load);
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      clearTimeout(highlightTimer.current);
    },
    [],
  );

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
    timers.current.push(setTimeout(() => setLocked((l) => new Set([...l].filter((k) => k !== key))), SHORTCUT_LOCK_MS));
  }

  /** UX-2: a pinned tile opens its form; Stool opens its quick sheet while it is pinned (from More it opens the full form). */
  const open = (id: EntryType) => () => {
    if (id === 'stool') return setStoolOpen((o) => !o);
    // IN-17: Medication and Treatment open the quick sheet of regular items; without any they open the full form.
    if ((id === 'medication' || id === 'treatment') && (regular.some((r) => r.kind === id) || (id === 'treatment' && shortcuts.length > 0)))
      return setSheet(sheet === id ? null : id);
    router.push(isToday ? ENTRY_ROUTE[id] : { pathname: ENTRY_ROUTE[id], params: { day } });
  };

  const regularLabel = (r: RegularItem) => {
    if (r.kind === 'medication') return r.dose ? `${r.name} ${r.dose}` : (r.name ?? '');
    const treatment = ctx.treatments.find((x) => x.id === r.treatmentId);
    return `${treatment ? itemLabel(treatment) : r.treatmentId}: ${r.areaIds.map(areaName).join(', ')}`;
  };

  /** UX-3: the second line of a regular item's row: its dose and reminder times. */
  const regularDetail = (r: RegularItem) => {
    const times = r.times.map((x) => `${String(x.hour).padStart(2, '0')}:${String(x.minute).padStart(2, '0')}`).join(', ');
    return (
      [r.kind === 'medication' ? r.dose : null, times ? t('sheet.reminderAt', { times }) : null].filter(Boolean).join(' · ') || undefined
    );
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
    if (found.length > 1) return setMerged(found);
    const row = found[0];
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
        <GlassSurface style={{ borderRadius: 28, padding: 8 }}>
          <DateTimePicker
            mode="date"
            display="inline"
            themeVariant="dark"
            accentColor={color.accent}
            value={new Date(`${day}T12:00:00`)}
            maximumDate={now}
            onValueChange={(_e, d) => {
              const picked = localDay(d.toISOString(), deps.clock.timeZone());
              setChosen(picked >= today ? null : picked);
              setPicking(false);
            }}
          />
        </GlassSurface>
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
        <QuickActions
          pinned={layout.pinned}
          onOpen={(id) => open(id)()}
          onFull={(id) => router.push(isToday ? ENTRY_ROUTE[id] : { pathname: ENTRY_ROUTE[id], params: { day } })}
          onMore={() => router.push('/today/more')}
        />
      </Rise>

      {merged && (
        // UX-2: a merged dot lists its entries first; a tap opens that entry's Edit and Delete sheet.
        <Sheet
          title={t('sheet.entriesTitle', { time: localDateTime(merged[0]!.at.utc, merged[0]!.at.tz).slice(11) })}
          onClose={() => setMerged(null)}
        >
          {merged.map((r) => (
            <SheetRow
              key={r.id}
              icon={ENTRY_ICON[KIND_ENTRY[r.kind]]}
              title={describeRow(r, ctx).title}
              detail={localDateTime(r.at.utc, r.at.tz).slice(11)}
              onPress={() => {
                setMerged(null);
                void openEntry(r.kind, r.id, describeRow(r, ctx).title);
              }}
            />
          ))}
        </Sheet>
      )}

      {stoolOpen && (
        // UX-3, NF-2: the seven Bristol types in two columns; a tap saves at once and the tile turns into "Saved 14:20".
        <Sheet
          title={t('day.stoolTitle')}
          subtitle={t('sheet.stoolHint')}
          onClose={() => {
            setStoolOpen(false);
            setDone({});
          }}
        >
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => {
              const saved = done[`stool-${n}`];
              return (
                <Pressable
                  key={n}
                  accessibilityRole="button"
                  accessibilityLabel={t('day.stoolType', { n })}
                  accessibilityState={{ disabled: !!saved }}
                  onPress={() => {
                    if (saved) return;
                    const at = atNow();
                    setDone((d) => ({ ...d, [`stool-${n}`]: localDateTime(at.toISOString(), deps.clock.timeZone()).slice(11) }));
                    void run(() => logStool(deps, { bristol: n, at }));
                  }}
                  style={{ width: '48.5%' }}
                >
                  <GlassSurface
                    raised
                    style={{
                      height: 52,
                      borderRadius: 999,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      paddingLeft: 6,
                      paddingRight: 12,
                      ...(saved ? { borderColor: color.accent, backgroundColor: color.accentSoft } : {}),
                    }}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: saved ? color.accent : color.glassFillRaised,
                      }}
                    >
                      <Text style={{ fontSize: 17, fontWeight: '800', color: saved ? color.onAccent : color.text }}>{n}</Text>
                    </View>
                    <Text style={{ flex: 1, fontSize: 14, fontWeight: saved ? '700' : '600' }} numberOfLines={1}>
                      {saved ? t('sheet.saved', { time: saved }) : t(`stoolTypes.${n}`)}
                    </Text>
                  </GlassSurface>
                </Pressable>
              );
            })}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('day.stoolEarlier')}
              onPress={() => {
                setStoolOpen(false);
                router.push(isToday ? '/form/stool' : { pathname: '/form/stool', params: { day } });
              }}
              style={{ width: '48.5%' }}
            >
              <GlassSurface
                raised
                style={{ height: 52, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <Icon name="clock" size={18} wash={false} />
                <Text style={{ fontSize: 14.5, fontWeight: '600' }}>{t('day.stoolEarlier')}</Text>
              </GlassSurface>
            </Pressable>
          </View>
        </Sheet>
      )}

      {sheet && (
        // IN-17, UX-3: one tap logs one regular item or one often-used treatment at the current time; the row is locked for 3 seconds against a double tap.
        <Sheet
          title={t(sheet === 'medication' ? 'regular.sheetMedication' : 'regular.sheetTreatment')}
          subtitle={t('sheet.logTapHint')}
          onClose={() => {
            setSheet(null);
            setDone({});
          }}
        >
          {regular.some((r) => r.kind === sheet) && sheet === 'treatment' ? <SheetLabel>{t('sheet.regular')}</SheetLabel> : null}
          {regular
            .filter((r) => r.kind === sheet)
            .map((r) => (
              <SheetRow
                key={r.id}
                icon={ENTRY_ICON[sheet]}
                title={regularLabel(r)}
                detail={
                  done[r.id] ? t(r.kind === 'medication' ? 'sheet.taken' : 'sheet.appliedAt', { time: done[r.id]! }) : regularDetail(r)
                }
                locked={locked.has(r.id)}
                onPress={() => {
                  lockShortcut(r.id);
                  const at = atNow();
                  setDone((d) => ({ ...d, [r.id]: localDateTime(at.toISOString(), deps.clock.timeZone()).slice(11) }));
                  void run(() => logRegular(deps, r.id, at));
                }}
              />
            ))}
          {sheet === 'treatment' && shortcuts.length > 0 ? <SheetLabel>{t('sheet.often')}</SheetLabel> : null}
          {sheet === 'treatment' &&
            shortcuts.map((sc) => {
              const key = `${sc.treatmentId}|${sc.areaIds.join(',')}`;
              const treatment = ctx.treatments.find((x) => x.id === sc.treatmentId);
              return (
                <SheetRow
                  key={key}
                  icon="treatment"
                  title={`${treatment ? itemLabel(treatment) : sc.treatmentId}: ${sc.areaIds.map(areaName).join(', ')}`}
                  detail={done[key] ? t('sheet.appliedAt', { time: done[key]! }) : undefined}
                  locked={locked.has(key)}
                  onPress={() => {
                    lockShortcut(key);
                    const at = atNow();
                    setDone((d) => ({ ...d, [key]: localDateTime(at.toISOString(), deps.clock.timeZone()).slice(11) }));
                    void run(() => applyTreatment(deps, { treatmentId: sc.treatmentId, areaIds: sc.areaIds, at }));
                  }}
                />
              );
            })}
          <SheetRow
            outline
            title={t('regular.other')}
            onPress={() => {
              setSheet(null);
              router.push(isToday ? ENTRY_ROUTE[sheet] : { pathname: ENTRY_ROUTE[sheet], params: { day } });
            }}
          />
        </Sheet>
      )}

      <Rise order={3} style={{ gap: 8 }}>
        <DayLog
          rows={rows}
          ctx={ctx}
          onChanged={load}
          limit={TODAY_LOG_LIMIT}
          highlight={highlight}
          onShowAll={() => router.navigate({ pathname: '/review/day', params: { day } })}
        />
      </Rise>
    </Screen>
  );
}
