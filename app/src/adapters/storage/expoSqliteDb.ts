import * as SQLite from 'expo-sqlite';
import type { SqlDb, SqlValue } from './sqlDb';

/** Production SqlDb over expo-sqlite (included in Expo Go). */
export async function openExpoSqlite(name = 'nettle.db'): Promise<SqlDb> {
  const db = await SQLite.openDatabaseAsync(name);
  // Per-connection pragmas; foreign_keys has no effect inside a transaction, so set it up front.
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  // Transactions run one after another: SQLite refuses a BEGIN inside a transaction that is still open.
  let tail: Promise<unknown> = Promise.resolve();
  return {
    exec: (sql) => db.execAsync(sql),
    run: async (sql, params: SqlValue[] = []) => {
      await db.runAsync(sql, params);
    },
    all: <T>(sql: string, params: SqlValue[] = []) => db.getAllAsync<T>(sql, params),
    // Non-exclusive transaction: runs on this same connection, which keeps foreign_keys on, so plain statements
    // issued meanwhile join it. Fine for one user, one UI; an exclusive one would need a transaction-scoped SqlDb.
    transaction: (fn) => {
      const run = tail.then(() => db.withTransactionAsync(fn));
      tail = run.catch(() => undefined);
      return run;
    },
  };
}
