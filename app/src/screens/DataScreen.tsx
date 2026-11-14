import { useState } from 'react';
import { Alert, Switch, Text, TextInput, View } from 'react-native';
import { NettleError } from '@/core/model/errors';
import type { Parts } from '@/core/model/types';
import type { ImportMode } from '@/core/ports/storage';
import { EXTRA_KINDS, LIST_KINDS } from '@/core/model/types';
import { markExported, presetOptions } from '@/core/usecases/backup';
import { applyImport, exportBundle, previewImport, type ExportOptions, type ParsedImport } from '@/core/usecases/exchange';
import { areaLabelIn, currentLanguage, errorMessage, itemLabelIn, t, tIn } from '@/i18n';
import { useServices } from '@/services';
import { confirmWithExport, exportEverything } from '@/ui/exportFirst';
import { DEFAULT_PHOTO_SELECTION, type PhotoSelection } from '@/core/export/photoSelection';
import { PhotoSelectionField } from '@/ui/PhotoSelectionField';
import { DeleteSection } from '@/ui/DeleteSection';
import { Button, Chips, Heading, Hint, Label, Screen, styles } from '@/ui/components';

function PartSwitch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={styles.rowText}>{label}</Text>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} />
    </View>
  );
}

/** Total of some collections in a row-count map. */
const sumOf = (counts: Record<string, number>, keys: readonly string[]) => keys.reduce((n, k) => n + (counts[k] ?? 0), 0);

/** EX-1 export and EX-10 import (preview, choose parts, then merge or replace). */
export default function DataScreen() {
  const { deps, fileShare } = useServices();
  const [exportParts, setExportParts] = useState<Parts>({ records: true, settings: true });
  const [csv, setCsv] = useState(false);
  const [report, setReport] = useState(false);
  const [reportLanguage, setReportLanguage] = useState<'en' | 'pl'>(currentLanguage());
  const [photoSelection, setPhotoSelection] = useState<PhotoSelection>(DEFAULT_PHOTO_SELECTION);
  const [pending, setPending] = useState<ParsedImport | null>(null);
  const [importParts, setImportParts] = useState<Parts>({ records: true, settings: true });
  // Passwords live only in component state and are cleared after use; they are never stored or logged.
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [locked, setLocked] = useState<Uint8Array | null>(null);
  const [filePassword, setFilePassword] = useState('');
  const [restore, setRestore] = useState(false);

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
      Alert.alert(errorMessage(e));
    }
  }

  /** EX-14: Full backup, records and settings with every photo. */
  const doBackup = () => share('nettle-backup', presetOptions({ kind: 'backup' }));

  const doExport = () =>
    share('nettle-export', {
      parts: exportParts,
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

  async function open(bytes: Uint8Array, pw?: string) {
    try {
      const parsed = await previewImport(deps, bytes, pw);
      setImportParts(parsed.preview.has);
      setRestore(false);
      setPending(parsed);
      setLocked(null);
      setFilePassword('');
    } catch (e) {
      setPending(null);
      if (e instanceof NettleError && e.code === 'import_password_required') {
        setLocked(bytes);
        return;
      }
      if (!(e instanceof NettleError && e.code === 'import_wrong_password')) setLocked(null);
      Alert.alert(errorMessage(e));
    }
  }

  async function choose() {
    try {
      const bytes = await fileShare.pickFile();
      if (bytes) await open(bytes);
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }

  async function apply(mode: ImportMode) {
    if (!pending) return;
    try {
      await applyImport(deps, pending, { mode, parts: importParts, restoreTombstoned: restore });
      setPending(null);
      Alert.alert(t('data.imported'));
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }

  /** UX-9: replacing is destructive, so it asks in an action sheet with Cancel last. */
  async function confirmReplace() {
    const go = await confirmWithExport({
      title: t('data.replaceConfirmTitle'),
      message: t('data.replaceConfirmBody'),
      action: t('data.replace'),
      exportNow: () => exportEverything(deps, fileShare),
      onExportError: (e) => Alert.alert(errorMessage(e)),
    });
    if (go) await apply('replace');
  }

  const p = pending?.preview;
  const nothingToImport = !(importParts.records || importParts.settings);
  return (
    <Screen>
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
      {(exportParts.records || exportParts.settings) && (
        <Button title={t('data.exportButton')} onPress={doExport} />
      )}

      <Heading>{t('data.importTitle')}</Heading>
      <Hint>{t('data.importHint')}</Hint>
      <Button kind="secondary" title={t('data.importButton')} onPress={choose} />

      {locked && (
        <>
          <Label>{t('data.unlockTitle')}</Label>
          <TextInput
            style={styles.input}
            placeholder={t('data.unlockPassword')}
            value={filePassword}
            onChangeText={setFilePassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="none"
          />
          <Button title={t('data.unlockButton')} onPress={() => open(locked, filePassword)} />
          <Button
            kind="secondary"
            title={t('common.cancel')}
            onPress={() => {
              setLocked(null);
              setFilePassword('');
            }}
          />
        </>
      )}

      {p && (
        <>
          <Label>{t('data.previewTitle')}</Label>
          {p.has.records && (
            <Hint>
              {t('data.previewRecords', {
                meals: p.incoming.meals,
                entries: p.incoming.skinEntries,
                other: sumOf(p.incoming, EXTRA_KINDS),
                newMeals: p.newRows.meals,
                newEntries: p.newRows.skinEntries,
                newOther: sumOf(p.newRows, EXTRA_KINDS),
              })}
            </Hint>
          )}
          {p.has.settings && (
            <Hint>
              {t('data.previewSettings', {
                areas: p.incoming.skinAreas,
                lists: sumOf(p.incoming, LIST_KINDS),
                newAreas: p.newRows.skinAreas,
                newLists: sumOf(p.newRows, LIST_KINDS),
              })}
            </Hint>
          )}
          {p.tombstones.skipped > 0 && <Hint>{t('data.tombstoneSkipped', { n: p.tombstones.skipped })}</Hint>}
          {p.tombstones.restorable > 0 && (
            <PartSwitch label={t('data.tombstoneRestore')} value={restore} onChange={setRestore} />
          )}
          {p.tombstones.removesLocal > 0 && <Hint>{t('data.tombstoneRemoves', { n: p.tombstones.removesLocal })}</Hint>}
          <Label>{t('data.applyParts')}</Label>
          {p.has.records && (
            <PartSwitch
              label={t('data.partRecords')}
              value={importParts.records}
              onChange={(records) => setImportParts((s) => ({ ...s, records }))}
            />
          )}
          {p.has.settings && (
            <PartSwitch
              label={t('data.partSettings')}
              value={importParts.settings}
              onChange={(settings) => setImportParts((s) => ({ ...s, settings }))}
            />
          )}
          {!nothingToImport && (
            <>
              <Button title={t('data.merge')} onPress={() => apply('merge')} />
              <Button kind="danger" title={t('data.replace')} onPress={confirmReplace} />
            </>
          )}
          <Button kind="secondary" title={t('common.cancel')} onPress={() => setPending(null)} />
        </>
      )}
      <DeleteSection />
    </Screen>
  );
}
