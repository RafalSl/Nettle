import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { addDays, atOnDay, localDateTime, localDay } from '@/core/model/time';
import type { ListItem, SkinArea } from '@/core/model/types';
import { backupCardDue, daysSinceExport } from '@/core/usecases/backup';
import { logStool, setDayComplete } from '@/core/usecases/checkin';
import { dayLog, dayStatus, treatmentShortcuts, type DayStatus, type LogRow, type TreatmentShortcut } from '@/core/usecases/dayLog';
import { deleteEntry, previewEntryDelete } from '@/core/usecases/entries';
import { applyTreatment } from '@/core/usecases/events';
import { markFlare, openFlareAreas } from '@/core/usecases/flares';
import { defaultPreferences, type QuickAction } from '@/core/model/preferences';
import { getPreferences, moveQuickAction, setQuickActionHidden, visibleQuickActions } from '@/core/usecases/preferences';
import { areaLabel, errorMessage, itemLabel, t } from '@/i18n';
import { useServices } from '@/services';
import { chooseAction } from '@/ui/actionSheet';
import { describeRow } from '@/ui/logRow';
import { Button, Heading, Hint, Label, Screen, styles } from '@/ui/components';

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
  const [flares, setFlares] = useState<string[]>([]);
  const [backup, setBackup] = useState<{ due: boolean; days: number | null }>({ due: false, days: null });
  const [stoolOpen, setStoolOpen] = useState(false);
  const [layout, setLayout] = useState(defaultPreferences().quickActions);
  const [editing, setEditing] = useState(false);
  const [locked, setLocked] = useState<Set<string>>(new Set());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // After midnight an unchosen day moves on by itself: `today` is read again on every render and focus.
  const now = deps.clock.now();
  const today = localDay(now.toISOString(), deps.clock.timeZone());
  const day = chosen && chosen < today ? chosen : today; // a chosen day is never in the future
  const isToday = day === today;
  const atNow = () => atOnDay(day, deps.clock.now(), deps.clock.timeZone());

  const load = useCallback(() => {
    (async () => {
      setRows(await dayLog(deps, day));
      setCtx({ areas: await deps.repo.listAreas(), treatments: await deps.repo.listItems('treatments') });
      setStatus(await dayStatus(deps, day));
      setShortcuts(await treatmentShortcuts(deps));
      setFlares([...(await openFlareAreas(deps))]);
      setBackup({ due: await backupCardDue(deps), days: await daysSinceExport(deps) });
      setLayout((await getPreferences(deps)).quickActions);
    })().catch((e) => Alert.alert(errorMessage(e)));
  }, [deps, day]);
  useFocusEffect(load);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

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

  const setLayoutOrder = (order: QuickAction[]) => setLayout((l) => ({ ...l, order }));
  const actions: Record<QuickAction, { title: string; onPress: () => void }> = {
    meal: { title: t('home.meal'), onPress: () => router.push(isToday ? '/form/meal' : { pathname: '/form/meal', params: { day } }) },
    skin: { title: t('home.skin'), onPress: () => router.push('/form/skin') },
    treatment: { title: t('home.treatment'), onPress: () => router.push('/form/treatment') },
    checkin: { title: t('home.checkin'), onPress: () => router.push('/form/checkin') },
    stool: { title: t('day.stool'), onPress: () => setStoolOpen((o) => !o) },
    more: { title: t('home.more'), onPress: () => router.push('/today/more') },
  };

  const areaName = (id: string) => {
    const a = ctx.areas.find((x) => x.id === id);
    return a ? areaLabel(a) : id;
  };

  async function onRow(row: LogRow) {
    try {
      const also = await previewEntryDelete(deps, row.kind, row.id);
      const list = Object.entries(also)
        .map(([kind, n]) => `${n} ${t(`log.kinds.${kind}`)}`)
        .join(', ');
      const { title } = describeRow(row, ctx);
      // EN-1, UX-9: Edit or Delete in one sheet; the delete names what goes with the entry.
      const choice = await chooseAction({
        title,
        message: list ? t('log.also', { list }) : undefined,
        actions: [{ label: t('log.editAction') }, { label: t('log.deleteAction'), destructive: true }],
      });
      if (choice === 0) router.push({ pathname: '/form/edit', params: { kind: row.kind, id: row.id } });
      else if (choice === 1) await run(() => deleteEntry(deps, row.kind, row.id));
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('day.previous')} onPress={() => moveDay(-1)} hitSlop={12}>
          <Text style={styles.heading}>‹</Text>
        </Pressable>
        <Heading>{isToday ? `${t('day.today')}, ${day}` : day}</Heading>
        <Pressable accessibilityRole="button" accessibilityLabel={t('day.next')} onPress={() => moveDay(1)} hitSlop={12} disabled={isToday}>
          <Text style={[styles.heading, isToday && { opacity: 0.3 }]}>›</Text>
        </Pressable>
      </View>
      {!isToday && <Button kind="secondary" title={t('day.today')} onPress={() => setChosen(null)} />}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Label>{t('home.quickActions')}</Label>
        <Button kind="secondary" title={editing ? t('home.done') : t('home.edit')} onPress={() => setEditing((e) => !e)} />
      </View>
      {editing ? (
        // UX-2: reorder and hide with buttons, never by dragging.
        <View style={{ gap: 4 }}>
          {layout.order.map((id) => {
            const hidden = layout.hidden.includes(id);
            return (
              <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, opacity: hidden ? 0.5 : 1 }}>
                <Text style={[styles.rowText, { flex: 1 }]}>{actions[id].title}</Text>
                <Button kind="secondary" title="▲" accessibilityLabel={`${t('home.moveUp')} ${actions[id].title}`} onPress={() => void run(async () => setLayoutOrder(await moveQuickAction(deps, id, -1)))} />
                <Button kind="secondary" title="▼" accessibilityLabel={`${t('home.moveDown')} ${actions[id].title}`} onPress={() => void run(async () => setLayoutOrder(await moveQuickAction(deps, id, 1)))} />
                {id !== 'more' && (
                  <Button
                    kind="secondary"
                    title={hidden ? t('home.show') : t('home.hide')}
                    accessibilityLabel={`${hidden ? t('home.show') : t('home.hide')} ${actions[id].title}`}
                    onPress={() => void run(() => setQuickActionHidden(deps, id, !hidden))}
                  />
                )}
              </View>
            );
          })}
        </View>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {visibleQuickActions({ ...defaultPreferences(), quickActions: layout }).map((id) => (
            <View key={id} style={{ flexBasis: '31%', flexGrow: 1 }}>
              <Button kind="secondary" title={actions[id].title} onPress={actions[id].onPress} />
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
          <Button kind="secondary" title={t('day.stoolEarlier')} onPress={() => router.push('/form/checkin')} />
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

      {isToday &&
        flares.map((areaId) => (
          <Card key={areaId}>
            <Text style={styles.rowText}>{t('cards.openFlare', { area: areaName(areaId) })}</Text>
            <Button kind="secondary" title={t('cards.endFlare')} onPress={() => void run(() => markFlare(deps, { areaId, kind: 'end', at: atNow() }))} />
          </Card>
        ))}
      {status && day <= today && (
        <Card>
          {status.complete ? (
            <>
              <Text style={styles.rowText}>{t('cards.complete')}</Text>
              <Button kind="secondary" title={t('cards.reopen')} onPress={() => void run(() => setDayComplete(deps, day, false))} />
            </>
          ) : (
            <>
              <Text style={styles.rowText}>{t('cards.notComplete')}</Text>
              <Button kind="secondary" title={t('cards.openCheckin')} onPress={() => router.push('/form/checkin')} />
            </>
          )}
        </Card>
      )}
      {backup.due && (
        <Card>
          <Text style={styles.rowText}>{backup.days === null ? t('cards.noExport') : t('cards.lastExport', { days: backup.days })}</Text>
          <Button kind="secondary" title={t('cards.openBackup')} onPress={() => router.push('/today/settings/data')} />
        </Card>
      )}

      <Heading>{t('day.logTitle')}</Heading>
      {rows.length === 0 && <Hint>{t('day.empty')}</Hint>}
      {rows.map((row) => {
        const { title, detail } = describeRow(row, ctx);
        const time = localDateTime(row.at.utc, row.at.tz).slice(11);
        return (
          <Pressable
            key={`${row.kind}-${row.id}`}
            accessibilityRole="button"
            accessibilityLabel={`${time} ${title}`}
            onPress={() => void onRow(row)}
            style={({ pressed }) => [{ paddingVertical: 8 }, pressed && { opacity: 0.6 }]}>
            <Text style={styles.rowText}>{`${time}  ${title}`}</Text>
            {detail ? <Hint>{detail}</Hint> : null}
          </Pressable>
        );
      })}
    </Screen>
  );
}
