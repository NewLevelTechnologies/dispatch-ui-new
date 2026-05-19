import clsx from 'clsx'
import type React from 'react'

// Label · value · action row. Used inside <Card> on settings-style surfaces
// (AccountSettings Security / Preferences, UserDetail Security card).
//
//   <DataRow label="Password" action={<Button outline size="xs">Change</Button>}>
//     <span className="text-[12.5px] text-fg-strong">Set Aug 14, 2022</span>
//   </DataRow>
//
// `last` drops the bottom border for the final row in a stack.
export function DataRow({
  label,
  action,
  last,
  className,
  children,
}: {
  label: React.ReactNode
  action?: React.ReactNode
  last?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={clsx(
        className,
        'grid grid-cols-[140px_1fr_auto] items-center gap-3.5 py-2.5',
        !last && 'border-b border-border-soft'
      )}
    >
      <div className="text-[11.5px] font-medium text-fg-muted">{label}</div>
      <div className="min-w-0">{children}</div>
      {action ? <div>{action}</div> : <div />}
    </div>
  )
}
