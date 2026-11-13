import { getRandomBytes, randomUUID } from 'expo-crypto';
import { getCalendars } from 'expo-localization';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { openExpoSqlite } from '@/adapters/storage/expoSqliteDb';
import { SqliteRepo } from '@/adapters/storage/sqliteRepo';
import { expoPhotoStore } from '@/adapters/photos/expoPhotoStore';
import { expoFileShare } from '@/adapters/share/expoFileShare';
import type { FileShare } from '@/core/ports/platform';
import type { Deps } from '@/core/usecases/deps';
import { t } from '@/i18n';

export interface Services {
  deps: Deps;
  fileShare: FileShare;
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
        const repo = await SqliteRepo.open(await openExpoSqlite());
        const deps: Deps = {
          repo,
          ids: randomUUID,
          randomBytes: getRandomBytes,
          photos: expoPhotoStore,
          clock: { now: () => new Date(), timeZone: () => getCalendars()[0]?.timeZone ?? 'UTC' },
        };
        if (!cancelled) setServices({ deps, fileShare: expoFileShare });
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
