import { useState } from 'react';
import { Alert } from 'react-native';
import { DAY_START_HOURS } from '@/core/model/dayStart';
import { setDayStartHour } from '@/core/usecases/preferences';
import { errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { Chips, Heading, Hint } from '@/ui/components';

const label = (h: number) => `${String(h).padStart(2, '0')}:00`;

/** NF-7: "Day starts at", 00:00 to 06:00. Saved at once; it is exported with the settings. */
export function DayStartSection() {
  const { deps } = useServices();
  const [hour, setHour] = useState(deps.dayStart.get());
  return (
    <>
      <Heading>{t('day.dayStart')}</Heading>
      <Chips
        items={DAY_START_HOURS.map((h) => ({ id: String(h), label: label(h) }))}
        selected={new Set([String(hour)])}
        onToggle={(id) => {
          setDayStartHour(deps, Number(id)).then(setHour, (e) => Alert.alert(errorMessage(e)));
        }}
      />
      <Hint>{t('day.dayStartHint')}</Hint>
    </>
  );
}
