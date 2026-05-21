import { View, Text, StyleSheet } from 'react-native';
import { PaletteC } from '@/design/tokens';
import { FontSize, FontWeight } from '@/design/typography';

/**
 * History — stub.
 * Phase 7: Reads past OperatingPlans from MMKV (PlanRepository.listRange).
 * No Firestore. MMKV only.
 */
export default function HistoryScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>History — Phase 7</Text>
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
