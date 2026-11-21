import { getRandomBytes, randomUUID } from 'expo-crypto';
import { getCalendars } from 'expo-localization';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Text } from '@/ui/themed';
import { openExpoSqlite } from '@/adapters/storage/expoSqliteDb';
import { DayStart } from '@/core/model/dayStart';
import { ANTHROPIC_MODELS, createAnthropicProvider } from '@/adapters/llm/anthropicProvider';
import { secureStoreKeyStore } from '@/adapters/keystore/secureStoreKeyStore';
import { SqliteRepo } from '@/adapters/storage/sqliteRepo';
import { SqliteSettings } from '@/adapters/storage/sqliteSettings';
import { expoPhotoStore } from '@/adapters/photos/expoPhotoStore';
import { expoNotifier } from '@/adapters/notifications/expoNotifier';
import { openFoodFacts } from '@/adapters/barcode/openFoodFacts';
import { expoAuthenticator } from '@/adapters/auth/expoAuthenticator';
import { AppLock } from '@/core/usecases/appLock';
import { expoFileShare } from '@/adapters/share/expoFileShare';
import { expoPdfRenderer } from '@/adapters/share/expoPdfRenderer';
import type { FileShare } from '@/core/ports/platform';
import type { Deps } from '@/core/usecases/deps';
import { AnalysisRunner } from '@/core/usecases/analysisRunner';
import { setLanguage, t } from '@/i18n';

export interface Services {
  deps: Deps;
  fileShare: FileShare;
  /** LL-12: the analysis run lives here, not in a screen, so it survives leaving the screen. */
  analysisRunner: AnalysisRunner;
  /** SE-8: the app lock; locked from the first frame after a cold start when it is on. */
  appLock: AppLock;
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
        const prefs = await repo.getPreferences();
        setLanguage(prefs?.language ?? 'system'); // UX-7: before anything is drawn in the app language
        const deps: Deps = {
          repo,
          ids: randomUUID,
          randomBytes: getRandomBytes,
          photos: expoPhotoStore,
          pdf: expoPdfRenderer,
          notifier: expoNotifier,
          barcode: openFoodFacts,
          auth: expoAuthenticator,
          keys: secureStoreKeyStore,
          settings: new SqliteSettings(db),
          dayStart: new DayStart(prefs?.dayStartHour ?? 0),
          llmFor: createAnthropicProvider,
          llmModels: ANTHROPIC_MODELS,
          clock: { now: () => new Date(), timeZone: () => getCalendars()[0]?.timeZone ?? 'UTC' },
        };
        const appLock = new AppLock(deps);
        await appLock.init(); // before any content is shown, so a cold start never flashes the diary
        if (!cancelled) setServices({ deps, fileShare: expoFileShare, analysisRunner: new AnalysisRunner(deps), appLock });
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
