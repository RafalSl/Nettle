import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { ENTRY_TYPES, type EntryType } from '@/core/model/preferences';
import { searchItems, type SearchItem } from '@/core/model/search';
import { getPreferences, unpinnedEntryTypes } from '@/core/usecases/preferences';
import { t } from '@/i18n';
import { useServices } from '@/services';
import { Hint, Screen } from '@/ui/components';
import { ENTRY_ICON } from '@/ui/entryIcons';
import { ENTRY_ROUTE, entrySubtitle, entryTitle } from '@/ui/entryTypes';
import { GlassSurface } from '@/ui/GlassSurface';
import { Icon } from '@/ui/Icon';
import { NavGroup } from '@/ui/NavGroup';
import { NavRow } from '@/ui/NavRow';
import { TextInput } from '@/ui/themed';
import { GUIDE } from '@/screens/GuideScreen';
import { color } from '@/ui/theme';
import { useFocusLoad } from '@/ui/useFocusLoad';

type Target = { entry: EntryType; guide: boolean };

/**
 * UX-2, UX-11: More. A search field filters the entry types and the "Where do I log…?" situations as the user types
 * (a hit opens the right form). Without a query it lists the entry types that are not pinned to Today, then the guide
 * and Edit Today.
 */
export default function MoreScreen() {
  const router = useRouter();
  const { deps } = useServices();
  const [rows, setRows] = useState<EntryType[]>([]);
  const [query, setQuery] = useState('');
  useFocusLoad(
    () => getPreferences(deps),
    [deps],
    (p) => setRows(unpinnedEntryTypes(p)),
  );
  const searching = query.trim().length > 0;
  const items: SearchItem<Target>[] = [
    ...ENTRY_TYPES.map((id) => ({ title: entryTitle(id), subtitle: entrySubtitle(id), value: { entry: id, guide: false } })),
    ...GUIDE.map((g) => ({
      title: t(`guide.items.${g.id}`),
      subtitle: entryTitle(g.entry),
      keywords: t(`guide.notes.${g.id}`, { defaultValue: '' }),
      value: { entry: g.entry, guide: true },
    })),
  ];
  const hits = searching ? searchItems(items, query) : [];

  return (
    <Screen>
      <GlassSurface
        raised
        blur={22}
        style={{ borderRadius: 999, minHeight: 52, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 10 }}
      >
        <Icon name="search" size={20} wash={false} tint={color.muted} />
        <TextInput
          accessibilityLabel={t('more.search')}
          placeholder={t('more.search')}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          style={{ flex: 1, fontSize: 16, minHeight: 48 }}
        />
      </GlassSurface>
      {searching ? (
        hits.length === 0 ? (
          <Hint>{t('more.noMatch')}</Hint>
        ) : (
          <NavGroup>
            {hits.map((h, i) => (
              <NavRow
                key={`${h.value.guide ? 'g' : 'e'}-${i}`}
                icon={ENTRY_ICON[h.value.entry]}
                title={h.title}
                subtitle={h.subtitle}
                onPress={() => router.push(ENTRY_ROUTE[h.value.entry])}
              />
            ))}
          </NavGroup>
        )
      ) : (
        <View style={{ gap: 16 }}>
          {rows.length === 0 ? <Hint>{t('home.moreEmpty')}</Hint> : null}
          {rows.length > 0 && (
            <NavGroup>
              {rows.map((id) => (
                <NavRow
                  key={id}
                  icon={ENTRY_ICON[id]}
                  title={entryTitle(id)}
                  subtitle={entrySubtitle(id)}
                  onPress={() => router.push(ENTRY_ROUTE[id])}
                />
              ))}
            </NavGroup>
          )}
          <NavGroup>
            <NavRow icon="guide" title={t('nav.guide')} subtitle={t('guide.hint')} onPress={() => router.push('/guide')} />
            <NavRow icon="edit" title={t('home.editToday')} subtitle={t('home.editTodayHint')} onPress={() => router.push('/today/edit')} />
          </NavGroup>
        </View>
      )}
    </Screen>
  );
}
