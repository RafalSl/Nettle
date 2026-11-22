import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { SqlDb } from '@/adapters/storage/sqlDb';

/** Test-only SqlDb over Node's built-in SQLite (no native build needed on Linux). */
export function createNodeSqliteDb(): SqlDb {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  return {
    exec: async (sql) => {
      db.exec(sql);
    },
    run: async (sql, params = []) => {
      db.prepare(sql).run(...(params as SQLInputValue[]));
    },
    all: async <T>(sql: string, params: (string | number | null)[] = []) => db.prepare(sql).all(...(params as SQLInputValue[])) as T[],
    transaction: async (fn) => {
      db.exec('BEGIN');
      try {
        await fn();
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}
