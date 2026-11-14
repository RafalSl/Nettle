import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { DELETE_GROUPS, DELETE_GROUP_IDS, type DeleteGroup } from '@/core/model/deleteGroups';
import { localDay, localDaysToRange } from '@/core/model/time';
import type { RecordKind } from '@/core/model/types';
import { deleteData, previewDelete } from '@/core/usecases/deleteData';
import { exportBundle } from '@/core/usecases/exchange';
import { errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { Button, Chips, Heading, Hint, Label, styles } from '@/ui/components';

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
    range: limit ? (localDaysToRange(localDay(from.toISOString(), tz), localDay(to.toISOString(), tz), tz, deps.dayStart.get()) ?? undefined) : undefined,
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
      Alert.alert(t('delete.confirmTitle'), t('delete.confirmBody', { lines: lines.join('\n') }), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('delete.exportFirst'),
          onPress: async () => {
            try {
              const stamp = deps.clock.now().toISOString().slice(0, 10);
              await fileShare.saveAndShare(`nettle-export-${stamp}.zip`, await exportBundle(deps), 'application/zip');
            } catch (e) {
              Alert.alert(errorMessage(e));
            }
          },
        },
        {
          text: t('delete.confirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteData(deps, sel);
              setGroups(new Set());
              Alert.alert(t('delete.done'));
            } catch (e) {
              Alert.alert(errorMessage(e));
            }
          },
        },
      ]);
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
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={styles.rowText}>{t('delete.limit')}</Text>
        <Switch value={limit} onValueChange={setLimit} accessibilityLabel={t('delete.limit')} />
      </View>
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
      <Button kind="danger" title={t('delete.button')} onPress={review} />
    </>
  );
}
