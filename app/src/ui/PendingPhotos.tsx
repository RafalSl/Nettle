import { Image, Pressable, ScrollView, View } from 'react-native';
import { pickPhotoUris } from '@/adapters/photos/pickPhotos';
import { t } from '@/i18n';
import { Button, Hint, Label } from '@/ui/components';
import { showError } from '@/ui/showError';

/**
 * SK-4: photos picked in a Skin or Nails form. They are only chosen here; they are saved with the entry when the
 * form is saved (or with "No change"), so Cancel leaves nothing behind. Tap a thumbnail to drop it.
 */
export function PendingPhotos({ uris, onChange }: { uris: string[]; onChange: (next: string[]) => void }) {
  const add = async (source: 'camera' | 'library') => {
    try {
      onChange([...uris, ...(await pickPhotoUris(source))]);
    } catch (e) {
      showError(e);
    }
  };
  return (
    <View style={{ gap: 6 }}>
      <Label>{t('photos.title')}</Label>
      {uris.length === 0 ? (
        <Hint>{t('photos.formHint')}</Hint>
      ) : (
        <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
          {uris.map((uri, i) => (
            <Pressable
              key={`${uri}-${i}`}
              accessibilityRole="button"
              accessibilityLabel={`${t('photos.drop')} ${i + 1}`}
              onPress={() => onChange(uris.filter((_, j) => j !== i))}
            >
              <Image source={{ uri }} style={{ width: 88, height: 88 }} />
            </Pressable>
          ))}
        </ScrollView>
      )}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Button kind="secondary" title={t('photos.camera')} onPress={() => void add('camera')} />
        <Button kind="secondary" title={t('photos.library')} onPress={() => void add('library')} />
      </View>
    </View>
  );
}
