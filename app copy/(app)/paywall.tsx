import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { planRepository } from '../../src/repositories/PlanRepository';
import { PaywallScreen } from '../../src/screens/paywall/PaywallScreen';
import type { OperatingPlan } from '../../domain/types';

export default function PaywallRoute() {
  const router = useRouter();
  const [plan, setPlan] = useState<OperatingPlan | null>(null);

  useEffect(() => {
    setPlan(planRepository.getLatestPlan());
  }, []);

  return (
    <PaywallScreen
      plan={plan}
      onSubscribed={() => router.replace('/(app)/(tabs)/today' as never)}
      onGraceContinue={() => router.replace('/(app)/(tabs)/today' as never)}
    />
  );
}
