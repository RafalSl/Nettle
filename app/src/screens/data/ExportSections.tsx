import { useState } from 'react';
import { Alert } from 'react-native';
import { TextInput } from '@/ui/themed';
import type { Parts } from '@/core/model/types';
import { DAY_MS } from '@/core/model/time';
import { markExported, presetOptions } from '@/core/usecases/backup';
import { exportBundle, type ExportOptions } from '@/core/usecases/exchange';
import { areaLabelIn, currentLanguage, itemLabelIn, t, tIn } from '@/i18n';
import { useServices } from '@/services';
import { DEFAULT_PHOTO_SELECTION, type PhotoSelection } from '@/core/export/photoSelection';
import { DayRangePickers, pickedDay } from '@/ui/DayRangePickers';
import { PhotoSelectionField } from '@/ui/PhotoSelectionField';
import { Button, Chips, Heading, Hint, Label, styles } from '@/ui/components';
import { showError } from '@/ui/showError';

import { PartSwitch } from '@/screens/data/PartSwitch';

/** EX-14 Full backup and EX-1 custom export, with the optional password that protects either (EX-6). */
export function ExportSections() {
  const { deps, fileShare } = useServices();
  const [exportParts, setExportParts] = useState<Parts>({ records: true, settings: true });
  const [csv, setCsv] = useState(false);
  // EX-1, EX-11: an optional range of diary days for the records of a custom export.
  const [limit, setLimit] = useState(false);
  const [from, setFrom] = useState(() => new Date(deps.clock.now().getTime() - 29 * DAY_MS));
  const [to, setTo] = useState(() => deps.clock.now());
  const [report, setReport] = useState(false);
  const [reportLanguage, setReportLanguage] = useState<'en' | 'pl'>(currentLanguage());
  const [photoSelection, setPhotoSelection] = useState<PhotoSelection>(DEFAULT_PHOTO_SELECTION);
  // Passwords live only in component state and are cleared after use; they are never stored or logged.
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  /** Builds the ZIP, hands it to the share sheet and, once that went through, remembers the export (EX-11, UX-2). */
  async function share(prefix: string, options: ExportOptions) {
    try {
      if (password !== repeat) {
        Alert.alert(t('errors.password_mismatch'));
        return;
      }
      const stamp = deps.clock.now().toISOString().slice(0, 10);
      const bytes = await exportBundle(deps, { ...options, password: password || undefined });
      await fileShare.saveAndShare(`${prefix}-${stamp}.zip`, bytes, 'application/zip');
      await markExported(deps);
      setPassword('');
      setRepeat('');
    } catch (e) {
      showError(e);
    }
  }

  /** EX-14: Full backup, records and settings with every photo. */
  const doBackup = () => share('nettle-backup', presetOptions({ kind: 'backup' }));

  const doExport = () =>
    share('nettle-export', {
      parts: exportParts,
      ...(limit ? { days: { from: pickedDay(from, deps.clock.timeZone()), to: pickedDay(to, deps.clock.timeZone()) } } : {}),
      photos: photoSelection,
      csv,
      report: report
        ? {
            language: reportLanguage,
            text: (key, vars) => tIn(reportLanguage, key, vars),
            areaName: (a) => areaLabelIn(reportLanguage, a),
            itemName: (i) => itemLabelIn(reportLanguage, i),
          }
        : undefined,
    });

  return (
    <>
      <Heading>{t('data.backupTitle')}</Heading>
      <Hint>{t('data.backupHint')}</Hint>
      <Label>{t('data.passwordLabel')}</Label>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="none"
      />
      {password.length > 0 && (
        <TextInput
          style={styles.input}
          placeholder={t('data.passwordRepeat')}
          value={repeat}
          onChangeText={setRepeat}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="none"
        />
      )}
      {password.length > 0 && <Hint>{t('data.passwordHint')}</Hint>}
      <Button title={t('data.backupButton')} onPress={doBackup} />

      <Heading>{t('data.customTitle')}</Heading>
      <Hint>{t('data.exportHint')}</Hint>
      <PartSwitch
        label={t('data.partRecords')}
        value={exportParts.records}
        onChange={(records) => setExportParts((s) => ({ ...s, records }))}
      />
      <PartSwitch
        label={t('data.partSettings')}
        value={exportParts.settings}
        onChange={(settings) => setExportParts((s) => ({ ...s, settings }))}
      />
      <PartSwitch label={t('range.limit')} value={limit} onChange={setLimit} />
      {limit && <DayRangePickers from={from} to={to} onFrom={setFrom} onTo={setTo} />}
      <PhotoSelectionField onChange={setPhotoSelection} />
      <Label>{t('export.extras')}</Label>
      <PartSwitch label={t('export.csv')} value={csv} onChange={setCsv} />
      <PartSwitch label={t('export.report')} value={report} onChange={setReport} />
      {report && (
        <>
          <Hint>{t('export.reportLanguage')}</Hint>
          <Chips
            items={[
              { id: 'en', label: t('export.english') },
              { id: 'pl', label: t('export.polish') },
            ]}
            selected={new Set([reportLanguage])}
            onToggle={(id) => setReportLanguage(id as 'en' | 'pl')}
          />
        </>
      )}
      {(exportParts.records || exportParts.settings) && <Button title={t('data.exportButton')} onPress={doExport} />}
    </>
  );
}
