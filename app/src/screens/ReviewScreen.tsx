import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Text } from '@/ui/themed';
import { addMonths, monthOf, monthOverview, monthShape, type MonthDay } from '@/core/usecases/dayLog';
import { localDay } from '@/core/model/time';
import { areaOverview, type AreaOverviewRow } from '@/core/usecases/timeline';
import { areaLabel, errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { useNow } from '@/ui/useNow';
import { GearButton } from '@/ui/GearButton';
import { GlassSurface } from '@/ui/GlassSurface';
import type { IconName } from '@/ui/Icon';
import { IconCircle } from '@/ui/IconCircle';
import { NavGroup } from '@/ui/NavGroup';
import { NavRow } from '@/ui/NavRow';
import { Rise } from '@/ui/Rise';
import { color } from '@/ui/theme';
import { useAnalysisRun } from '@/ui/useAnalysisRun';
import { Heading, Hint, Label, Screen, Segmented, styles } from '@/ui/components';
import { formatElapsed, runCardStatus } from '@/core/usecases/analysisRunner';
import { SwitchRow } from '@/ui/SwitchRow';
import { EmptyState } from '@/ui/EmptyState';

const WEEKDAY_KEYS = [2, 3, 4, 5, 6, 7, 1]; // Monday first; the names are in reminders.weekdays (1 = Sunday)

/** UX-10: the month calendar: a mark for entries, for a Daily health record and for flare days, so colour is never the only cue. */
function Calendar({ month, days, onOpen }: { month: string; days: MonthDay[]; onOpen: (day: string) => void }) {
  const { firstWeekday } = monthShape(month);
  const cells: (MonthDay | null)[] = [...Array.from({ length: firstWeekday }, () => null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);
  const rows = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  return (
    <GlassSurface style={{ borderRadius: 28, padding: 12, gap: 4 }}>
      <View style={{ flexDirection: 'row' }}>
        {WEEKDAY_KEYS.map((d) => (
          <Text key={d} style={[styles.hint, { flex: 1, textAlign: 'center' }]}>
            {t(`reminders.weekdays.${d}`)}
          </Text>
        ))}
      </View>
      {rows.map((row, i) => (
        <View key={i} style={{ flexDirection: 'row' }}>
          {row.map((c, j) =>
            c ? (
              <Pressable
                key={c.day}
                accessibilityRole="button"
                accessibilityLabel={t('review.calendarDay', { day: c.day, n: c.entries, health: c.dailyHealth ? t('review.yes') : t('review.no'), flare: c.flare ? t('review.yes') : t('review.no') })}
                onPress={() => onOpen(c.day)}
                style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: c.flare ? color.alertSoft : 'transparent', borderWidth: c.dailyHealth ? 1.5 : 0, borderColor: color.accentLine }}>
                <Text style={[styles.rowText, { fontSize: 15 }]}>{Number(c.day.slice(8))}</Text>
                <Text style={[styles.hint, { fontSize: 11, color: c.flare ? color.alert : color.muted }]}>{`${c.entries > 0 ? '•' : ''}${c.dailyHealth ? '✓' : ''}${c.flare ? '▲' : ''}` || ' '}</Text>
              </Pressable>
            ) : (
              <View key={`e${j}`} style={{ flex: 1 }} />
            ),
          )}
        </View>
      ))}
      <Hint>{t('review.calendarLegend')}</Hint>
    </GlassSurface>
  );
}

/** UX-12: an output card: an icon circle, a title and a status line (the Doctor report, the AI analysis). */
function OutputCard({ icon, title, status, running = false, onPress }: { icon: IconName; title: string; status?: string; running?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={{ flex: 1 }}>
      <GlassSurface style={{ borderRadius: 26, padding: 14, gap: 10, minHeight: 112, ...(status ? { borderColor: color.accentLine } : {}) }}>
        <IconCircle name={icon} size={40} />
        <View>
          <Text style={{ fontSize: 16, fontWeight: '700' }}>{title}</Text>
          {status ? <Text style={{ fontSize: 13, color: color.accent }}>{running ? '● ' : ''}{status}</Text> : null}
        </View>
      </GlassSurface>
    </Pressable>
  );
}

const areaLine = (a: AreaOverviewRow): string => {
  if (!a.lastDay) return t('review.areaNone');
  const what = a.area.kind === 'nail' ? `${t(`nail.stages.${a.stage}`)}, ${t(`nail.extents.${a.extent}`)}` : t('review.areaSeverity', { n: a.severity ?? 0 });
  return `${what} · ${a.lastDay}${a.flaring ? ` · ${t('review.areaFlaring')}` : ''}`;
};

/**
 * UX-1, UX-10: the second tab: the Doctor report and the AI analysis, then Days or Areas. Days is one month at a
 * time with a calendar grid and the month's days; Areas lists skin areas and nails with their last score or stage.
 */
