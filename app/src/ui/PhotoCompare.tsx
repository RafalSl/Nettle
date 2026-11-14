import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import type { Photo } from '@/core/model/types';
import { localDateTime } from '@/core/model/time';
import { t } from '@/i18n';
import { useServices } from '@/services';
import { Hint, styles } from '@/ui/components';

/**
 * SK-8, UX-1: two photos side by side, the earlier one on the left, each with its date and what was logged with it.
 * A sensitive photo stays blurred until tapped, as everywhere else.
 */
export function PhotoCompare({ photos }: { photos: readonly { photo: Photo; caption: string }[] }) {
  const { deps } = useServices();
  const [shown, setShown] = useState<Set<string>>(new Set());
  const ordered = [...photos].sort((a, b) => a.photo.at.utc.localeCompare(b.photo.at.utc));
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {ordered.map(({ photo, caption }) => {
          const hidden = photo.sensitive && !shown.has(photo.id);
          return (
            <Pressable key={photo.id} style={{ flex: 1, gap: 4 }} accessibilityRole="button" accessibilityLabel={hidden ? t('photos.tapToShow') : `${localDateTime(photo.at.utc, photo.at.tz)} ${caption}`.trim()} onPress={() => setShown((s) => new Set(s).add(photo.id))}>
              <Image source={{ uri: deps.photos.uri(photo.file) }} blurRadius={hidden ? 30 : 0} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 8 }} />
              <Text style={styles.label}>{localDateTime(photo.at.utc, photo.at.tz)}</Text>
              {caption ? <Hint>{caption}</Hint> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
