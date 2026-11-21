import { Pressable, View } from 'react-native';
import type { EntryType } from '@/core/model/preferences';
import { t } from '@/i18n';
import { ENTRY_ICON } from '@/ui/entryIcons';
import { entryTitle } from '@/ui/entryTypes';
import { GlassSurface } from '@/ui/GlassSurface';
import { Icon } from '@/ui/Icon';
import { Text } from '@/ui/themed';
import { color } from '@/ui/theme';

function Action({ label, icon, outline = false, onPress, onLongPress }: { label: string; icon: Parameters<typeof Icon>[0]['name']; outline?: boolean; onPress: () => void; onLongPress?: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} onLongPress={onLongPress} style={{ width: '33.33%', alignItems: 'center', gap: 6, paddingVertical: 6 }}>
      <GlassSurface raised style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', ...(outline ? { borderColor: color.accentLine, borderWidth: 1.5 } : {}) }}>
        <Icon name={icon} size={28} tint={outline ? color.accent : color.text} />
      </GlassSurface>
      <Text style={{ fontSize: 13, fontWeight: '600', color: color.soft, textAlign: 'center' }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * UX-2: up to five pinned entry types and More, in a grid of three. A tap opens the entry's quick sheet or form; a
 * long press opens its full form (the quick sheet's "Other or earlier…" is the tap alternative).
 */
export function QuickActions({ pinned, onOpen, onFull, onMore }: { pinned: EntryType[]; onOpen: (id: EntryType) => void; onFull: (id: EntryType) => void; onMore: () => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {pinned.map((id) => (
        <Action key={id} label={entryTitle(id)} icon={ENTRY_ICON[id]} onPress={() => onOpen(id)} onLongPress={() => onFull(id)} />
      ))}
      <Action label={t('home.more')} icon="dots" outline onPress={onMore} />
    </View>
  );
}
