import { markExported, presetOptions } from '@/core/usecases/backup';
import type { Deps } from '@/core/usecases/deps';
import { exportBundle } from '@/core/usecases/exchange';
import type { FileShare } from '@/core/ports/platform';
import { t } from '@/i18n';
import { chooseAction } from '@/ui/actionSheet';

/** A full backup (records, settings, every photo; no password) handed to the share sheet, and noted as the last export. */
export async function exportEverything(deps: Deps, fileShare: FileShare): Promise<void> {
  const stamp = deps.clock.now().toISOString().slice(0, 10);
  await fileShare.saveAndShare(
    `nettle-export-${stamp}.zip`,
    await exportBundle(deps, presetOptions({ kind: 'backup' })),
    'application/zip',
  );
  await markExported(deps);
}

/**
 * UX-6, UX-9, SE-9: a destructive action sheet that offers "Export first". Choosing it exports and then asks
 * again, so the person can go on once the backup is safe. Resolves true only when the destructive action is chosen.
 */
export async function confirmWithExport(opts: {
  title: string;
  message: string;
  action: string;
  exportNow: () => Promise<void>;
  onExportError: (e: unknown) => void;
}): Promise<boolean> {
  for (;;) {
    const choice = await chooseAction({
      title: opts.title,
      message: opts.message,
      actions: [{ label: t('delete.exportFirst') }, { label: opts.action, destructive: true }],
    });
    if (choice === 0) {
      try {
        await opts.exportNow();
      } catch (e) {
        opts.onExportError(e);
      }
      continue; // ask again: the person decides after the export
    }
    return choice === 1;
  }
}
