import type { Clock, IdGenerator, RandomBytes } from '../ports/platform';
import type { StorageRepository } from '../ports/storage';

export interface Deps {
  repo: StorageRepository;
  ids: IdGenerator;
  clock: Clock;
  randomBytes: RandomBytes;
}
