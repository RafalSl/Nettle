import { useFocusEffect } from 'expo-router';
import { Fragment, useCallback, useState } from 'react';
import { Alert, TextInput } from 'react-native';
import { LLM_ACTIONS, type LlmAction } from '@/core/llm/actions';
import { DEFAULT_MODEL, deleteApiKey, getModel, hasApiKey, modelChoices, saveApiKey, setModel } from '@/core/usecases/llm';
import { errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { Button, Chips, Heading, Hint, Label, styles } from '@/ui/components';

/** SE-2, SE-5, LL-9: enter, rotate or delete the API key (Keychain only) and choose the model for each LLM action (LL-9). */
export function LlmSettingsSection() {
  const { deps } = useServices();
  const [keySaved, setKeySaved] = useState(false);
  // The key lives only in this state until it is saved, then it is cleared; it is never shown again.
  const [keyInput, setKeyInput] = useState('');
  const [models, setModels] = useState<Record<LlmAction, string>>(() => Object.fromEntries(LLM_ACTIONS.map((a) => [a, DEFAULT_MODEL])) as Record<LlmAction, string>);

  const reload = useCallback(async () => {
    setKeySaved(await hasApiKey(deps));
    setModels(Object.fromEntries(await Promise.all(LLM_ACTIONS.map(async (a) => [a, await getModel(deps, a)] as const))) as Record<LlmAction, string>);
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
      Alert.alert(errorMessage(e));
    }
  };

  return (
    <>
      <Heading>{t('llm.title')}</Heading>
      <Hint>{t('llm.keyHint')}</Hint>
      <Hint>{keySaved ? t('llm.keySaved') : t('llm.keyNone')}</Hint>
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
      <Button
        title={t('llm.keySave')}
        onPress={() =>
          run(async () => {
            await saveApiKey(deps, keyInput);
            setKeyInput('');
          }, t('llm.saved'))
        }
      />
      {keySaved && <Button kind="danger" title={t('llm.keyDelete')} onPress={() => run(() => deleteApiKey(deps))} />}
      <Heading>{t('llm.modelsTitle')}</Heading>
      <Hint>{t('llm.modelsHint')}</Hint>
      {LLM_ACTIONS.map((action) => (
        <Fragment key={action}>
          <Label>{t(`llm.action.${action}`)}</Label>
          <Chips
            items={modelChoices(deps).map((m) => ({ id: m.id, label: m.label }))}
            selected={new Set([models[action]])}
            onToggle={(id) => void run(() => setModel(deps, action, id))}
          />
        </Fragment>
      ))}
    </>
  );
}
