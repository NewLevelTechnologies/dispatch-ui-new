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
// ─────────────────────────────────────────────────────────────────
import type { HTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

export function DenseTable({ className, ...p }: HTMLAttributes<HTMLTableElement>) {
  return <table className={clsx('dense-table', className)} {...p} />;
}

export function DenseTHead(p: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...p} />;
}

export function DenseRow({
  urgent, className, ...p
}: HTMLAttributes<HTMLTableRowElement> & { urgent?: boolean }) {
  return <tr className={clsx(urgent && 'urgent', className)} {...p} />;
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
