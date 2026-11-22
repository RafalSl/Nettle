import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';
import { TextInput } from '@/ui/themed';
import {
  apiKeyTail,
  deleteApiKey,
  getGroupModel,
  modelChoices,
  saveApiKey,
  setGroupModel,
  testApiKey,
  type ModelGroup,
} from '@/core/usecases/llm';
import { t } from '@/i18n';
import { useServices } from '@/services';
import { Button, Chips, Heading, Hint, Label, styles } from '@/ui/components';
import { showError } from '@/ui/showError';

/** SE-2, SE-5, LL-9: enter, rotate or delete the API key (Keychain only) and choose the model for each LLM action (LL-9). */
const GROUPS: ModelGroup[] = ['estimates', 'analysis'];

/**
 * SE-2, SE-5, LL-2, LL-9: enter, test or delete the API key (Keychain only; only its last four characters are ever
 * shown) and choose the model: one for the estimates and one for the analysis and the report summary.
 */
export function LlmSettingsSection() {
  const { deps } = useServices();
  const [tail, setTail] = useState<string | null>(null);
  // The key lives only in this state until it is saved, then it is cleared; it is never shown again.
  const [keyInput, setKeyInput] = useState('');
  const [models, setModels] = useState<Record<ModelGroup, string | null>>({ estimates: null, analysis: null });

  const reload = useCallback(async () => {
    setTail(await apiKeyTail(deps));
    setModels({ estimates: await getGroupModel(deps, 'estimates'), analysis: await getGroupModel(deps, 'analysis') });
  }, [deps]);
  useFocusEffect(
    useCallback(() => {
      reload().catch(() => undefined);
    }, [reload]),
  );

  const run = async (fn: () => Promise<void>, done?: string) => {
    try {
      await fn();
      await reload();
      if (done) Alert.alert(done);
    } catch (e) {
      showError(e);
    }
  };
  const empty = keyInput.trim() === '';

  return (
    <>
      <Heading>{t('llm.title')}</Heading>
      <Hint>{t('llm.keyHint')}</Hint>
      <Hint>{tail ? t('llm.keyTail', { tail }) : t('llm.keyNone')}</Hint>
      <Label>{t('llm.keyField')}</Label>
      <TextInput
        style={styles.input}
        value={keyInput}
        onChangeText={setKeyInput}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="none"
        accessibilityLabel={t('llm.keyField')}
      />
      {empty && <Hint>{t('edit.missing', { what: t('llm.keyPasteFirst') })}</Hint>}
      <Button
        title={t('llm.keySave')}
        disabled={empty}
        onPress={() =>
          run(async () => {
            await saveApiKey(deps, keyInput);
            setKeyInput('');
          }, t('llm.saved'))
        }
      />
      {tail && (
        <>
          <Button kind="secondary" title={t('llm.keyTest')} onPress={() => run(() => testApiKey(deps), t('llm.keyWorks'))} />
          <Hint>{t('llm.keyTestHint')}</Hint>
          <Button kind="danger" title={t('llm.keyDelete')} onPress={() => run(() => deleteApiKey(deps))} />
        </>
      )}
      <Heading>{t('llm.modelsTitle')}</Heading>
      <Hint>{t('llm.modelsHint')}</Hint>
      {GROUPS.map((group) => (
        <View key={group} style={{ gap: 8 }}>
          <Label>{t(`llm.group.${group}`)}</Label>
          <Hint>{t(`llm.groupHint.${group}`)}</Hint>
          <Chips
            items={modelChoices(deps).map((m) => ({ id: m.id, label: m.label }))}
            selected={new Set(models[group] ? [models[group]!] : [])}
            onToggle={(id) => void run(() => setGroupModel(deps, group, id))}
          />
          {models[group] === null && <Hint>{t('llm.modelsMixed')}</Hint>}
        </View>
      ))}
    </>
  );
}
