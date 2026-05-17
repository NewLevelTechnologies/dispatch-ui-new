import type { ReactNode } from 'react';
import clsx from 'clsx';

export function FieldLabel({
  required,
  hint,
  children,
  className,
}: {
  required?: boolean;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('mb-1 flex items-baseline gap-1.5 text-[11.5px] font-semibold text-fg-muted', className)}>
      <span>
        {children}
        {required && <span className="ml-0.5 text-danger-500">*</span>}
      </span>
      {hint && (
        <span className="font-normal text-fg-dim">· {hint}</span>
      )}
    </div>
  );
}

export function FieldHelp({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('mt-1 text-[11px] text-fg-dim leading-snug', className)}>
      {children}
    </div>
  );
}

export function FieldValue({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('text-[13px] text-fg-strong', className)}>
      {children}
    </div>
  );
}
