/**
 * src/design/tokens.ts
 * Rise by Solis — Design System Tokens
 *
 * Two palettes from the brand identity.
 * Use Palette B for warm/light surfaces and onboarding warmth.
 * Use Palette C for dark mode, night surfaces, and the primary app shell.
 *
 * Import from here — never hardcode hex values in components.
 */

/** Palette B — Amber Core. Warm cream and amber tones. */
export const PaletteB = {
  warmCream:    '#FAF8F4',
  warmStone:    '#F5F0E8',
  dustyLinen:   '#E8DED0',
  amberMist:    '#D4B896',
  dawnGold:     '#C9A54C',
  dustyOchre:   '#C8A96E',
  mutedAmber:   '#D4963A',
  warmWalnut:   '#8C6B3E',
  deepBrown:    '#3A2E28',
  richCharcoal: '#2A2420',
} as const;

/** Palette C — Charcoal Sun. Dark surfaces with warm amber accents. Primary app palette. */
export const PaletteC = {
  deepCharcoal:  '#2A2420',
  warmGraphite:  '#3D3530',
  smokyBrown:    '#524840',
  dustyMocha:    '#655A50',
  warmSand:      '#E8DED0',
  softCream:     '#FAF7F2',
  dawnGold:      '#C9A54C',
  amberGlow:     '#E8956A',
  paleApricot:   '#F2C99A',
} as const;

/**
 * Semantic color aliases. Use these in components — not raw palette values.
 * This level of indirection lets us retheme without touching components.
 */
export const Colors = {
  // Backgrounds
  background:        PaletteC.deepCharcoal,
  surface:           PaletteC.warmGraphite,
  surfaceElevated:   PaletteC.smokyBrown,

  // Text
  textPrimary:       PaletteC.softCream,
  textSecondary:     PaletteC.warmSand,
  textMuted:         PaletteC.dustyMocha,

  // Brand
  accent:            PaletteC.dawnGold,
  accentWarm:        PaletteC.amberGlow,
  accentSoft:        PaletteC.paleApricot,

  // States
  selected:          PaletteC.dawnGold,
  selectedBorder:    PaletteC.dawnGold,
  disabled:          PaletteC.warmGraphite,

  // Trust signal
  trustBuilding:     PaletteC.dawnGold,
  trustStable:       PaletteC.warmSand,
  trustEroding:      '#9F5050',

  // Borders
  border:            PaletteC.warmGraphite,
  borderSubtle:      PaletteC.smokyBrown,
} as const;

export type PaletteBKey = keyof typeof PaletteB;
export type PaletteCKey = keyof typeof PaletteC;
export type ColorKey = keyof typeof Colors;
