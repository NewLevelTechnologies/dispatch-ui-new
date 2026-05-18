// Deterministic per-role accent color.
//
// Customers create their own roles, so a hardcoded name → color map
// would break for every custom role. Instead we hash the role name
// into a curated palette: same role name always lands on the same
// color, custom roles get a color automatically with no admin effort.
//
// Palette is intentionally small (10) and tuned so every entry reads
// at similar visual weight against bg-elev — coral and indigo should
// feel like siblings, not "one is shouting".
const ROLE_PALETTE = [
  'oklch(60% 0.14 25)',   // coral
  'oklch(60% 0.14 50)',   // amber
  'oklch(60% 0.13 85)',   // yellow-green
  'oklch(60% 0.14 145)',  // green
  'oklch(60% 0.14 195)',  // teal
  'oklch(60% 0.14 230)',  // blue
  'oklch(60% 0.14 270)',  // indigo
  'oklch(60% 0.14 300)',  // violet
  'oklch(60% 0.14 340)',  // magenta
  'oklch(60% 0.08 80)',   // warm gray — rest stop, low chroma on purpose
];

export function roleColor(roleName: string): string {
  let h = 0;
  for (let i = 0; i < roleName.length; i++) {
    h = (h * 31 + roleName.charCodeAt(i)) | 0;
  }
  return ROLE_PALETTE[Math.abs(h) % ROLE_PALETTE.length];
}
