import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { DEFAULT_FLARE_THRESHOLD } from '@/core/model/flares';
import { getPreferences, setFlareThreshold } from '@/core/usecases/preferences';
import { errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { Chips, Heading, Hint, Label } from '@/ui/components';

/** SK-6, UX-6: the severity at or above which skin entries count as a flare. Saved at once; flares are recomputed from the entries. */
export function FlareThresholdSection() {
  const { deps } = useServices();
  const [threshold, setThreshold] = useState(DEFAULT_FLARE_THRESHOLD);
  useFocusEffect(
    useCallback(() => {
      getPreferences(deps).then((p) => setThreshold(p.flareThreshold), (e) => Alert.alert(errorMessage(e)));
    }, [deps]),
  );
  return (
    <>
      <Heading>{t('settings.flareThresholdTitle')}</Heading>
      <Label>{t('settings.flareThresholdLabel')}</Label>
      <Chips
        items={Array.from({ length: 10 }, (_, i) => ({ id: String(i + 1), label: String(i + 1) }))}
        selected={new Set([String(threshold)])}
        onToggle={(id) => {
          setFlareThreshold(deps, Number(id)).then(setThreshold, (e) => Alert.alert(errorMessage(e)));
        }}
      />
      <Hint>{t('settings.flareThresholdHint')}</Hint>
    </>
  );
}
