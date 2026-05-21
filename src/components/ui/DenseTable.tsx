// ─────────────────────────────────────────────────────────────────
// DenseTable.tsx — thin wrappers over <table> with the tighter padding,
// sticky thead, monospace IDs, and two-line cell pattern this design
// uses everywhere.
//
//   <DenseTable>
//     <DenseTHead>
//       <tr><th>Job</th><th>Customer</th><th className="right">Value</th></tr>
//     </DenseTHead>
//     <tbody>
//       <DenseRow urgent={j.urgent}>
//         <td>
//           <CellStack>
//             <CellTop>{j.id}</CellTop>
//             <CellSub>{j.type}</CellSub>
//           </CellStack>
//         </td>
//         ...
//       </DenseRow>
//     </tbody>
//   </DenseTable>
//
// Mobile-card layout (< 640px) assumes the FIRST cell is the row's title
// and the LAST cell is the kebab. If you need leading-edge chrome —
// drag handle, checkbox, expand caret — put it INSIDE the first content
// cell as a flex sibling, not in its own column. A separate first-column
// cell will hijack the title slot on mobile.
// ─────────────────────────────────────────────────────────────────
import type { HTMLAttributes, KeyboardEvent, MouseEvent, ReactNode } from 'react';
import clsx from 'clsx';

export function DenseTable({ className, ...p }: HTMLAttributes<HTMLTableElement>) {
  return <table className={clsx('dense-table', className)} {...p} />;
}

export function DenseTHead(p: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...p} />;
}

export function DenseRow({
  urgent, className, onClick, onKeyDown, ...p
}: HTMLAttributes<HTMLTableRowElement> & { urgent?: boolean }) {
  const isClickable = typeof onClick === 'function';

  const handleKeyDown = (e: KeyboardEvent<HTMLTableRowElement>) => {
    // Caller's own keydown handler wins.
    onKeyDown?.(e);
    if (e.defaultPrevented) return;

    if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
      // Only activate when the row itself is focused — child interactives
      // (kebab buttons, links) own their own key handling.
      if (e.currentTarget !== e.target) return;
      e.preventDefault();
      onClick(e as unknown as MouseEvent<HTMLTableRowElement>);
    }
  };

  return (
    <tr
      className={clsx(urgent && 'urgent', isClickable && 'dense-row-interactive', className)}
      onClick={onClick}
      onKeyDown={isClickable ? handleKeyDown : onKeyDown}
      tabIndex={isClickable ? 0 : undefined}
      role={isClickable ? 'button' : undefined}
      {...p}
    />
  );
}

export function CellStack({ children }: { children: ReactNode }) {
  return <div className="cell-stack">{children}</div>;
}
export function CellTop({ children }: { children: ReactNode }) {
  return <span className="top">{children}</span>;
}
export function CellSub({ children }: { children: ReactNode }) {
  return <span className="bot">{children}</span>;
}
