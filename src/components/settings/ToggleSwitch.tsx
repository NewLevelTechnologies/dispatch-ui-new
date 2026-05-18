import clsx from 'clsx';

type Props = {
  on: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
  size?: 'sm' | 'md';
};

export function ToggleSwitch({ on, onChange, disabled, ariaLabel, size = 'md' }: Props) {
  const dims = size === 'sm'
    ? { w: 'w-7', h: 'h-4', dot: 'h-3 w-3', dotOn: 'translate-x-3', dotOff: 'translate-x-0.5' }
    : { w: 'w-9', h: 'h-5', dot: 'h-3.5 w-3.5', dotOn: 'translate-x-4', dotOff: 'translate-x-0.5' };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onChange?.(!on)}
      className={clsx(
        'relative inline-flex shrink-0 items-center rounded-full border transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/50 focus-visible:ring-offset-1',
        dims.w, dims.h,
        on
          ? 'bg-accent-500 border-accent-700'
          : 'bg-bg-active border-border',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <span
        className={clsx(
          'inline-block rounded-full bg-white shadow transition-transform',
          dims.dot,
          on ? dims.dotOn : dims.dotOff,
        )}
      />
    </button>
  );
}
