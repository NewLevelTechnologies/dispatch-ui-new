// ─────────────────────────────────────────────────────────────────
// ListFooter.tsx — table pagination + per-page selector.
//
//   <ListFooter
//     page={1} totalPages={6}
//     showing={[1, 25]} total={142}
//     perPage={25} onPerPageChange={setPerPage}
//     onPageChange={setPage}
//   />
//
// NOTE: ships with English placeholder strings ("Showing", "Prev",
// "Next", "Rows per page"). Pass translated values via the `labels`
// prop when wiring this into a localized page.
// ─────────────────────────────────────────────────────────────────
import type { ReactNode } from 'react';
import clsx from 'clsx';

type Labels = {
  showing?: (start: number, end: number, total: string) => ReactNode;
  prev?: ReactNode;
  next?: ReactNode;
  rowsPerPage?: ReactNode;
};

const DEFAULT_LABELS: Required<Labels> = {
  showing: (s, e, t) => (
    <>
      Showing <strong>{s}–{e}</strong> of {t}
    </>
  ),
  prev: '← Prev',
  next: 'Next →',
  rowsPerPage: 'Rows per page',
};

type Props = {
  page: number;
  totalPages: number;
  showing: [number, number];
  total: number;
  perPage?: number;
  perPageOptions?: number[];
  onPageChange?: (p: number) => void;
  onPerPageChange?: (n: number) => void;
  labels?: Labels;
  className?: string;
};

export function ListFooter({
  page, totalPages, showing, total,
  perPage = 25, perPageOptions = [25, 50, 100],
  onPageChange, onPerPageChange, labels, className,
}: Props) {
  const pages = pageWindow(page, totalPages);
  const l = { ...DEFAULT_LABELS, ...labels };
  return (
    <div className={clsx('list-footer', className)}>
      <span>{l.showing(showing[0], showing[1], total.toLocaleString())}</span>
      <span style={{ flex: 1 }} />
      <div className="flex gap-1">
        <button
          className="btn sm ghost"
          disabled={page <= 1}
          onClick={() => onPageChange?.(page - 1)}
          style={{ opacity: page <= 1 ? 0.4 : 1 }}
        >
          {l.prev}
        </button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={i} className="px-1 text-fg-dim">…</span>
          ) : (
            <button
              key={i}
              className={clsx('btn sm', p === page ? 'primary' : 'ghost', 'page-num')}
              onClick={() => onPageChange?.(p as number)}
            >
              {p}
            </button>
          )
        )}
        <button
          className="btn sm ghost"
          disabled={page >= totalPages}
          onClick={() => onPageChange?.(page + 1)}
          style={{ opacity: page >= totalPages ? 0.4 : 1 }}
        >
          {l.next}
        </button>
      </div>
      <span style={{ flex: 1 }} />
      <span>{l.rowsPerPage}</span>
      <select
        value={perPage}
        onChange={(e) => onPerPageChange?.(Number(e.target.value))}
      >
        {perPageOptions.map((n) => <option key={n}>{n}</option>)}
      </select>
    </div>
  );
}

// Show: 1 2 3 4 5 … N  with ellipsis when current page is far from edges.
function pageWindow(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, '…', total];
  if (current >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '…', current - 1, current, current + 1, '…', total];
}
