import { useRouter } from 'expo-router';
import { profileRepository } from '../../src/repositories/ProfileRepository';
import { checkInRepository } from '../../src/repositories/CheckInRepository';
import { CheckInFlow } from '../../src/components/checkin/CheckInFlow';
import type { RawCheckIn } from '../../domain/types';

export default function CheckInRoute() {
  const router = useRouter();
  const profile = profileRepository.getOnboardingProfile();

  const handleComplete = (checkIn: RawCheckIn) => {
    checkInRepository.saveCheckIn(checkIn);
    router.replace('/(app)/(tabs)/today' as never);
  };

  return (
    <CheckInFlow
      profile={profile}
      onComplete={handleComplete}
    />
  );
}
