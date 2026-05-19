import clsx from 'clsx'
import type React from 'react'

// Surfaced card primitive used across the redesigned v1.5 pages — replaces the
// `FormCard` / `ACard` shadows that lived inside UserFormPage and
// AccountSettingsPage. Dimensions match the dense look (13px title, p-3.5
// body).
//
//   <Card title="Profile">                  ← form fields inside, default padding
//   <Card title="Security" padding="none">  ← row-based body (DataRow handles px)
//   <Card footer={<CapabilityDetail/>}>     ← extra section below the body
//     with its own border-top divider (CapabilityDetail provides it)
export function Card({
  title,
  subtitle,
  footer,
  padding = 'default',
  className,
  children,
}: {
  title?: React.ReactNode
  subtitle?: React.ReactNode
  // Rendered below the body without padding — consumer brings its own
  // divider/background. Used for expandable detail panels that need to span
  // edge-to-edge inside the card border.
  footer?: React.ReactNode
  // `'none'` removes body padding for row-based bodies (DataRow, feed rows)
  // that manage their own px so dividers reach the card edges.
  padding?: 'default' | 'none'
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
      <div className={padding === 'none' ? undefined : 'p-3.5'}>{children}</div>
      {footer}
    </div>
  )
}
