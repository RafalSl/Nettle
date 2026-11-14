import type { KeyStore } from '../ports/keystore';
import type { LlmConfig, LlmProvider } from '../ports/llm';
import type { Notifier } from '../ports/notifier';
import type { SettingsStore } from '../ports/settings';
import type { Clock, IdGenerator, PdfRenderer, PhotoStore, RandomBytes } from '../ports/platform';
import type { StorageRepository } from '../ports/storage';

export interface Deps {
  repo: StorageRepository;
  ids: IdGenerator;
  clock: Clock;
  randomBytes: RandomBytes;
  photos: PhotoStore;
  /** EX-3: renders the report to PDF. */
  pdf: PdfRenderer;
  /** SK-9: local notifications. */
  notifier: Notifier;
  /** SE-2, SE-4: the API key store. */
  keys: KeyStore;
  /** LL-9: device settings such as the model name. */
  settings: SettingsStore;
  /** LL-10: builds the provider for a configuration (one adapter per provider). */
  llmFor: (config: LlmConfig) => LlmProvider;
}
