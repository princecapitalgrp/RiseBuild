import { View, Text, StyleSheet } from 'react-native';
import { PaletteC } from '@/design/tokens';
import { FontSize, FontWeight } from '@/design/typography';

/**
 * Today / dashboard — stub.
 * Phase 5: Reads today's OperatingPlan from MMKV.
 *   If plan exists → render PlanView.
 *   If no plan    → render "Begin Your Morning" CTA → push checkin/.
 */
export default function TodayScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Today — Phase 5</Text>
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
