import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { DELETE_GROUPS, DELETE_GROUP_IDS, type DeleteGroup } from '@/core/model/deleteGroups';
import { localDay, localDaysToRange } from '@/core/model/time';
import type { RecordKind } from '@/core/model/types';
import { deleteData, previewDelete } from '@/core/usecases/deleteData';
import { errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { confirmDestructive } from '@/ui/actionSheet';
import { confirmWithExport, exportEverything } from '@/ui/exportFirst';
import { Button, Chips, Heading, Hint, Label, styles } from '@/ui/components';
import { SwitchRow } from '@/ui/SwitchRow';
import { rescheduleReminders } from '@/ui/rescheduleReminders';

/** SE-9: delete by entry type and date range, with a confirmation that lists the counts and offers an export first. */
export function DeleteSection() {
  const { deps, fileShare } = useServices();
  const [groups, setGroups] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(false);
  const [from, setFrom] = useState(new Date());
  const [to, setTo] = useState(new Date());

  const tz = deps.clock.timeZone();
  const selection = () => ({
    kinds: [...groups].flatMap((g) => DELETE_GROUPS[g as DeleteGroup] as readonly RecordKind[]),
    range: limit
      ? (localDaysToRange(localDay(from.toISOString(), tz), localDay(to.toISOString(), tz), tz, deps.dayStart.get()) ?? undefined)
      : undefined,
  });

  async function review() {
    try {
      const sel = selection();
      if (limit && !sel.range) throw new Error('range'); // shown as the generic message
      const counts = await previewDelete(deps, sel);
      const lines = (Object.keys(counts) as RecordKind[])
        .filter((k) => counts[k] > 0)
        .map((k) => `• ${t(`delete.line.${k}`, { n: counts[k] })}`);
      if (lines.length === 0) {
        Alert.alert(t('delete.nothing'));
        return;
      }
      // SE-9, UX-6: an action sheet that lists the counts and offers an export first, then a second confirmation.
      const go = await confirmWithExport({
        title: t('delete.confirmTitle'),
        message: t('delete.confirmBody', { lines: lines.join('\n') }),
        action: t('delete.confirm'),
        exportNow: () => exportEverything(deps, fileShare),
        onExportError: (e) => Alert.alert(errorMessage(e)),
      });
      if (!go) return;
      if (
        !(await confirmDestructive({ title: t('delete.secondTitle'), message: t('delete.secondBody'), action: t('delete.secondConfirm') }))
      )
        return;
      await deleteData(deps, sel);
      await rescheduleReminders(deps); // SK-9: today's Daily health record may be gone
      setGroups(new Set());
      Alert.alert(t('delete.done'));
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }

  const toggle = (id: string) =>
    setGroups((cur) => {
      const next = new Set(cur);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <>
      <Heading>{t('delete.title')}</Heading>
      <Hint>{t('delete.hint')}</Hint>
      <Chips items={DELETE_GROUP_IDS.map((g) => ({ id: g, label: t(`delete.groups.${g}`) }))} selected={groups} onToggle={toggle} />
      <SwitchRow title={t('delete.limit')} value={limit} onChange={setLimit} />
      {limit && (
        <>
          <View style={styles.timeRow}>
            <Label>{t('delete.from')}</Label>
            <DateTimePicker mode="date" value={from} onValueChange={(_e, d) => setFrom(d)} />
          </View>
          <View style={styles.timeRow}>
            <Label>{t('delete.to')}</Label>
            <DateTimePicker mode="date" value={to} onValueChange={(_e, d) => setTo(d)} />
          </View>
        </>
      )}
      {groups.size === 0 && <Hint>{t('delete.chooseFirst')}</Hint>}
      <Button kind="danger" title={t('delete.button')} disabled={groups.size === 0} onPress={review} />
    </>
  );
}
