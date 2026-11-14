import type { PdfRenderer } from '@/core/ports/platform';

/** Returns the HTML itself as the "PDF", so tests can read what would have been printed. */
export class FakePdf implements PdfRenderer {
  html: string[] = [];
  async renderHtml(html: string) {
    this.html.push(html);
    return new TextEncoder().encode(html);
  }
}
