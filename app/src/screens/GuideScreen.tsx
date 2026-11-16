import { useRouter } from 'expo-router';
import type { EntryType } from '@/core/model/preferences';
import { t } from '@/i18n';
import { ENTRY_ROUTE, entryTitle } from '@/ui/entryTypes';
import { NavRow } from '@/ui/NavRow';
import { Hint, Screen } from '@/ui/components';

/** UX-11: everyday situations and the entry type each one belongs to. Each row opens that entry's form. */
export const GUIDE: readonly { id: string; entry: EntryType }[] = [
  { id: 'meal', entry: 'meal' },
  { id: 'drink', entry: 'drink' },
  { id: 'tablet', entry: 'medication' },
  { id: 'regularTablet', entry: 'medication' },
  { id: 'cream', entry: 'treatment' },
  { id: 'regularCream', entry: 'treatment' },
  { id: 'newProduct', entry: 'change' },
  { id: 'stoppedProduct', entry: 'change' },
  { id: 'diet', entry: 'change' },
  { id: 'skin', entry: 'skin' },
  { id: 'flare', entry: 'skin' },
  { id: 'nail', entry: 'nails' },
  { id: 'feeling', entry: 'checkin' },
  { id: 'belly', entry: 'checkin' },
  { id: 'reaction', entry: 'reaction' },
  { id: 'visit', entry: 'medical' },
  { id: 'ill', entry: 'medical' },
  { id: 'illQuick', entry: 'checkin' },
  { id: 'stool', entry: 'stool' },
];

/** UX-11: "Where do I log…?", reachable from More and from Settings, About. */
export default function GuideScreen() {
  const router = useRouter();
  return (
    <Screen>
      <Hint>{t('guide.intro')}</Hint>
      {GUIDE.map((g) => (
        <NavRow key={g.id} title={t(`guide.items.${g.id}`)} subtitle={`${entryTitle(g.entry)}${t(`guide.notes.${g.id}`, { defaultValue: '' }) ? ` · ${t(`guide.notes.${g.id}`)}` : ''}`} onPress={() => router.push(ENTRY_ROUTE[g.entry])} />
      ))}
    </Screen>
  );
}
