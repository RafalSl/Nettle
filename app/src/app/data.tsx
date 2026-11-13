import { useState } from 'react';
import { Alert, Switch, Text, TextInput, View } from 'react-native';
import { NettleError } from '@/core/model/errors';
import type { Parts } from '@/core/model/types';
import type { ImportMode } from '@/core/ports/storage';
import { EXTRA_KINDS, LIST_KINDS } from '@/core/model/types';
import { applyImport, exportBundle, previewImport, type ParsedImport } from '@/core/usecases/exchange';
import { errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { DEFAULT_PHOTO_SELECTION, type PhotoSelection } from '@/core/export/photoSelection';
import { PhotoSelectionField } from '@/ui/PhotoSelectionField';
import { DeleteSection } from '@/ui/DeleteSection';
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

/** Total of some collections in a row-count map. */
const sumOf = (counts: Record<string, number>, keys: readonly string[]) => keys.reduce((n, k) => n + (counts[k] ?? 0), 0);

/** EX-1 export and EX-10 import (preview, choose parts, then merge or replace). */
export default function DataScreen() {
  const { deps, fileShare } = useServices();
  const [exportParts, setExportParts] = useState<Parts>({ records: true, settings: true });
  const [photoSelection, setPhotoSelection] = useState<PhotoSelection>(DEFAULT_PHOTO_SELECTION);
  const [pending, setPending] = useState<ParsedImport | null>(null);
  const [importParts, setImportParts] = useState<Parts>({ records: true, settings: true });
  // Passwords live only in component state and are cleared after use; they are never stored or logged.
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [locked, setLocked] = useState<Uint8Array | null>(null);
  const [filePassword, setFilePassword] = useState('');

  async function doExport() {
    try {
      if (password !== repeat) {
        Alert.alert(t('errors.password_mismatch'));
        return;
      }
      const stamp = deps.clock.now().toISOString().slice(0, 10);
      const bytes = await exportBundle(deps, { parts: exportParts, password: password || undefined, photos: photoSelection });
      await fileShare.saveAndShare(`nettle-export-${stamp}.zip`, bytes, 'application/zip');
      setPassword('');
      setRepeat('');
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }

  async function open(bytes: Uint8Array, pw?: string) {
    try {
      const parsed = await previewImport(deps, bytes, pw);
      setImportParts(parsed.preview.has);
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
      <PhotoSelectionField onChange={setPhotoSelection} />
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
