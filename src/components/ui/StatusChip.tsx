// ─────────────────────────────────────────────────────────────────
// StatusChip.tsx — small chip representing a workflow status.
//
// Shared primitive used wherever a status appears as a chip
// (transition rows, approval queue, callouts). Two sizes:
//   · `sm` — 11px text, 6px dot · in dense list rows
//   · `lg` — 13px text, 8px dot · in detail headers and callouts
//
// Accent is resolved through `roleAccent(accentId, name)` so a tenant's
// status palette flows through without each caller having to map.
// ─────────────────────────────────────────────────────────────────
import clsx from 'clsx';
import { roleAccent } from '../../utils/roleColor';

type StatusLike = {
  id?: string;
  name: string;
  accentId: string;
};

type Size = 'sm' | 'lg';

export function StatusChip({
  status,
  size = 'sm',
  className,
}: {
  status: StatusLike;
  size?: Size;
  className?: string;
}) {
  const dotPx = size === 'lg' ? 8 : 6;
  return (
    <span
      className={clsx(
        'inline-flex items-center whitespace-nowrap rounded-md border border-border bg-bg-elev font-medium text-fg-strong',
        size === 'lg' ? 'gap-1.5 px-2.5 py-1 text-[13px]' : 'gap-1 px-1.5 py-0.5 text-[11px]',
        className,
      )}
    >
      <span
        aria-hidden
        className="rounded-full"
        style={{
          width: dotPx,
          height: dotPx,
          background: roleAccent(status.accentId, status.name),
        }}
      />
      {status.name}
    </span>
  );
}
