import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { CHECKIN_SCORES, defaultPreferences, type CheckInScoreSettings } from '@/core/model/preferences';
import { getPreferences, setCheckInScore } from '@/core/usecases/preferences';
import { errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { Heading, Hint, styles } from '@/ui/components';

/** SK-7, UX-6: switch the daily scores of the check-in on or off. An off score is not asked and not recorded. */
export function CheckInScoresSection() {
  const { deps } = useServices();
  const [on, setOn] = useState<CheckInScoreSettings>(defaultPreferences().checkInScores);
  useFocusEffect(
    useCallback(() => {
      getPreferences(deps).then((p) => setOn(p.checkInScores), (e) => Alert.alert(errorMessage(e)));
    }, [deps]),
  );
  return (
    <>
      <Heading>{t('settings.scoresTitle')}</Heading>
      {CHECKIN_SCORES.map((k) => (
        <View key={k} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={styles.rowText}>{t(`today.${k}`)}</Text>
          <Switch
            value={on[k]}
            onValueChange={(v) => setCheckInScore(deps, k, v).then(setOn, (e) => Alert.alert(errorMessage(e)))}
            accessibilityLabel={t(`today.${k}`)}
          />
        </View>
      ))}
      <Hint>{t('settings.scoresHint')}</Hint>
    </>
  );
}
