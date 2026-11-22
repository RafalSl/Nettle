import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { defaultPreferences, ENTRY_TYPES, MAX_PINNED, type EntryType } from '@/core/model/preferences';
import { getPreferences, movePinnedEntryType, pinEntryType, unpinEntryType } from '@/core/usecases/preferences';
import { errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { Hint, Label, Screen } from '@/ui/components';
import { ENTRY_ICON } from '@/ui/entryIcons';
import { entrySubtitle, entryTitle } from '@/ui/entryTypes';
import { GlassSurface } from '@/ui/GlassSurface';
import { Icon, type IconName } from '@/ui/Icon';
import { IconCircle } from '@/ui/IconCircle';
import { Text } from '@/ui/themed';
import { color } from '@/ui/theme';

function Round({ icon, label, disabled = false, onPress }: { icon: IconName; label: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      onPress={disabled ? undefined : onPress}
      hitSlop={4}
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: color.glassFillRaised,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.35 : 1,
      }}
    >
      <Icon name={icon} size={18} wash={false} stroke={2} />
    </Pressable>
  );
}

/**
 * UX-2: "Edit Today". Two lists, On Today and In More, with Up and Down buttons to reorder and a button to move an
 * entry type between them (no dragging). At most 5 are pinned; Pin is disabled at 5 and says why. More itself is
 * always on Today and has no row here.
 */
export default function EditTodayScreen() {
  const { deps } = useServices();
  const [pinned, setPinned] = useState<EntryType[]>(defaultPreferences().quickActions.pinned);
  useFocusEffect(
    useCallback(() => {
      getPreferences(deps).then(
        (p) => setPinned(p.quickActions.pinned),
        (e) => Alert.alert(errorMessage(e)),
      );
    }, [deps]),
  );
  const run = (action: () => Promise<EntryType[]>) => action().then(setPinned, (e) => Alert.alert(errorMessage(e)));
  const full = pinned.length >= MAX_PINNED;
  const inMore = ENTRY_TYPES.filter((id) => !pinned.includes(id));

  const row = (id: EntryType, buttons: React.ReactNode) => (
    <GlassSurface
      key={id}
      style={{
        borderRadius: 999,
        paddingVertical: 8,
        paddingLeft: 8,
        paddingRight: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <IconCircle name={ENTRY_ICON[id]} size={40} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15.5, fontWeight: '600' }}>{entryTitle(id)}</Text>
        <Text style={{ fontSize: 13, color: color.muted }} numberOfLines={1}>
          {entrySubtitle(id)}
        </Text>
      </View>
      {buttons}
    </GlassSurface>
  );

  return (
    <Screen>
      <Hint>{t('home.editTodayHint')}</Hint>
      <Label>{t('home.pinned')}</Label>
      <View style={{ gap: 8 }}>
        {pinned.map((id) =>
          row(
            id,
            <>
              <Round
                icon="up"
                label={`${t('home.moveUp')} ${entryTitle(id)}`}
                onPress={() => void run(() => movePinnedEntryType(deps, id, -1))}
              />
              <Round
                icon="down"
                label={`${t('home.moveDown')} ${entryTitle(id)}`}
                onPress={() => void run(() => movePinnedEntryType(deps, id, 1))}
              />
              <Round icon="x" label={`${t('home.unpin')} ${entryTitle(id)}`} onPress={() => void run(() => unpinEntryType(deps, id))} />
            </>,
          ),
        )}
      </View>
      <Hint>{t('home.moreFixed')}</Hint>
      <Label>{t('home.inMore')}</Label>
      {full && inMore.length > 0 ? <Hint>{t('errors.too_many_pinned')}</Hint> : null}
      <View style={{ gap: 8 }}>
        {inMore.map((id) =>
          row(
            id,
            <Round
              icon="plus"
              label={`${t('home.pin')} ${entryTitle(id)}`}
              disabled={full}
              onPress={() => void run(() => pinEntryType(deps, id))}
            />,
          ),
        )}
      </View>
    </Screen>
  );
}
