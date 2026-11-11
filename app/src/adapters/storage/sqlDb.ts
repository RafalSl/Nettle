export type SqlValue = string | number | null;

/**
 * The only thing the repository needs from a SQLite driver (like a tiny database/sql in Go).
 * Production wraps expo-sqlite; tests wrap Node's built-in node:sqlite.
 * `transaction` must run its callback's statements on the same connection and roll back if it throws.
 */
export interface SqlDb {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlValue[]): Promise<void>;
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  transaction(fn: () => Promise<void>): Promise<void>;
}
