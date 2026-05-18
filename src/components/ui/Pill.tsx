// ─────────────────────────────────────────────────────────────────
// Pill.tsx — status badges with optional dot.
//
// Pick a `tone` for color. Add `dot` for the status circle.
// Use this for: "In progress", "Urgent", "Silver member", "On site",
// "$2,840 LTV", etc. Replaces Catalyst <Badge> where you need tones.
//
//   <Pill tone="info" dot>Scheduled</Pill>
//   <Pill tone="danger" dot>Urgent</Pill>
//   <Pill tone="success">Paid</Pill>
//
// Tag is the same idea but rectangular, monospace — for codes like
// "PRT-CAP-3550", "T-04", "WO-3892".
// ─────────────────────────────────────────────────────────────────
import type { HTMLAttributes } from 'react';
import clsx from 'clsx';

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent' | 'violet';

export function Pill({
  tone = 'neutral',
  dot,
  className,
  children,
  ...p
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone; dot?: boolean }) {
  return (
    <span className={clsx('pill', tone, className)} {...p}>
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}

export function Tag({ className, ...p }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={clsx('tag', className)} {...p} />;
}
