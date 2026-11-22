import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Pressable } from 'react-native';
import { Text } from '@/ui/themed';
import { defaultPreferences, type Preferences } from '@/core/model/preferences';
import { getPreferences, removeFavorite } from '@/core/usecases/preferences';
import { errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { Heading, Hint, styles } from '@/ui/components';

type Kind = 'meals' | 'drinks' | 'medications';

/** IN-14, UX-6: the starred meals, drinks, medications and supplements; a tap removes one. */
export function FavoritesSection() {
  const { deps } = useServices();
  const [prefs, setPrefs] = useState<Preferences>(defaultPreferences());
  const reload = useCallback(() => {
    getPreferences(deps).then(setPrefs, (e) => Alert.alert(errorMessage(e)));
  }, [deps]);
  useFocusEffect(reload);

  const groups: { kind: Kind; title: string; rows: { key: string; label: string }[] }[] = [
    { kind: 'meals', title: t('settings.favMeals'), rows: prefs.favorites.meals.map((m) => ({ key: m.key, label: m.description })) },
    {
      kind: 'drinks',
      title: t('settings.favDrinks'),
      rows: prefs.favorites.drinks.map((d) => ({ key: d.key, label: `${d.name} ${d.amountMl} ml` })),
    },
    {
      kind: 'medications',
      title: t('settings.favMedications'),
      rows: prefs.favorites.medications.map((m) => ({ key: m.key, label: m.dose ? `${m.name} ${m.dose}` : m.name })),
    },
  ];
  const none = groups.every((g) => g.rows.length === 0);
  return (
    <>
      <Hint>{t('settings.favHint')}</Hint>
      {none && <Hint>{t('settings.favNone')}</Hint>}
      {groups
        .filter((g) => g.rows.length > 0)
        .map((g) => (
          <React.Fragment key={g.kind}>
            <Heading>{g.title}</Heading>
            {g.rows.map((r) => (
              <Pressable
                key={r.key}
                accessibilityRole="button"
                accessibilityLabel={t('settings.favRemove', { name: r.label })}
                onPress={() => removeFavorite(deps, g.kind, r.key).then(reload, (e) => Alert.alert(errorMessage(e)))}
                style={{ paddingVertical: 8 }}
              >
                <Text style={styles.rowText}>{`★ ${r.label}`}</Text>
              </Pressable>
            ))}
          </React.Fragment>
        ))}
    </>
  );
}
