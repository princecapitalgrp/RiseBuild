import { View, Text, StyleSheet } from 'react-native';
import { PaletteC } from '@/design/tokens';
import { FontSize, FontWeight } from '@/design/typography';

/**
 * Settings — stub.
 * Phase 7: Privacy controls, sync opt-in, account section.
 * theWeight operational rules apply — no user data ever surfaced here.
 */
export default function SettingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Settings — Phase 7</Text>
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
