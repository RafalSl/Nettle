import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { MAX_SUGGESTION_ROWS, WINDOW_DAYS, defaultPreferences, type SuggestionSettings } from '@/core/model/preferences';
import { getPreferences, updateSuggestionSettings } from '@/core/usecases/preferences';
import { errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { Button, Chips, Hint, Label, Screen, styles } from '@/ui/components';

/** IN-14, UX-6: how many suggestions show, how far back "frequent" looks, and "save on tap". Defaults need no visit here. */
export default function SuggestionSettingsScreen() {
  const { deps } = useServices();
  const [s, setS] = useState<SuggestionSettings>(defaultPreferences().suggestions);
  const load = useCallback(() => {
    getPreferences(deps).then((p) => setS(p.suggestions)).catch((e) => Alert.alert(errorMessage(e)));
  }, [deps]);
  useFocusEffect(load);

  async function change(patch: Partial<SuggestionSettings>) {
    try {
      setS(await updateSuggestionSettings(deps, patch));
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }

  return (
    <Screen>
      <Hint>{t('sugg.hint')}</Hint>
      <Label>{t('sugg.rows')}</Label>
      <View style={styles.stepperRow}>
        <Button kind="secondary" title="−" accessibilityLabel={t('sugg.fewer')} disabled={s.rows <= 1} onPress={() => void change({ rows: s.rows - 1 })} />
        <Text style={styles.stepValue}>{s.rows}</Text>
        <Button kind="secondary" title="+" accessibilityLabel={t('sugg.more')} disabled={s.rows >= MAX_SUGGESTION_ROWS} onPress={() => void change({ rows: s.rows + 1 })} />
      </View>
      <Label>{t('sugg.window')}</Label>
      <Chips
        items={WINDOW_DAYS.map((n) => ({ id: String(n), label: t('sugg.days', { n }) }))}
        selected={new Set([String(s.windowDays)])}
        onToggle={(id) => void change({ windowDays: Number(id) as SuggestionSettings['windowDays'] })}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={styles.rowText}>{t('sugg.saveOnTap')}</Text>
        <Switch value={s.saveOnTap} onValueChange={(saveOnTap) => void change({ saveOnTap })} accessibilityLabel={t('sugg.saveOnTap')} />
      </View>
      <Hint>{t('sugg.saveOnTapHint')}</Hint>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={styles.rowText}>{t('sugg.knownNames')}</Text>
        <Switch value={s.knownNames} onValueChange={(knownNames) => void change({ knownNames })} accessibilityLabel={t('sugg.knownNames')} />
      </View>
      <Hint>{t('sugg.knownNamesHint')}</Hint>
    </Screen>
  );
}
