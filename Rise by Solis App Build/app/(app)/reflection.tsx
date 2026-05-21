import { useRouter } from 'expo-router';
import { executionRepository } from '../../src/repositories/ExecutionRepository';
import { profileRepository } from '../../src/repositories/ProfileRepository';
import { ReflectionView } from '../../src/screens/reflection/ReflectionView';

export default function ReflectionRoute() {
  const router = useRouter();
  const execution = executionRepository.getLatestExecution();
  const profile = profileRepository.getOnboardingProfile();

  if (!execution || !profile) {
    router.replace('/(app)/(tabs)/today' as never);
    return null;
  }

  return (
    <ReflectionView
      executionRecord={execution}
      profile={profile}
      onComplete={() => router.replace('/(app)/(tabs)/today' as never)}
    />
  );
}
