import { roleAccent } from '../utils/roleColor';

// Small dot + role name chip used in the user-detail header and
// Roles + Regions card. One component, one source of truth for size
// and color, so the two render sites stay visually identical.
//
// `accentId` is the persisted color token on the role record. When set,
// it wins over the name-hash fallback so renaming a role doesn't reshuffle
// its color. Callers that only have a name (legacy audit-log rows, etc.)
// can omit it; the chip falls back to the hash.
export function RoleChip({ name, accentId }: { name: string; accentId?: string | null }) {
  const color = roleAccent(accentId, name);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-[2px] text-[11px] font-semibold"
      style={{
        background: `color-mix(in oklch, ${color} 14%, var(--bg-elev))`,
        color,
      }}
    >
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      {name}
    </span>
  );
}

export default RoleChip;
