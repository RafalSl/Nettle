import type { LOG_KINDS, LogRow } from '@/core/usecases/dayLog';

type LogKind = (typeof LOG_KINDS)[number];

/** EN-1: the record an edit form opens with. */
export type Rec<K extends LogKind> = Extract<LogRow, { kind: K }>['record'];

/** EN-1: what every edit form receives. */
export interface EditProps<K extends LogKind> {
  r: Rec<K>;
}
