import { useState } from 'react';
import { Image, Pressable, ScrollView } from 'react-native';
import type { Photo } from '@/core/model/types';
import { t } from '@/i18n';
import { useServices } from '@/services';

/** SK-5, SK-8: read-only thumbnails; sensitive photos stay blurred until tapped. */
export function PhotoThumbs({ photos }: { photos: Photo[] }) {
  const { deps } = useServices();
  const [shown, setShown] = useState<Set<string>>(new Set());
  if (photos.length === 0) return null;
  return (
    <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
      {photos.map((p) => {
        const hidden = p.sensitive && !shown.has(p.id);
        return (
          <Pressable
            key={p.id}
            accessibilityRole="button"
            accessibilityLabel={hidden ? t('photos.tapToShow') : p.at.utc}
            onPress={() => setShown((s) => new Set(s).add(p.id))}>
            <Image source={{ uri: deps.photos.uri(p.file) }} blurRadius={hidden ? 30 : 0} style={{ width: 88, height: 88 }} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
