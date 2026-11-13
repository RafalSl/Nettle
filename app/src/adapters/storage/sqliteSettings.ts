import type { SettingsStore } from '@/core/ports/settings';
import type { SqlDb } from './sqlDb';

/** Device settings in the app database (table `app_setting`, created by migration 8; open the repo first). */
export class SqliteSettings implements SettingsStore {
  constructor(private readonly db: SqlDb) {}

  async get(key: string) {
    const [row] = await this.db.all<{ value: string }>('SELECT value FROM app_setting WHERE key = ?', [key]);
    return row?.value ?? null;
  }
  async set(key: string, value: string) {
    await this.db.run(
      'INSERT INTO app_setting (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, value],
    );
  }
  async delete(key: string) {
    await this.db.run('DELETE FROM app_setting WHERE key = ?', [key]);
  }
}
