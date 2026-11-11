import * as SQLite from 'expo-sqlite';
import type { SqlDb, SqlValue } from './sqlDb';

/** Production SqlDb over expo-sqlite (included in Expo Go). */
export async function openExpoSqlite(name = 'nettle.db'): Promise<SqlDb> {
  const db = await SQLite.openDatabaseAsync(name);
  // Per-connection pragmas; foreign_keys has no effect inside a transaction, so set it up front.
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  return {
    exec: (sql) => db.execAsync(sql),
    run: async (sql, params: SqlValue[] = []) => {
      await db.runAsync(sql, params);
    },
    all: <T>(sql: string, params: SqlValue[] = []) => db.getAllAsync<T>(sql, params),
    // Non-exclusive transaction: runs on this same connection, which keeps foreign_keys on. Fine for one user, one UI.
    transaction: (fn) => db.withTransactionAsync(fn),
  };
}
