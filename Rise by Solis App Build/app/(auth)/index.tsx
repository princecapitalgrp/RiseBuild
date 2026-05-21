import { View, Text, StyleSheet } from 'react-native';
import { PaletteC } from '@/design/tokens';
import { FontSize, FontWeight } from '@/design/typography';

/**
 * Auth gate — stub.
 * Phase 4: Replace with Email + Google + Apple Sign In.
 * Reads PendingOnboardingSession from MMKV to pre-load archetype display.
 */
export default function AuthIndex() {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Auth Gate — Phase 4</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PaletteC.deepCharcoal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: PaletteC.dustyMocha,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
