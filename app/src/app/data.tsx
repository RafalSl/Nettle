import { useState } from 'react';
import { Alert } from 'react-native';
import type { ImportMode } from '@/core/ports/storage';
import { applyImport, exportBundle, previewImport, type ParsedImport } from '@/core/usecases/exchange';
import { errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { Button, Heading, Hint, Label, Screen } from '@/ui/components';

/** EX-1 export and EX-10 import (preview, then merge or replace). */
export default function DataScreen() {
  const { deps, fileShare } = useServices();
  const [pending, setPending] = useState<ParsedImport | null>(null);

  async function doExport() {
    try {
      const stamp = deps.clock.now().toISOString().slice(0, 10);
      await fileShare.saveAndShare(`nettle-export-${stamp}.zip`, await exportBundle(deps), 'application/zip');
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }

  async function choose() {
    try {
      const bytes = await fileShare.pickFile();
      if (bytes) setPending(await previewImport(deps, bytes));
    } catch (e) {
      setPending(null);
      Alert.alert(errorMessage(e));
    }
  }

  async function apply(mode: ImportMode) {
    if (!pending) return;
    try {
      await applyImport(deps, pending, mode);
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
  return (
    <Screen>
      <Heading>{t('data.exportTitle')}</Heading>
      <Hint>{t('data.exportHint')}</Hint>
      <Button title={t('data.exportButton')} onPress={doExport} />

      <Heading>{t('data.importTitle')}</Heading>
      <Hint>{t('data.importHint')}</Hint>
      <Button kind="secondary" title={t('data.importButton')} onPress={choose} />

      {p && (
        <>
          <Label>{t('data.previewTitle')}</Label>
          <Hint>
            {t('data.preview', {
              meals: p.incoming.meals,
              entries: p.incoming.skinEntries,
              areas: p.incoming.skinAreas,
              newMeals: p.newRows.meals,
              newEntries: p.newRows.skinEntries,
              newAreas: p.newRows.skinAreas,
            })}
          </Hint>
          <Button title={t('data.merge')} onPress={() => apply('merge')} />
          <Button kind="danger" title={t('data.replace')} onPress={confirmReplace} />
          <Button kind="secondary" title={t('common.cancel')} onPress={() => setPending(null)} />
        </>
      )}
    </Screen>
  );
}
