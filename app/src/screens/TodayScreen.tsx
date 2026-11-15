import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, Text, View } from 'react-native';
import { addDays, atOnDay, localDay } from '@/core/model/time';
import type { ListItem, SkinArea } from '@/core/model/types';
import { backupCardDue, daysSinceExport } from '@/core/usecases/backup';
import { logStool } from '@/core/usecases/checkin';
import { dayLog, dayStatus, treatmentShortcuts, type DayStatus, type LogRow, type TreatmentShortcut } from '@/core/usecases/dayLog';
import { applyTreatment } from '@/core/usecases/events';
import { openFlareSummary, type OpenFlare } from '@/core/usecases/flares';
import { defaultPreferences, type EntryType } from '@/core/model/preferences';
import { getPreferences, movePinnedEntryType, pinEntryType, unpinEntryType, unpinnedEntryTypes } from '@/core/usecases/preferences';
import { areaLabel, errorMessage, itemLabel, t } from '@/i18n';
import { useServices } from '@/services';
import { DayLog, TODAY_LOG_LIMIT } from '@/ui/DayLog';
import { ENTRY_ROUTE, entrySubtitle, entryTitle } from '@/ui/entryTypes';
import { Button, Heading, Hint, Label, Screen, styles } from '@/ui/components';

/** UX-2: how long a new row stays highlighted. */
export const HIGHLIGHT_MS = 3000;

/** IN-11: a shortcut chip is disabled this long after a tap so a double tap cannot log twice. */
const SHORTCUT_LOCK_MS = 3000;

/** A "YYYY-MM-DD" route parameter, or null. */
const validDay = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

const Card = ({ children }: { children: React.ReactNode }) => (
  <View style={{ borderWidth: 1, borderColor: '#9993', borderRadius: 10, padding: 12, gap: 8 }}>{children}</View>
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
  const { day: dayParam } = useLocalSearchParams<{ day?: string }>();
  // A day picked on this screen wins until the route parameter (from the Review days list) changes again.
  const [pick, setPick] = useState<{ param: string | undefined; day: string | null } | null>(null);
  const chosen = pick && pick.param === dayParam ? pick.day : validDay(dayParam);
  const setChosen = (d: string | null) => setPick({ param: dayParam, day: d });
  const [rows, setRows] = useState<LogRow[]>([]);
  const [ctx, setCtx] = useState<{ areas: SkinArea[]; treatments: ListItem[] }>({ areas: [], treatments: [] });
  const [status, setStatus] = useState<DayStatus | null>(null);
  const [shortcuts, setShortcuts] = useState<TreatmentShortcut[]>([]);
  const [flare, setFlare] = useState<OpenFlare | null>(null);
  const [backup, setBackup] = useState<{ due: boolean; days: number | null }>({ due: false, days: null });
  const [stoolOpen, setStoolOpen] = useState(false);
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
      setCtx({ areas: await deps.repo.listAreas(), treatments: await deps.repo.listItems('treatments') });
      setStatus(await dayStatus(deps, day));
      setShortcuts(await treatmentShortcuts(deps));
      setFlare(await openFlareSummary(deps));
      setBackup({ due: await backupCardDue(deps), days: await daysSinceExport(deps) });
      setLayout((await getPreferences(deps)).quickActions);
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
    router.push(isToday ? ENTRY_ROUTE[id] : { pathname: ENTRY_ROUTE[id], params: { day } });
  };

  const areaName = (id: string) => {
    const a = ctx.areas.find((x) => x.id === id);
    return a ? areaLabel(a) : id;
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('day.previous')} onPress={() => moveDay(-1)} hitSlop={12}>
          <Text style={styles.heading}>‹</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('day.jump')} onPress={() => setPicking((p) => !p)} hitSlop={8}>
          <Heading>{isToday ? `${t('day.today')}, ${day}` : day}</Heading>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('day.next')} onPress={() => moveDay(1)} hitSlop={12} disabled={isToday}>
          <Text style={[styles.heading, isToday && { opacity: 0.3 }]}>›</Text>
        </Pressable>
      </View>
      {picking && (
        // UX-2: jump to any past day; a picked date is a calendar day, and a day in the future is never chosen.
        <DateTimePicker
          mode="date"
          display="inline"
          value={new Date(`${day}T12:00:00`)}
          maximumDate={now}
          onValueChange={(_e, d) => {
            const picked = localDay(d.toISOString(), deps.clock.timeZone());
            setChosen(picked >= today ? null : picked);
            setPicking(false);
          }}
        />
      )}
      {!isToday && <Button kind="secondary" title={t('day.today')} onPress={() => setChosen(null)} />}

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
              <Button kind="secondary" title={t('home.pin')} accessibilityLabel={`${t('home.pin')} ${entryTitle(id)}`} onPress={() => void run(async () => setLayoutPinned(await pinEntryType(deps, id)))} />
            </View>
          ))}
        </View>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[...layout.pinned, 'more' as const].map((id) => (
            <View key={id} style={{ flexBasis: '31%', flexGrow: 1 }}>
              <Button
                kind="secondary"
                title={id === 'more' ? t('home.more') : entryTitle(id)}
                onPress={id === 'more' ? () => router.push('/today/more') : open(id)}
              />
            </View>
          ))}
        </View>
      )}

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

      {isToday && flare && (
        <Card>
          <Text style={styles.rowText}>
            {flare.areas.length === 1
              ? t('cards.openFlareOne', { area: areaName(flare.areas[0]!.areaId), severity: flare.areas[0]!.severity, since: localDay(flare.period.start.utc, flare.period.start.tz, deps.dayStart.get()) })
              : t('cards.openFlareMany', { n: flare.period.areaIds.length, area: areaName(flare.areas[0]!.areaId) })}
          </Text>
          <Button kind="secondary" title={t('cards.openAreas')} onPress={() => router.navigate('/review')} />
        </Card>
      )}
      {status && !status.checkIn && day <= today && (
        <Card>
          <Text style={styles.rowText}>{t('cards.notLogged')}</Text>
          <Button kind="secondary" title={t('cards.openCheckin')} onPress={() => router.push('/form/checkin')} />
        </Card>
      )}
      {backup.due && (
        <Card>
          <Text style={styles.rowText}>{backup.days === null ? t('cards.noExport') : t('cards.lastExport', { days: backup.days })}</Text>
          <Button kind="secondary" title={t('cards.openBackup')} onPress={() => router.push('/settings/data')} />
        </Card>
      )}

      <DayLog rows={rows} ctx={ctx} onChanged={load} limit={TODAY_LOG_LIMIT} highlight={highlight} onShowAll={() => router.navigate({ pathname: '/review/day', params: { day } })} />
    </Screen>
  );
}
