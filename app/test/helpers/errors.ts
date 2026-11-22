import { NettleError } from '@/core/model/errors';

/** The NettleError code a promise rejects with, 'other' for any other error, or 'no error' when it resolves. */
export const errorCode = async (p: Promise<unknown>): Promise<string> =>
  p.then(
    () => 'no error',
    (e: unknown) => (e instanceof NettleError ? e.code : 'other'),
  );
