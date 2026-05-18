// ─────────────────────────────────────────────────────────────────
// PageHead.tsx — title + subtitle + actions row at top of every page.
//
//   <PageHead
//     title="Jobs"
//     sub="38 open · 4 urgent · 14 scheduled today"
//     actions={<>
//       <Button variant="ghost">Export</Button>
//       <Button>New job</Button>
//     </>}
//   />
// ─────────────────────────────────────────────────────────────────
import type { ReactNode } from 'react';

export function PageHead({
  title, sub, actions,
}: {
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3 mb-4">
      <div>
        <h1 className="text-[22px] font-bold text-fg-strong tracking-[-0.02em] m-0">{title}</h1>
        {sub && <div className="text-[12.5px] text-fg-muted mt-0.5">{sub}</div>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
