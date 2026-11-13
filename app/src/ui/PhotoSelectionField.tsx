import DateTimePicker from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { DEFAULT_PHOTO_SELECTION, type PhotoSelection } from '@/core/export/photoSelection';
import { localDay, localDaysToRange } from '@/core/model/time';
import type { SkinArea } from '@/core/model/types';
import { areaLabel, t } from '@/i18n';
import { useServices } from '@/services';
import { Chips, Hint, Label, styles } from '@/ui/components';

type Mode = 'non_sensitive' | 'all' | 'none' | 'filter';
const MODES: Mode[] = ['non_sensitive', 'all', 'none', 'filter'];

/** EX-7: which photos go into the export. The default leaves out sensitive photos. */
export function PhotoSelectionField({ onChange }: { onChange: (selection: PhotoSelection) => void }) {
  const { deps } = useServices();
  const [mode, setMode] = useState<Mode>('non_sensitive');
  const [areas, setAreas] = useState<SkinArea[]>([]);
  const [areaIds, setAreaIds] = useState<Set<string>>(new Set());
  const [includeSensitive, setIncludeSensitive] = useState(false);
  const [limit, setLimit] = useState(false);
  const [from, setFrom] = useState(new Date());
  const [to, setTo] = useState(new Date());
  const tz = deps.clock.timeZone();

  useEffect(() => {
    deps.repo.listAreas().then(setAreas);
  }, [deps]);

  useEffect(() => {
    if (mode !== 'filter') {
      onChange(mode === 'non_sensitive' ? DEFAULT_PHOTO_SELECTION : { mode });
      return;
    }
    const range = limit ? localDaysToRange(localDay(from.toISOString(), tz), localDay(to.toISOString(), tz), tz) : null;
    onChange({
      mode: 'filter',
      areaIds: areaIds.size > 0 ? [...areaIds] : undefined,
      range: range ?? undefined,
      includeSensitive,
    });
  }, [mode, areaIds, includeSensitive, limit, from, to, tz, onChange]);

  return (
    <>
      <Label>{t('exportPhotos.title')}</Label>
      <Hint>{t('exportPhotos.hint')}</Hint>
      <Chips items={MODES.map((m) => ({ id: m, label: t(`exportPhotos.${m}`) }))} selected={new Set([mode])} onToggle={(id) => setMode(id as Mode)} />
      {mode === 'filter' && (
        <>
          <Hint>{t('exportPhotos.areas')}</Hint>
          <Chips
            items={areas.map((a) => ({ id: a.id, label: areaLabel(a) }))}
            selected={areaIds}
            onToggle={(id) =>
              setAreaIds((cur) => {
                const next = new Set(cur);
                if (!next.delete(id)) next.add(id);
                return next;
              })
            }
          />
          <View style={styles.timeRow}>
            <Text style={styles.rowText}>{t('exportPhotos.includeSensitive')}</Text>
            <Switch value={includeSensitive} onValueChange={setIncludeSensitive} accessibilityLabel={t('exportPhotos.includeSensitive')} />
          </View>
          <View style={styles.timeRow}>
            <Text style={styles.rowText}>{t('exportPhotos.limit')}</Text>
            <Switch value={limit} onValueChange={setLimit} accessibilityLabel={t('exportPhotos.limit')} />
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
        </>
      )}
    </>
  );
}
