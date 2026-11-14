import { useSyncExternalStore } from 'react';
import type { AnalysisRun } from '@/core/usecases/analysisRunner';
import { useServices } from '@/services';

/** LL-12: the current analysis run, re-rendering whenever it changes. */
export function useAnalysisRun(): AnalysisRun {
  const { analysisRunner } = useServices();
  return useSyncExternalStore(analysisRunner.subscribe, () => analysisRunner.state);
}
