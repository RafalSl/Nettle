import { useEffect, useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { addDays, localDay } from '@/core/model/time';
import { markExported, presetOptions, reportPreview, sinceLastExport, type ReportPreview } from '@/core/usecases/backup';
import { exportBundle } from '@/core/usecases/exchange';
import { areaLabelIn, currentLanguage, errorMessage, itemLabelIn, t, tIn } from '@/i18n';
import { useServices } from '@/services';
import { Button, Chips, Hint, Label, Screen, styles } from '@/ui/components';

type Period = 'since' | 'last30' | 'last90' | 'all';

/**
 * EX-14, UX-1: the Doctor report preset. A period (default: since the last export), the counts, sensitive photos
 * off by default (EX-7), a report language that defaults to the app language (EX-3), then the share sheet.
 * With nothing in the period the button is disabled and the screen says why.
 */
export default function ReportScreen() {
  const { deps, fileShare } = useServices();
  const [available, setAvailable] = useState<Period[]>(['last30', 'last90', 'all']);
  const [period, setPeriod] = useState<Period>('last30');
  const [language, setLanguage] = useState<'en' | 'pl'>(currentLanguage());
  const [sensitive, setSensitive] = useState(false);
  const [preview, setPreview] = useState<ReportPreview | null>(null);

  const today = localDay(deps.clock.now().toISOString(), deps.clock.timeZone(), deps.dayStart.get());
  const daysFor = async (p: Period): Promise<{ from?: string; to?: string }> => {
    if (p === 'since') return (await sinceLastExport(deps)) ?? {};
    if (p === 'last30') return { from: addDays(today, -29) ?? today, to: today };
    if (p === 'last90') return { from: addDays(today, -89) ?? today, to: today };
    return {};
  };

  useEffect(() => {
    (async () => {
      if (await sinceLastExport(deps)) {
        setAvailable(['since', 'last30', 'last90', 'all']);
        setPeriod('since'); // the default once there has been an export
      }
    })().catch(() => undefined);
  }, [deps]);

  useEffect(() => {
    (async () => setPreview(await reportPreview(deps, await daysFor(period))))().catch((e) => Alert.alert(errorMessage(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps, period]);

  async function create() {
    try {
      const options = presetOptions({
        kind: 'doctor',
        days: await daysFor(period),
        photos: { mode: sensitive ? 'all' : 'non_sensitive' },
        report: {
          language,
          text: (key, vars) => tIn(language, key, vars),
          areaName: (a) => areaLabelIn(language, a),
          itemName: (i) => itemLabelIn(language, i),
        },
      });
      const bytes = await exportBundle(deps, options);
      await fileShare.saveAndShare(`nettle-report-${deps.clock.now().toISOString().slice(0, 10)}.zip`, bytes, 'application/zip');
      await markExported(deps);
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }

  const empty = preview !== null && preview.entries === 0;
  return (
    <Screen>
      <Hint>{t('doctor.hint')}</Hint>
      <Label>{t('doctor.range')}</Label>
      <Chips items={available.map((p) => ({ id: p, label: t(`doctor.${p}`) }))} selected={new Set([period])} onToggle={(id) => setPeriod(id as Period)} />
      {preview && !empty && <Hint>{t('doctor.counts', { entries: preview.entries, photos: preview.photos })}</Hint>}
      {empty && <Hint>{t('doctor.empty')}</Hint>}
      {preview && preview.sensitivePhotos > 0 && (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={styles.rowText}>{t('doctor.sensitive', { n: preview.sensitivePhotos })}</Text>
            <Switch value={sensitive} onValueChange={setSensitive} accessibilityLabel={t('doctor.sensitive', { n: preview.sensitivePhotos })} />
          </View>
          <Hint>{t('doctor.sensitiveHint')}</Hint>
        </>
      )}
      <Label>{t('doctor.language')}</Label>
      <Chips
        items={[
          { id: 'en', label: t('export.english') },
          { id: 'pl', label: t('export.polish') },
        ]}
        selected={new Set([language])}
        onToggle={(id) => setLanguage(id as 'en' | 'pl')}
      />
      <Button title={t('doctor.button')} disabled={preview === null || empty} onPress={create} />
    </Screen>
  );
}
