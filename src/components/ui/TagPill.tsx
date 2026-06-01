// ─────────────────────────────────────────────────────────────────
// TagPill.tsx — a tenant tag rendered as a tinted-fill pill.
//
// Single source for tag chrome across the app: detail-page Tags cards,
// the inline tag picker, and the (read-only) Customers / Locations list
// rows. Maps the tag's color enum to a `.pill` tone (see utils/tagColor)
// so the fill matches the status-badge intensity — no raw color values.
//
//   <TagPill color={tag.color} name={tag.name} />                       ← read-only
//   <TagPill color={tag.color} name={tag.name} onRemove={…} removeLabel={…} />  ← editable
// ─────────────────────────────────────────────────────────────────
import clsx from 'clsx';
import { tagPillTone } from '../../utils/tagColor';

interface TagPillProps {
  /** The tag's color enum (NEUTRAL, INFO, ACCENT_1, …). Off-enum → neutral. */
  color: string | null | undefined;
  name: string;
  /** When provided, renders a × that calls this (editable contexts only). */
  onRemove?: () => void;
  /** Accessible label for the remove button — required when onRemove is set. */
  removeLabel?: string;
  /** Extra classes on the pill (e.g. a max-width cap for dense list rows). */
  className?: string;
}

export function TagPill({ color, name, onRemove, removeLabel, className }: TagPillProps) {
  return (
    <span className={clsx('pill', tagPillTone(color), className)}>
      <span className="min-w-0 truncate">{name}</span>
      {onRemove && (
        <button
          type="button"
          aria-label={removeLabel}
          onClick={onRemove}
          className="-mr-1 ml-0.5 rounded-full px-0.5 leading-none opacity-60 hover:opacity-100"
        >
          ×
        </button>
      )}
    </span>
  );
}

export default TagPill;
