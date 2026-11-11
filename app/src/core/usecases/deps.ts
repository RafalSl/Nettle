import type { Clock, IdGenerator } from '../ports/platform';
import type { StorageRepository } from '../ports/storage';

export interface Deps {
  repo: StorageRepository;
  ids: IdGenerator;
  clock: Clock;
}
