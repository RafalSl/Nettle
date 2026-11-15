import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, Switch, Text, View } from 'react-native';
import { addMonths, monthOf, monthOverview, monthShape, type MonthDay } from '@/core/usecases/dayLog';
import { localDay } from '@/core/model/time';
import { areaOverview, type AreaOverviewRow } from '@/core/usecases/timeline';
import { areaLabel, errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { NavRow } from '@/ui/NavRow';
import { useAnalysisRun } from '@/ui/useAnalysisRun';
import { Heading, Hint, Label, Screen, Segmented, styles } from '@/ui/components';

const WEEKDAY_KEYS = [2, 3, 4, 5, 6, 7, 1]; // Monday first; the names are in reminders.weekdays (1 = Sunday)

/** UX-10: the month calendar: a mark for entries, for a Daily health record and for flare days, so colour is never the only cue. */
function Calendar({ month, days, onOpen }: { month: string; days: MonthDay[]; onOpen: (day: string) => void }) {
  const { firstWeekday } = monthShape(month);
  const cells: (MonthDay | null)[] = [...Array.from({ length: firstWeekday }, () => null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);
  const rows = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  return (
    <View style={{ gap: 4 }}>
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
                style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: c.entries > 0 ? 1 : 0, borderColor: '#9996', borderRadius: 6 }}>
                <Text style={styles.rowText}>{Number(c.day.slice(8))}</Text>
                <Text style={styles.hint}>{`${c.entries > 0 ? '•' : ''}${c.dailyHealth ? '✓' : ''}${c.flare ? '▲' : ''}` || ' '}</Text>
              </Pressable>
            ) : (
              <View key={`e${j}`} style={{ flex: 1 }} />
            ),
          )}
        </View>
      ))}
      <Hint>{t('review.calendarLegend')}</Hint>
    </View>
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
  const { view: viewParam, month: monthParam } = useLocalSearchParams<{ view?: string; month?: string }>();
  const [pick, setPick] = useState<'days' | 'areas' | null>(null);
  const view = pick ?? (viewParam === 'areas' ? 'areas' : 'days');
  const currentMonth = monthOf(localDay(deps.clock.now().toISOString(), deps.clock.timeZone(), deps.dayStart.get()));
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
      <NavRow title={t('review.report')} onPress={() => router.push('/review/report')} />
      {/* LL-12: a running or finished analysis shows here, whichever screen it was started from. */}
      {run.status !== 'idle' && run.status !== 'cancelled' && (
        <NavRow
          title={t(
            run.status === 'running' ? 'review.runRunning' : run.status === 'ready' ? 'review.runReady' : run.status === 'interrupted' ? 'review.runInterrupted' : 'review.runFailed',
          )}
          onPress={() => router.push('/review/analysis')}
        />
      )}
      <NavRow title={t('review.analysis')} onPress={() => router.push('/review/analysis')} />

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
          <Heading>{t('review.skinGroup')}</Heading>
          {areas.skin.length === 0 && <Hint>{t('review.noAreas')}</Hint>}
          {areaRows(areas.skin)}
          <Heading>{t('review.nailsGroup')}</Heading>
          {areas.nails.length === 0 && <Hint>{t('review.noNails')}</Hint>}
          {areaRows(areas.nails)}
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
              maximumDate={deps.clock.now()}
              onValueChange={(_e, d) => {
                setMonth(monthOf(localDay(d.toISOString(), deps.clock.timeZone())));
                setPicking(false);
              }}
            />
          )}
          <Calendar month={month} days={days} onOpen={open} />
          <View style={styles.timeRow}>
            <Label>{t('review.incomplete')}</Label>
            <Switch value={incompleteOnly} onValueChange={setIncompleteOnly} accessibilityLabel={t('review.incomplete')} />
          </View>
          {incompleteOnly && <Hint>{t('review.incompleteHint')}</Hint>}
          {listed.length === 0 && <Hint>{incompleteOnly ? t('review.noIncomplete') : `${t('review.noDays')} ${t('review.empty')}`}</Hint>}
          {listed.map((d) => (
            <NavRow
              key={d.day}
              title={`${t('review.dayRow', { day: d.day, n: d.entries })}${d.dailyHealth ? `, ${t('review.dayComplete')}` : ''}`}
              onPress={() => open(d.day)}
            />
          ))}
        </>
      )}
    </Screen>
  );
}
