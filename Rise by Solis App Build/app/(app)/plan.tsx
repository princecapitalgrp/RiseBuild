import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

import { planRepository } from '../../src/repositories/PlanRepository';
import { executionRepository } from '../../src/repositories/ExecutionRepository';
import { PlanView } from '../../src/screens/execution/PlanView';
import { PaletteB } from '../../src/design/tokens';
import { todayKey } from '../../src/storage/keys';
import type { ExecutionTracker } from '../../src/engine/ExecutionTracker';
import type { OperatingPlan } from '../../domain/types';

export default function PlanRoute() {
  const router = useRouter();
  const [plan, setPlan] = useState<OperatingPlan | null>(null);

  useEffect(() => {
    const todayPlan = planRepository.getTodayPlan();
    if (!todayPlan) {
      router.replace('/(app)/(tabs)/today' as never);
      return;
    }
    setPlan(todayPlan);
  }, []);

  const intention = (() => {
    const record = executionRepository.getExecution(todayKey());
    return record?.morning_intention ?? null;
  })();

  const handleSessionComplete = useCallback((_tracker: ExecutionTracker) => {
    router.replace('/(app)/(tabs)/today' as never);
  }, [router]);

  const handleAbandon = useCallback(() => {
    router.back();
  }, [router]);

  if (!plan) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={PaletteB.warmWalnut} />
      </View>
    );
  }

  return (
    <PlanView
      plan={plan}
      intention={intention}
      onSessionComplete={handleSessionComplete}
      onAbandon={handleAbandon}
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: PaletteB.warmCream,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
