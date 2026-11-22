import { useState } from 'react';
import { Alert } from 'react-native';
import { TextInput } from '@/ui/themed';
import { NettleError } from '@/core/model/errors';
import type { Parts } from '@/core/model/types';
import type { ImportMode } from '@/core/ports/storage';
import { EXTRA_KINDS, LIST_KINDS } from '@/core/model/types';
import { applyImport, previewImport, type ParsedImport } from '@/core/usecases/exchange';
import { reminderTexts, t } from '@/i18n';
import { restoreReminders } from '@/core/usecases/reminders';
import { useServices } from '@/services';
import { confirmWithExport, exportEverything } from '@/ui/exportFirst';
import { Button, Heading, Hint, Label, styles } from '@/ui/components';
import { rescheduleReminders } from '@/ui/rescheduleReminders';
import { showError } from '@/ui/showError';

import { PartSwitch } from '@/screens/data/PartSwitch';

/** Total of some collections in a row-count map. */
const sumOf = (counts: Record<string, number>, keys: readonly string[]) => keys.reduce((n, k) => n + (counts[k] ?? 0), 0);

/** EX-10: import a file: unlock it if needed, preview it, choose the parts, then merge or replace. */
export function ImportSection() {
  const { deps, fileShare } = useServices();
  const [pending, setPending] = useState<ParsedImport | null>(null);
  const [importParts, setImportParts] = useState<Parts>({ records: true, settings: true });
  const [locked, setLocked] = useState<Uint8Array | null>(null);
  const [filePassword, setFilePassword] = useState('');
  const [restore, setRestore] = useState(false);

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
      showError(e);
    }
  }

  async function choose() {
    try {
      const bytes = await fileShare.pickFile();
      if (bytes) await open(bytes);
    } catch (e) {
      showError(e);
    }
  }

  async function apply(mode: ImportMode) {
    if (!pending) return;
    try {
      await applyImport(deps, pending, { mode, parts: importParts, restoreTombstoned: restore });
      setPending(null);
      // IN-17, EX-10: regular items came with the file; their reminders are scheduled again, asking for permission on this phone.
      // SK-9: records alone can still add or remove today's Daily health record.
      const reminders = importParts.settings ? await restoreReminders(deps, reminderTexts()) : (await rescheduleReminders(deps), true);
      Alert.alert(t('data.imported'), reminders ? undefined : t('regular.denied'));
    } catch (e) {
      showError(e);
    }
  }

  /** UX-9: replacing is destructive, so it asks in an action sheet with Cancel last. */
  async function confirmReplace() {
    const go = await confirmWithExport({
      title: t('data.replaceConfirmTitle'),
      message: t('data.replaceConfirmBody'),
      action: t('data.replace'),
      exportNow: () => exportEverything(deps, fileShare),
      onExportError: (e) => showError(e),
    });
    if (go) await apply('replace');
  }

  const p = pending?.preview;
  const nothingToImport = !(importParts.records || importParts.settings);
  return (
    <>
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
          {p.tombstones.restorable > 0 && <PartSwitch label={t('data.tombstoneRestore')} value={restore} onChange={setRestore} />}
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
    </>
  );
}
