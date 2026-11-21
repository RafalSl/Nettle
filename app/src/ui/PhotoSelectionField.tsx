import DateTimePicker from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { DEFAULT_PHOTO_SELECTION, type PhotoSelection } from '@/core/export/photoSelection';
import { localDateTime, localDay, localDaysToRange } from '@/core/model/time';
import type { Photo, SkinArea } from '@/core/model/types';
import { areaLabel, t } from '@/i18n';
import { useServices } from '@/services';
import { Chips, Hint, Label, styles } from '@/ui/components';
import { PhotoGrid } from '@/ui/PhotoGrid';
import { SwitchRow } from '@/ui/SwitchRow';

type Mode = 'non_sensitive' | 'all' | 'none' | 'filter' | 'custom';
const MODES: Mode[] = ['non_sensitive', 'all', 'none', 'filter', 'custom'];

/** EX-7: which photos go into the export. The default leaves out sensitive photos. */
export function PhotoSelectionField({ onChange }: { onChange: (selection: PhotoSelection) => void }) {
  const { deps } = useServices();
  const dayStart = deps.dayStart.get();
  const [mode, setMode] = useState<Mode>('non_sensitive');
  const [areas, setAreas] = useState<SkinArea[]>([]);
  const [areaIds, setAreaIds] = useState<Set<string>>(new Set());
  const [photos, setPhotos] = useState<{ photo: Photo; label: string }[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [includeSensitive, setIncludeSensitive] = useState(false);
  const [limit, setLimit] = useState(false);
  const [from, setFrom] = useState(new Date());
  const [to, setTo] = useState(new Date());
  const tz = deps.clock.timeZone();

  useEffect(() => {
    (async () => {
      const all = await deps.repo.listAreas();
      setAreas(all);
      // EX-7: single photos are listed by area and time, sensitive ones marked.
      const areaOf = new Map(
        [...(await deps.repo.listSkinEntries()), ...(await deps.repo.listRecords('nailEntries'))].map((e) => [e.id, all.find((a) => a.id === e.areaId)]),
      );
      setPhotos(
        (await deps.repo.listRecords('photos')).map((photo) => {
          const area = areaOf.get(photo.entryId);
          return { photo, label: `${area ? areaLabel(area) : ''} ${localDateTime(photo.at.utc, photo.at.tz)}`.trim() };
        }),
      );
    })().catch(() => undefined);
  }, [deps]);

  useEffect(() => {
    if (mode === 'custom') {
      onChange({ mode: 'custom', ids: [...picked] });
      return;
    }
    if (mode !== 'filter') {
      onChange(mode === 'non_sensitive' ? DEFAULT_PHOTO_SELECTION : { mode });
      return;
    }
    const range = limit ? localDaysToRange(localDay(from.toISOString(), tz), localDay(to.toISOString(), tz), tz, dayStart) : null;
    onChange({
      mode: 'filter',
      areaIds: areaIds.size > 0 ? [...areaIds] : undefined,
      range: range ?? undefined,
      includeSensitive,
    });
  }, [mode, areaIds, includeSensitive, limit, from, to, tz, dayStart, picked, onChange]);

  return (
    <>
      <Label>{t('exportPhotos.title')}</Label>
      <Hint>{t('exportPhotos.hint')}</Hint>
      <Chips items={MODES.map((m) => ({ id: m, label: t(`exportPhotos.${m}`) }))} selected={new Set([mode])} onToggle={(id) => setMode(id as Mode)} />
      {mode === 'custom' && (
        <>
          <Hint>{t('exportPhotos.customHint')}</Hint>
          {photos.length === 0 ? (
            <Hint>{t('exportPhotos.noPhotos')}</Hint>
          ) : (
            <PhotoGrid
              items={photos.map(({ photo, label }) => ({ id: photo.id, file: photo.file, sensitive: photo.sensitive, label: photo.sensitive ? `${label} (${t('analysis.sensitiveMark')})` : label }))}
              selected={picked}
              onToggle={(id) =>
                setPicked((cur) => {
                  const next = new Set(cur);
                  if (!next.delete(id)) next.add(id);
                  return next;
                })
              }
              onAll={() => setPicked(new Set(photos.filter((p) => !p.photo.sensitive).map((p) => p.photo.id)))}
              onNone={() => setPicked(new Set())}
            />
          )}
        </>
      )}
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
          <SwitchRow title={t('exportPhotos.includeSensitive')} value={includeSensitive} onChange={setIncludeSensitive} />
          <SwitchRow title={t('exportPhotos.limit')} value={limit} onChange={setLimit} />
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
