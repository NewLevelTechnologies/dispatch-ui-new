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
import { Heading } from '../catalyst/heading';
import { Text } from '../catalyst/text';

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
        <Heading level={1} size="page-lg" className="m-0">{title}</Heading>
        {sub && <Text size="sm" tone="muted" className="mt-0.5">{sub}</Text>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
