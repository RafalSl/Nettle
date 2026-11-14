import { getRandomBytes, randomUUID } from 'expo-crypto';
import { getCalendars } from 'expo-localization';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { openExpoSqlite } from '@/adapters/storage/expoSqliteDb';
import { createAnthropicProvider } from '@/adapters/llm/anthropicProvider';
import { secureStoreKeyStore } from '@/adapters/keystore/secureStoreKeyStore';
import { SqliteRepo } from '@/adapters/storage/sqliteRepo';
import { SqliteSettings } from '@/adapters/storage/sqliteSettings';
import { expoPhotoStore } from '@/adapters/photos/expoPhotoStore';
import { expoNotifier } from '@/adapters/notifications/expoNotifier';
import { expoFileShare } from '@/adapters/share/expoFileShare';
import { expoPdfRenderer } from '@/adapters/share/expoPdfRenderer';
import type { FileShare } from '@/core/ports/platform';
import type { Deps } from '@/core/usecases/deps';
import { AnalysisRunner } from '@/core/usecases/analysisRunner';
import { t } from '@/i18n';

export interface Services {
  deps: Deps;
  fileShare: FileShare;
  /** LL-12: the analysis run lives here, not in a screen, so it survives leaving the screen. */
  analysisRunner: AnalysisRunner;
}

const Ctx = createContext<Services | null>(null);

export const useServices = (): Services => {
  const s = useContext(Ctx);
  if (!s) throw new Error('ServicesProvider missing');
  return s;
};

/** Composition root: the only place that wires concrete adapters to the core. */
export function ServicesProvider({ children }: { children: ReactNode }) {
  const [services, setServices] = useState<Services | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = await openExpoSqlite();
        const repo = await SqliteRepo.open(db);
        const deps: Deps = {
          repo,
          ids: randomUUID,
          randomBytes: getRandomBytes,
          photos: expoPhotoStore,
          pdf: expoPdfRenderer,
          notifier: expoNotifier,
          keys: secureStoreKeyStore,
          settings: new SqliteSettings(db),
          llmFor: createAnthropicProvider,
          clock: { now: () => new Date(), timeZone: () => getCalendars()[0]?.timeZone ?? 'UTC' },
        };
        if (!cancelled) setServices({ deps, fileShare: expoFileShare, analysisRunner: new AnalysisRunner(deps) });
      } catch {
        // Deliberately no error details: they could include user data.
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <Text>{t('common.loadingFailed')}</Text>
      </View>
    );
  }
  if (!services) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  return <Ctx.Provider value={services}>{children}</Ctx.Provider>;
}
