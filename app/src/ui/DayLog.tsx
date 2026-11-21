import { View } from 'react-native';
import { localDateTime } from '@/core/model/time';
import type { ListItem, SkinArea } from '@/core/model/types';
import type { LogRow } from '@/core/usecases/dayLog';
import { t } from '@/i18n';
import { Heading, Hint } from '@/ui/components';
import { KIND_ENTRY, ENTRY_ICON } from '@/ui/entryIcons';
import { LogRowView } from '@/ui/LogRowView';
import { describeRow } from '@/ui/logRow';
import { NavRow } from '@/ui/NavRow';
import { useEntryActions, useEntryDelete } from '@/ui/useEntryActions';

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
  const deleteRow = useEntryDelete(onChanged);
  const newestFirst = [...rows].reverse();
  const shown = limit === undefined ? newestFirst : newestFirst.slice(0, limit);
  const onRow = (row: LogRow) => openEntry(row.kind, row.id, describeRow(row, ctx).title);

  return (
    <>
      <Heading>{t('day.logTitle')}</Heading>
      {rows.length === 0 && <Hint>{t('day.empty')}</Hint>}
      <View style={{ gap: 8 }}>
        {shown.map((row) => {
          const { title, detail } = describeRow(row, ctx);
          const time = localDateTime(row.at.utc, row.at.tz).slice(11);
          return (
            <LogRowView
              key={`${row.kind}-${row.id}`}
              icon={ENTRY_ICON[KIND_ENTRY[row.kind]]}
              title={title}
              detail={detail}
              time={time}
              label={`${time} ${title}`}
              hint={highlight?.has(row.id) ? t('day.newEntry') : undefined}
              highlighted={highlight?.has(row.id)}
              onPress={() => void onRow(row)}
              onDelete={() => void deleteRow(row.kind, row.id, title)}
            />
          );
        })}
      </View>
      {limit !== undefined && rows.length > limit && onShowAll && (
        <NavRow title={t('day.showAll', { n: rows.length })} onPress={onShowAll} />
      )}
    </>
  );
}
