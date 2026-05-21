/**
 * app/onboarding/index.tsx
 *
 * Onboarding route — mounts ConsentScreen then OnboardingFlow.
 * Handles the full 7-step question flow → archetype reveal → auth gate → complete.
 *
 * Consent gate logic (runs synchronously on mount — all reads are MMKV):
 *   1. Check profileRepository.getOnboardingProfile()?.consentTimestamp
 *   2. If present: skip ConsentScreen, mount OnboardingFlow directly
 *      (returning user or same-device restore after purge — already consented)
 *   3. If absent: render ConsentScreen first
 *      On agree: ConsentScreen writes 'solis.consent.timestamp' via sessionRepository,
 *      then sets consentGiven state → OnboardingFlow mounts
 *
 * OnboardingFlow is responsible for:
 *   - Detecting and restoring a mid-onboarding draft after app purge
 *   - Machine state management (XState)
 *   - All MMKV writes during onboarding
 *   - Reading 'solis.consent.timestamp' and writing it into OnboardingProfile
 *     on auth complete (via saveOnboardingComplete machine action)
 */

import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';
import { ConsentScreen } from '@/screens/onboarding/ConsentScreen';
import { profileRepository } from '@/repositories/ProfileRepository';

export default function OnboardingIndex() {
  const router = useRouter();

  // Check synchronously on first render — MMKV read, no async needed.
  const alreadyConsented =
    (profileRepository.getOnboardingProfile()?.consentTimestamp ?? null) !== null;

  const [consentGiven, setConsentGiven] = useState(alreadyConsented);

  if (!consentGiven) {
    return (
      <ConsentScreen
        onAgree={() => setConsentGiven(true)}
      />
    );
  }

  return (
    <OnboardingFlow
      onComplete={() => {
        // Replace the onboarding stack so back navigation goes to today, not back here
        router.replace('/(app)/today');
      }}
    />
  );
}
