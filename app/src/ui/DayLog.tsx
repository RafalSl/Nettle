import { Pressable } from 'react-native';
import { Text } from '@/ui/themed';
import { localDateTime } from '@/core/model/time';
import type { ListItem, SkinArea } from '@/core/model/types';
import type { LogRow } from '@/core/usecases/dayLog';
import { t } from '@/i18n';
import { Heading, Hint, styles } from '@/ui/components';
import { describeRow } from '@/ui/logRow';
import { NavRow } from '@/ui/NavRow';
import { useEntryActions } from '@/ui/useEntryActions';
import { color } from '@/ui/theme';

/** UX-2: Today shows this many of the day's newest entries and a "Show all (n)" row for the rest. */
export const TODAY_LOG_LIMIT = 8;

/**
 * UX-2, EN-1, UX-9: the day's log, newest entry first. The core lists a day oldest first, so a new entry is on top
 * and in view. A tap on a row offers Edit and Delete in one action sheet that names what goes with the entry.
 * With `limit`, only the newest entries show and "Show all (n)" calls `onShowAll`.
 */
export function DayLog({
  rows,
  ctx,
  onChanged,
  limit,
  onShowAll,
  highlight,
}: {
  rows: LogRow[];
  ctx: { areas: SkinArea[]; treatments: ListItem[]; categories: ListItem[] };
  /** Called after an entry was deleted, so the screen reloads. */
  onChanged: () => void;
  limit?: number;
  onShowAll?: () => void;
  /** Ids of entries to tint for a moment (UX-2: the row that was just added). */
  highlight?: ReadonlySet<string>;
}) {
  const openEntry = useEntryActions(onChanged);
  const newestFirst = [...rows].reverse();
  const shown = limit === undefined ? newestFirst : newestFirst.slice(0, limit);
  const onRow = (row: LogRow) => openEntry(row.kind, row.id, describeRow(row, ctx).title);

  return (
    <>
      <Heading>{t('day.logTitle')}</Heading>
      {rows.length === 0 && <Hint>{t('day.empty')}</Hint>}
      {shown.map((row) => {
        const { title, detail } = describeRow(row, ctx);
        const time = localDateTime(row.at.utc, row.at.tz).slice(11);
        return (
          <Pressable
            key={`${row.kind}-${row.id}`}
            accessibilityRole="button"
            accessibilityLabel={`${time} ${title}`}
            accessibilityHint={highlight?.has(row.id) ? t('day.newEntry') : undefined}
            onPress={() => void onRow(row)}
            style={({ pressed }) => [{ paddingVertical: 8 }, highlight?.has(row.id) && { backgroundColor: color.accentSoft, borderRadius: 8, paddingHorizontal: 6 }, pressed && { opacity: 0.6 }]}>
            <Text style={styles.rowText}>{`${time}  ${title}`}</Text>
            {detail ? <Hint>{detail}</Hint> : null}
          </Pressable>
        );
      })}
      {limit !== undefined && rows.length > limit && onShowAll && (
        <NavRow title={t('day.showAll', { n: rows.length })} onPress={onShowAll} />
      )}
    </>
  );
}
