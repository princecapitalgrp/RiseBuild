import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { PaletteC } from '@/design/tokens';
import { FontSize, FontWeight, LetterSpacing } from '@/design/typography';
import { sessionRepository } from '@/repositories/SessionRepository';
import { profileRepository } from '@/repositories/ProfileRepository';

/**
 * Root index — session detection gate.
 *
 * Routing logic (runs synchronously on mount — all reads are MMKV):
 *   authenticated     → UserProfile exists with onboardingCompleted=true → /(app)/today
 *   pending_onboarding → draft session key present, no completed profile → /onboarding
 *                        (OnboardingFlow restores to auth gate via fast-forward)
 *   none              → no draft, no profile → /onboarding (fresh start)
 *
 * The welcome screen is shown briefly while the router push resolves.
 */
export default function RootIndex() {
  const router = useRouter();

  useEffect(() => {
    // All reads are synchronous MMKV — no async needed
    const userProfile = profileRepository.getUserProfile();

    if (userProfile?.onboardingCompleted === true) {
      router.replace('/(app)/today');
      return;
    }

    // Pending onboarding (or fresh start) — go to onboarding
    // OnboardingFlow will restore mid-progress state if a draft exists
    router.replace('/onboarding');
  }, [router]);

  return (
    <View style={styles.container}>
      <View style={styles.logoMark}>
        <Text style={styles.logoText}>✦</Text>
      </View>
      <Text style={styles.heading}>Rise</Text>
      <Text style={styles.subheading}>by Solis</Text>
      <Text style={styles.tagline}>Your Personal Operating System</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PaletteC.deepCharcoal,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logoMark: {
    marginBottom: 24,
  },
  logoText: {
    fontSize: 40,
    color: PaletteC.dawnGold,
  },
  heading: {
    fontSize: FontSize.hero,
    fontWeight: FontWeight.bold,
    color: PaletteC.softCream,
    letterSpacing: LetterSpacing.tight,
  },
  subheading: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.regular,
    color: PaletteC.dawnGold,
    letterSpacing: LetterSpacing.wide,
    textTransform: 'uppercase',
    marginBottom: 32,
  },
  tagline: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.regular,
    color: PaletteC.dustyMocha,
    letterSpacing: LetterSpacing.wider,
    textTransform: 'uppercase',
  },
});
