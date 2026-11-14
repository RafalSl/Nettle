import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { defaultPreferences, type CheckInScoreSettings } from '@/core/model/preferences';
import { getPreferences } from '@/core/usecases/preferences';
import { useServices } from '@/services';

/** SK-7: which of the four daily scores are switched on (all by default). Off ones are not asked. */
export function useCheckInScores(): CheckInScoreSettings {
  const { deps } = useServices();
  const [on, setOn] = useState<CheckInScoreSettings>(defaultPreferences().checkInScores);
  useFocusEffect(
    useCallback(() => {
      getPreferences(deps).then((p) => setOn(p.checkInScores), () => undefined);
    }, [deps]),
  );
  return on;
}
