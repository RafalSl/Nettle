import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { FileShare } from '@/core/ports/platform';

/** Share sheet for export (EX-9) and document picker for import (EX-10). */
export const expoFileShare: FileShare = {
  async saveAndShare(fileName, bytes, mimeType) {
    const file = new File(Paths.cache, fileName);
    if (file.exists) file.delete();
    file.create();
    await file.write(bytes);
    try {
      await Sharing.shareAsync(file.uri, { mimeType });
    } finally {
      // The export may contain sensitive data: do not leave it in the cache.
      if (file.exists) file.delete();
    }
  },

  async pickFile(kind = 'zip') {
    const result = await DocumentPicker.getDocumentAsync({
      type: kind === 'json' ? ['application/json', 'text/plain'] : ['application/zip', 'application/x-zip-compressed'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return null;
    const file = new File(result.assets[0]!.uri);
    try {
      return await file.bytes();
    } finally {
      if (file.exists) file.delete();
    }
  },
};
