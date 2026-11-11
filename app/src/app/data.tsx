import { useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import type { Parts } from '@/core/model/types';
import type { ImportMode } from '@/core/ports/storage';
import { applyImport, exportBundle, previewImport, type ParsedImport } from '@/core/usecases/exchange';
import { errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { Button, Heading, Hint, Label, Screen, styles } from '@/ui/components';

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

/** EX-1 export and EX-10 import (preview, choose parts, then merge or replace). */
export default function DataScreen() {
  const { deps, fileShare } = useServices();
  const [exportParts, setExportParts] = useState<Parts>({ records: true, settings: true });
  const [pending, setPending] = useState<ParsedImport | null>(null);
  const [importParts, setImportParts] = useState<Parts>({ records: true, settings: true });

  async function doExport() {
    try {
      const stamp = deps.clock.now().toISOString().slice(0, 10);
      const bytes = await exportBundle(deps, { parts: exportParts });
      await fileShare.saveAndShare(`nettle-export-${stamp}.zip`, bytes, 'application/zip');
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }

  async function choose() {
    try {
      const bytes = await fileShare.pickFile();
      if (!bytes) return;
      const parsed = await previewImport(deps, bytes);
      setImportParts(parsed.preview.has);
      setPending(parsed);
    } catch (e) {
      setPending(null);
      Alert.alert(errorMessage(e));
    }
  }

  async function apply(mode: ImportMode) {
    if (!pending) return;
    try {
      await applyImport(deps, pending, { mode, parts: importParts });
      setPending(null);
      Alert.alert(t('data.imported'));
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }

  function confirmReplace() {
    Alert.alert(t('data.replaceConfirmTitle'), t('data.replaceConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('data.replace'), style: 'destructive', onPress: () => apply('replace') },
    ]);
  }

  const p = pending?.preview;
  const nothingToImport = !(importParts.records || importParts.settings);
  return (
    <Screen>
      <Heading>{t('data.exportTitle')}</Heading>
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
      {(exportParts.records || exportParts.settings) && (
        <Button title={t('data.exportButton')} onPress={doExport} />
      )}

      <Heading>{t('data.importTitle')}</Heading>
      <Hint>{t('data.importHint')}</Hint>
      <Button kind="secondary" title={t('data.importButton')} onPress={choose} />

      {p && (
        <>
          <Label>{t('data.previewTitle')}</Label>
          {p.has.records && (
            <Hint>
              {t('data.previewRecords', {
                meals: p.incoming.meals,
                entries: p.incoming.skinEntries,
                newMeals: p.newRows.meals,
                newEntries: p.newRows.skinEntries,
              })}
            </Hint>
          )}
          {p.has.settings && (
            <Hint>
              {t('data.previewSettings', { areas: p.incoming.skinAreas, newAreas: p.newRows.skinAreas })}
            </Hint>
          )}
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
    </Screen>
  );
}
