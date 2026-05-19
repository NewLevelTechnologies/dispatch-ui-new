import clsx from 'clsx'
import type React from 'react'

// Surfaced card primitive used across the redesigned v1.5 pages — replaces the
// `FormCard` / `ACard` shadows that lived inside UserFormPage and
// AccountSettingsPage. Dimensions match the dense look (13px title, p-3.5
// body); the optional `subtitle` slot is the long-form helper line some
// sections use under the title.
export function Card({
  title,
  subtitle,
  className,
  children,
}: {
  title?: React.ReactNode
  subtitle?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  const hasHeader = title || subtitle
  return (
    <div className={clsx(className, 'rounded-[10px] border border-border bg-bg-elev')}>
      {hasHeader && (
        <div className="border-b border-border-soft px-3.5 py-2.5">
          {title && <div className="text-[13px] font-semibold text-fg-strong">{title}</div>}
          {subtitle && <div className="mt-0.5 text-[11px] text-fg-muted">{subtitle}</div>}
        </div>
      )}
      <div className="p-3.5">{children}</div>
    </div>
  )
}
