import { Image, Pressable, View } from 'react-native';
import { t } from '@/i18n';
import { Button } from '@/ui/components';
import { Icon } from '@/ui/Icon';
import { Text } from '@/ui/themed';
import { color } from '@/ui/theme';
import { useServices } from '@/services';

export interface PhotoGridItem {
  id: string;
  /** The accessibility label and caption, for example "Chin 2026-01-12 20:00". */
  label: string;
  /** The stored file name (resolved to a path by the photo store). */
  file: string;
  sensitive: boolean;
}

/**
 * EX-4, EX-7, SK-5, UX-12: a three-column grid to pick photos from: each cell has a check badge when picked, a
 * sensitive photo is blurred with a lock and starts unselected, and Select all and None sit above (Select all
 * leaves sensitive photos out: they are included only by an explicit tap).
 */
export function PhotoGrid({
  items,
  selected,
  onToggle,
  onAll,
  onNone,
}: {
  items: PhotoGridItem[];
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onAll?: () => void;
  onNone?: () => void;
}) {
  const { deps } = useServices();
  return (
    <View style={{ gap: 10 }}>
      {onAll && onNone ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button kind="secondary" title={t('photos.selectAll')} onPress={onAll} />
          <Button kind="secondary" title={t('photos.selectNone')} onPress={onNone} />
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {items.map((p) => {
          const on = selected.has(p.id);
          return (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              accessibilityLabel={p.label}
              accessibilityState={{ selected: on }}
              onPress={() => onToggle(p.id)}
              style={{ width: '32%', aspectRatio: 1 }}
            >
              <Image
                source={{ uri: deps.photos.uri(p.file) }}
                blurRadius={p.sensitive ? 30 : 0}
                style={{
                  flex: 1,
                  borderRadius: 18,
                  borderWidth: on ? 2.5 : 0,
                  borderColor: color.accent,
                  backgroundColor: color.glassFill,
                }}
              />
              {p.sensitive ? (
                <View
                  style={{
                    position: 'absolute',
                    right: 6,
                    top: 6,
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: color.sheetFill,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="lock" size={13} wash={false} stroke={2} />
                </View>
              ) : null}
              {on ? (
                <View
                  style={{
                    position: 'absolute',
                    left: 6,
                    bottom: 6,
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: color.accent,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="check" size={15} tint={color.onAccent} stroke={2.8} wash={false} />
                </View>
              ) : null}
              {p.sensitive && !on ? (
                <Text style={{ position: 'absolute', left: 6, bottom: 6, fontSize: 11, color: color.soft }}>{t('photos.leftOut')}</Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
