// ─────────────────────────────────────────────────────────────────
// Avatar.tsx — colored initials circle.
//
// The background hue is derived from the name so each person gets
// a stable color across the app without you assigning one. Two-letter
// initials from first + last name.
//
//   <Avatar name="Tanya Reyes" />
//   <Avatar name="Daniel Park" size="lg" />
//
// If you have profile pictures, pass `src` and they'll be used instead.
// ─────────────────────────────────────────────────────────────────
import type { CSSProperties } from 'react';
import clsx from 'clsx';

// Stable hue from name — 9 well-spaced hues that look good in both
// light and dark themes when used as oklch(60% 0.14 H).
//
// TODO(design-system): align with `utils/roleColor.ts`. The sidebar user
// widget (AppLayout) and AccountSettings's profile avatar both pick their
// background via `roleColor()`, which uses a 10-color full-hash palette,
// while this component uses its own 2-char-hash 9-HUE palette. Same person
// gets two different avatar colors across surfaces. Pick one (roleColor is
// the more-used utility) and have Avatar consume it, or expose a `bg` prop
// so callers can pass `roleColor(name)` explicitly.
const HUES = [25, 200, 270, 150, 320, 50, 230, 110, 8];

function bgFromName(name: string) {
  const a = name.charCodeAt(0) || 0;
  const b = name.charCodeAt(1) || 0;
  const h = HUES[(a + b) % HUES.length];
  return `oklch(60% 0.14 ${h})`;
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts[1]?.[0] ?? '';
  return (first + last).toUpperCase();
}

type Props = {
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
};

export function Avatar({ name, src, size = 'md', className }: Props) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={clsx('avatar object-cover', size !== 'md' && size, className)}
        style={{ borderColor: 'var(--border-strong)' }}
      />
    );
  }
  return (
    <div
      className={clsx('avatar', size !== 'md' && size, className)}
      style={{ '--av-bg': bgFromName(name) } as CSSProperties}
      aria-label={name}
    >
      {initialsFromName(name)}
    </div>
  );
}
