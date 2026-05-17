import type { HTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';
import { Card, CardBody, CardHead, CardTitle } from '../ui/Card';

type Props = HTMLAttributes<HTMLDivElement> & {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  flush?: boolean;
  bodyClassName?: string;
};

export function SettingsSection({
  title,
  subtitle,
  action,
  flush,
  className,
  bodyClassName,
  children,
  ...rest
}: Props) {
  const hasHead = title || action;
  return (
    <Card className={className} {...rest}>
      {hasHead && (
        <CardHead>
          <div className="min-w-0">
            {title && <CardTitle>{title}</CardTitle>}
            {subtitle && (
              <div className="text-[11.5px] text-fg-muted mt-0.5">{subtitle}</div>
            )}
          </div>
          {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
        </CardHead>
      )}
      <CardBody flush={flush} className={clsx(bodyClassName)}>
        {children}
      </CardBody>
    </Card>
  );
}

export function SettingsSectionLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        'text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-muted',
        className,
      )}
    >
      {children}
    </div>
  );
}
