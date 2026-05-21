/**
 * src/design/shadows.ts
 * iOS shadow definitions using StyleSheet.create.
 * Shadow properties require StyleSheet — not NativeWind — on iOS.
 */
import { StyleSheet } from 'react-native';
import { PaletteC } from './tokens';

export const Shadows = StyleSheet.create({
  none: {},

  sm: {
    shadowColor: PaletteC.deepCharcoal,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 2,
  },

  md: {
    shadowColor: PaletteC.deepCharcoal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
  },

  lg: {
    shadowColor: PaletteC.deepCharcoal,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
  },

  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },

  accent: {
    shadowColor: '#C9A54C',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
});
