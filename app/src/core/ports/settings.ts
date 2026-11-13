/** Small device settings that are not secrets and not part of an export (LL-9: the model name). */
export interface SettingsStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}
