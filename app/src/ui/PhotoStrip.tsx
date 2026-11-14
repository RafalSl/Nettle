import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, View } from 'react-native';
import { pickPhotoUris } from '@/adapters/photos/pickPhotos';
import type { Photo, PhotoEntryKind } from '@/core/model/types';
import { addPhoto, listPhotos, removePhoto, setPhotoSensitive } from '@/core/usecases/photos';
import { errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { confirmDestructive } from '@/ui/actionSheet';
import { Button, Hint } from '@/ui/components';

/**
 * SK-4, SK-5: the photos of one entry. Sensitive photos are blurred until tapped, the sensitive flag can be
 * changed per photo, and photos are added from the camera or the library.
 */
export function PhotoStrip({ entryKind, entryId }: { entryKind: PhotoEntryKind; entryId: string }) {
  const { deps } = useServices();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [shown, setShown] = useState<Set<string>>(new Set());

  const reload = useCallback(() => {
    listPhotos(deps, entryKind, entryId).then(setPhotos);
  }, [deps, entryKind, entryId]);
  useEffect(reload, [reload]);

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      reload();
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  };

  const add = (source: 'camera' | 'library') =>
    run(async () => {
      for (const uri of await pickPhotoUris(source)) await addPhoto(deps, { entryKind, entryId, sourceUri: uri });
    });

  const current = photos.find((p) => p.id === selected);

  return (
    <View style={{ gap: 6 }}>
      {photos.length === 0 ? (
        <Hint>{t('photos.none')}</Hint>
      ) : (
        <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
          {photos.map((p) => {
            const hidden = p.sensitive && !shown.has(p.id);
            return (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                accessibilityLabel={hidden ? t('photos.tapToShow') : p.at.utc}
                onPress={() => {
                  setSelected(p.id);
                  if (p.sensitive) setShown((s) => new Set(s).add(p.id));
                }}
                style={{ borderWidth: p.id === selected ? 2 : 0, borderColor: '#208AEF' }}>
                <Image source={{ uri: deps.photos.uri(p.file) }} blurRadius={hidden ? 30 : 0} style={{ width: 88, height: 88 }} />
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      {current && (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Button
            kind="secondary"
            title={current.sensitive ? t('photos.sensitive') : t('photos.notSensitive')}
            onPress={() => run(() => setPhotoSensitive(deps, current.id, !current.sensitive))}
          />
          <Button
            kind="danger"
            title={t('photos.remove')}
            onPress={async () => {
              // UX-9: an action sheet with the destructive choice first and Cancel last.
              if (await confirmDestructive({ title: t('photos.removeTitle'), message: t('photos.removeBody'), action: t('photos.remove') })) {
                setSelected(null);
                await run(() => removePhoto(deps, current.id));
              }
            }}
          />
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Button kind="secondary" title={t('photos.camera')} onPress={() => add('camera')} />
        <Button kind="secondary" title={t('photos.library')} onPress={() => add('library')} />
      </View>
    </View>
  );
}
