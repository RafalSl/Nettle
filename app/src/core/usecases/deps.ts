import type { Clock, IdGenerator, PhotoStore, RandomBytes } from '../ports/platform';
import type { StorageRepository } from '../ports/storage';

export interface Deps {
  repo: StorageRepository;
  ids: IdGenerator;
  clock: Clock;
  randomBytes: RandomBytes;
  photos: PhotoStore;
}
