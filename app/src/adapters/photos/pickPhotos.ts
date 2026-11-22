import * as ImagePicker from 'expo-image-picker';
import { NettleError } from '@/core/model/errors';

/**
 * Lets the user take or choose photos. Returns the temporary image URIs (none when cancelled). Throws
 * `photo_permission_denied` when the user refuses access, so the UI can explain it.
 */
export async function pickPhotoUris(source: 'camera' | 'library'): Promise<string[]> {
  const permission =
    source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new NettleError('photo_permission_denied');
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsMultipleSelection: true,
          quality: 1,
        });
  return result.canceled ? [] : result.assets.map((a) => a.uri);
}
