import { useLocalSearchParams } from 'expo-router';
import { atOnDay, dayParam } from '@/core/model/time';
import { useServices } from '@/services';
import { useField } from '@/ui/FormModal';

/**
 * UX-2, UX-3: the time field of a new entry. It starts at now, or at the current clock time on the day the form
 * was opened for (the `day` route parameter from a past day on Today). `atForSave` is undefined while the time is
 * untouched on today, so the entry is stamped when it is saved.
 */
export function useFormTime(touch: () => void) {
  const { deps } = useServices();
  const { day } = useLocalSearchParams<{ day?: string }>();
  const forDay = dayParam(day);
  const now = deps.clock.now();
  const initial = forDay ? atOnDay(forDay, now, deps.clock.timeZone(), deps.dayStart.get()) : now;
  const [picked, setPicked] = useField<Date | null>(null, touch);
  return { value: picked ?? initial, set: setPicked, atForSave: picked ?? (forDay ? initial : undefined) };
}
