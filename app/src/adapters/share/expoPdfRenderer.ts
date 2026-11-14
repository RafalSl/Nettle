import { File } from 'expo-file-system';
import * as Print from 'expo-print';
import type { PdfRenderer } from '@/core/ports/platform';

/** A4 in points. The temporary file is deleted as soon as it has been read (it may contain health data). */
export const expoPdfRenderer: PdfRenderer = {
  async renderHtml(html) {
    const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
    const file = new File(uri);
    try {
      return await file.bytes();
    } finally {
      if (file.exists) file.delete();
    }
  },
};
