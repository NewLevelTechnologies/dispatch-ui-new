import { useTranslation } from 'react-i18next';
import {
  type ProgressCategory,
  type WorkItemSummaryProjection,
} from '../api';

// Tailwind utility classes for the per-work-item status dot. Mirrors the
// PROGRESS_COLORS Badge map but maps to bg-* utilities since Catalyst's
// Badge is too tall for inline list rendering inside a dense table cell.
const PROGRESS_DOT_CLASS: Record<ProgressCategory, string> = {
  NOT_STARTED: 'bg-zinc-300 dark:bg-zinc-600',
  IN_PROGRESS: 'bg-blue-500',
  BLOCKED: 'bg-amber-500',
  COMPLETED: 'bg-lime-500',
  CANCELLED: 'bg-zinc-300 dark:bg-zinc-600',
};

const PROGRESS_TRANSLATION_KEYS: Record<ProgressCategory, string> = {
  NOT_STARTED: 'notStarted',
  IN_PROGRESS: 'inProgress',
  BLOCKED: 'blocked',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

// Cap on how many work items render inline before collapsing the rest
// into a "+N more" indicator. Backend caps at 5; UI cap of 3 keeps row
// height in check on dense lists. The "+N more" count uses the
// unbounded `totalCount` so it's correct even when the server projection
// itself was truncated.
const WORK_ITEMS_INLINE_CAP = 3;

interface Props {
  items: WorkItemSummaryProjection[];
  /** Unbounded total — drives the "+N more" indicator regardless of
   *  whether the server truncated the projection (server caps at 5). */
  totalCount: number;
}

/**
 * Compact stack of work item descriptions with a colored status dot per
 * line. Used on the WO list page (main + scoped variants) to answer
 * "what is this WO about" — the highest-signal scan target on the list.
 *
 * Renders an em-dash placeholder when the WO has no items so the column
 * stays visually present (avoids ragged-right rows).
 */
export default function WorkItemsCell({ items, totalCount }: Props) {
  const { t } = useTranslation();
  if (totalCount === 0 || items.length === 0) {
    return <span className="text-zinc-400 dark:text-zinc-600">—</span>;
  }
  const visible = items.slice(0, WORK_ITEMS_INLINE_CAP);
  const overflow = totalCount - visible.length;
  return (
    <div className="flex max-w-[28rem] flex-col gap-0.5">
      {visible.map((wi, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span
            aria-label={t(
              `workOrders.progress.${PROGRESS_TRANSLATION_KEYS[wi.statusCategory]}`
            )}
            className={`size-1.5 shrink-0 rounded-full ${PROGRESS_DOT_CLASS[wi.statusCategory]}`}
          />
          <span className="truncate text-zinc-700 dark:text-zinc-300">
            {wi.description}
          </span>
        </div>
      ))}
      {overflow > 0 && (
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {t('workOrders.table.workItemsMore', { count: overflow })}
        </span>
      )}
    </div>
  );
}