export default function ReviewScreen() {
  const { deps } = useServices();
  const router = useRouter();
  const run = useAnalysisRun();
  // LL-12: the elapsed time on the analysis card ticks once a second while a run is going.
  const [tick, setTick] = useState(() => deps.clock.now().getTime());
  useEffect(() => {
    if (run.status !== 'running') return;
    const id = setInterval(() => setTick(deps.clock.now().getTime()), 1000);
    (id as { unref?: () => void }).unref?.();
    return () => clearInterval(id);
  }, [run.status, deps]);
  const cardStatus = runCardStatus(run, Math.max(tick, run.status === 'running' ? run.startedAt : 0));
  const { view: viewParam, month: monthParam } = useLocalSearchParams<{ view?: string; month?: string }>();
  const [pick, setPick] = useState<'days' | 'areas' | null>(null);
  const view = pick ?? (viewParam === 'areas' ? 'areas' : 'days');
  const now = useNow(deps); // NF-7: a mounted tab still moves on to the new month
  const currentMonth = monthOf(localDay(now.toISOString(), deps.clock.timeZone(), deps.dayStart.get()));
  const [month, setMonth] = useState(typeof monthParam === 'string' && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentMonth);
  const [picking, setPicking] = useState(false);
  const [incompleteOnly, setIncompleteOnly] = useState(false);
  const [days, setDays] = useState<MonthDay[]>([]);
  const [areas, setAreas] = useState<{ skin: AreaOverviewRow[]; nails: AreaOverviewRow[] }>({ skin: [], nails: [] });

  const load = useCallback(() => {
    monthOverview(deps, month).then(setDays).catch((e) => Alert.alert(errorMessage(e)));
    areaOverview(deps).then(setAreas).catch(() => setAreas({ skin: [], nails: [] }));
  }, [deps, month]);
  useFocusEffect(load);

  const open = (day: string) => router.navigate({ pathname: '/review/day', params: { day } });
  const listed = days.filter((d) => d.entries > 0 && (!incompleteOnly || !d.dailyHealth)).sort((a, b) => b.day.localeCompare(a.day));
  const areaRows = (rows: AreaOverviewRow[]) =>
    rows.map((a) => <NavRow key={a.area.id} title={areaLabel(a.area)} subtitle={areaLine(a)} onPress={() => router.push({ pathname: '/review/area', params: { id: a.area.id } })} />);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 34, fontWeight: '800', letterSpacing: -1 }}>{t('tabs.review')}</Text>
        <GearButton />
      </View>
      <Rise order={0} style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <OutputCard icon="report" title={t('review.report')} onPress={() => router.push('/review/report')} />
          {/* LL-12: a running or finished analysis shows here, whichever screen it was started from. */}
          <OutputCard
            icon="sparkle"
            title={t('review.analysis')}
            running={run.status === 'running'}
            status={cardStatus ? `${t(cardStatus.state === 'running' ? 'review.runRunning' : cardStatus.state === 'ready' ? 'review.runReady' : cardStatus.state === 'interrupted' ? 'review.runInterrupted' : 'review.runFailed')}${cardStatus.state === 'running' ? ` ${formatElapsed(cardStatus.seconds)}` : ''}` : undefined}
            onPress={() => router.push('/review/analysis')}
          />
        </View>
        <NavGroup>
          <NavRow icon="health" title={t('review.healthTitle')} onPress={() => router.push('/review/health')} />
        </NavGroup>
      </Rise>

      <Segmented
        items={[
          { id: 'days', label: t('review.days') },
          { id: 'areas', label: t('review.areas') },
        ]}
        value={view}
        onChange={(id) => setPick(id as 'days' | 'areas')}
      />

      {view === 'areas' ? (
        <>
          <Label>{t('review.skinGroup')}</Label>
          {areas.skin.length === 0 ? <Hint>{t('review.noAreas')}</Hint> : <NavGroup>{areaRows(areas.skin)}</NavGroup>}
          <Label>{t('review.nailsGroup')}</Label>
          {areas.nails.length === 0 ? <Hint>{t('review.noNails')}</Hint> : <NavGroup>{areaRows(areas.nails)}</NavGroup>}
        </>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('review.prevMonth')} onPress={() => setMonth(addMonths(month, -1))} hitSlop={12}>
              <Text style={styles.heading}>‹</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t('review.jumpMonth')} onPress={() => setPicking((p) => !p)} hitSlop={8}>
              <Heading>{month}</Heading>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t('review.nextMonth')} onPress={() => month < currentMonth && setMonth(addMonths(month, 1))} hitSlop={12}>
              <Text style={[styles.heading, month >= currentMonth && { opacity: 0.3 }]}>›</Text>
            </Pressable>
          </View>
          {picking && (
            <DateTimePicker
              mode="date"
              display="inline"
              value={new Date(`${month}-15T12:00:00`)}
              maximumDate={now}
              onValueChange={(_e, d) => {
                setMonth(monthOf(localDay(d.toISOString(), deps.clock.timeZone())));
                setPicking(false);
              }}
            />
          )}
          <Calendar month={month} days={days} onOpen={open} />
          <SwitchRow title={t('review.incomplete')} value={incompleteOnly} onChange={setIncompleteOnly} />
          {incompleteOnly && <Hint>{t('review.incompleteHint')}</Hint>}
          {listed.length === 0 && incompleteOnly && <Hint>{t('review.noIncomplete')}</Hint>}
          {listed.length === 0 && !incompleteOnly && (
            // UX-1: an empty state is a short title, one sentence and at most one primary button.
            <EmptyState title={t('review.noDays')} body={t('review.empty')} action={days.every((d) => d.entries === 0) ? t('review.goToday') : undefined} onAction={() => router.navigate('/today')} />
          )}
          {listed.length > 0 && (
            <NavGroup>
              {listed.map((d) => (
                <NavRow
                  key={d.day}
                  title={`${t('review.dayRow', { day: d.day, n: d.entries })}${d.dailyHealth ? `, ${t('review.dayComplete')}` : ''}`}
                  onPress={() => open(d.day)}
                />
              ))}
            </NavGroup>
          )}
        </>
      )}
    </Screen>
  );
}
