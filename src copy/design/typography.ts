/**
 * src/design/typography.ts
 * Font family constants and weight scale.
 * Using system fonts for Block 1 — custom fonts added in Phase 8 polish pass.
 */

export const FontFamily = {
  regular:  'System',
  medium:   'System',
  semibold: 'System',
  bold:     'System',
} as const;

export const FontWeight = {
  regular:  '400' as const,
  medium:   '500' as const,
  semibold: '600' as const,
  bold:     '700' as const,
} as const;

export const FontSize = {
  xs:   11,
  sm:   13,
  base: 15,
  md:   17,
  lg:   20,
  xl:   24,
  xxl:  30,
  hero: 38,
} as const;

export const LineHeight = {
  tight:   1.2,
  normal:  1.5,
  relaxed: 1.75,
} as const;

export const LetterSpacing = {
  tight:  -0.3,
  normal: 0,
  wide:   0.8,
  wider:  1.2,
} as const;
