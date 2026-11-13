import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, TextInput } from 'react-native';
import { deleteApiKey, hasApiKey, saveApiKey, setModel } from '@/core/usecases/llm';
import { errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { Button, Heading, Hint, Label, styles } from '@/ui/components';

/** SE-2, SE-5, LL-9: enter, rotate or delete the API key (Keychain only) and choose the model name. */
export function LlmSettingsSection() {
  const { deps } = useServices();
  const [keySaved, setKeySaved] = useState(false);
  // The key lives only in this state until it is saved, then it is cleared; it is never shown again.
  const [keyInput, setKeyInput] = useState('');
  const [model, setModelText] = useState('');

  const reload = useCallback(async () => {
    setKeySaved(await hasApiKey(deps));
    setModelText((await deps.settings.get('llm_model')) ?? '');
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
      <Label>{t('llm.modelField')}</Label>
      <TextInput style={styles.input} value={model} onChangeText={setModelText} autoCapitalize="none" autoCorrect={false} />
      <Hint>{t('llm.modelHint')}</Hint>
      <Button kind="secondary" title={t('llm.modelSave')} onPress={() => run(() => setModel(deps, model), t('llm.saved'))} />
    </>
  );
}
