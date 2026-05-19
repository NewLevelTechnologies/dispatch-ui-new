import clsx from 'clsx'
import type React from 'react'

// Label · value · action row. Designed to live inside `<Card padding="none">`
// so the row's px-3.5 produces edge-to-edge bottom dividers aligned with the
// card's title-header padding.
//
//   <Card title="Security" padding="none">
//     <DataRow label="Password" action={<Button outline size="xs">Change</Button>}>
//       <span className="text-[12.5px] text-fg-strong">Set Aug 14, 2022</span>
//     </DataRow>
//   </Card>
//
// `last` drops the bottom border for the final row in a stack.
// `labelWidth` overrides the default 140px label column. Common widths in the
// codebase: 90 (Roles/Regions rows), 110 (UserDetail Security), 140 (default,
// AccountSettings).
export function DataRow({
  label,
  action,
  last,
  labelWidth = 140,
  className,
  children,
}: {
  label: React.ReactNode
  action?: React.ReactNode
  last?: boolean
  labelWidth?: number
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={clsx(
        className,
        'grid items-center gap-3.5 px-3.5 py-2.5',
        !last && 'border-b border-border-soft'
      )}
      style={{ gridTemplateColumns: `${labelWidth}px 1fr auto` }}
    >
      <div className="text-[11.5px] font-medium text-fg-muted">{label}</div>
      <div className="min-w-0">{children}</div>
      {action ? <div>{action}</div> : <div />}
    </div>
  )
}
