/**
 * src/screens/onboarding/ConsentScreen.tsx
 *
 * Privacy consent screen. Rendered by app/onboarding/index.tsx before
 * OnboardingFlow mounts. Not part of the onboarding machine.
 *
 * Shown once: if OnboardingProfile.consentTimestamp already exists the
 * parent skips this screen entirely.
 *
 * On agree:
 *   1. Writes ISO timestamp to MMKV key 'solis.consent.timestamp' via
 *      sessionRepository.setConsentTimestamp().
 *   2. Calls onAgree() — parent renders OnboardingFlow.
 *
 * The timestamp is later read by onboardingMachine.saveOnboardingComplete
 * and written permanently into OnboardingProfile.consentTimestamp.
 *
 * Design: Palette C (dark surface) — same as the welcome/archetype screens.
 * No back navigation. No skip option.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Linking,
} from 'react-native';
import { PaletteC } from '../../design/tokens';
import { sessionRepository } from '../../repositories/SessionRepository';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ConsentScreenProps {
  onAgree: () => void;
}

// ─── Privacy policy URL ───────────────────────────────────────────────────────
// Placeholder — will be live before TestFlight submission.

const PRIVACY_POLICY_URL = 'https://risebysolis.com/privacy';

// ─── Component ────────────────────────────────────────────────────────────────

export function ConsentScreen({ onAgree }: ConsentScreenProps) {

  const handleAgree = () => {
    sessionRepository.setConsentTimestamp(new Date().toISOString());
    onAgree();
  };

  const handlePrivacyPolicy = () => {
    Linking.openURL(PRIVACY_POLICY_URL).catch(() => {
      // Silently ignore — URL will be live before TestFlight
    });
  };

  return (
    <View style={styles.root}>
      <View style={styles.content}>

        {/* Heading */}
        <Text style={styles.heading}>Before we begin</Text>

        {/* Body copy */}
        <Text style={styles.body}>
          Rise by Solis is built around one principle: your data belongs to you.
        </Text>

        <Text style={styles.body}>
          What we collect: your morning patterns, daily state, and the weights you choose to share. Everything stays on this device.
        </Text>

        <Text style={styles.body}>
          What leaves your device: only the shape of your data — never the content. Your words never reach our servers.
        </Text>

        <Text style={styles.body}>
          Who we are: [your name/entity], contactable at [email].
        </Text>

        <Text style={styles.body}>
          You can delete everything at any time from Settings.
        </Text>

      </View>

      {/* Actions */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.agreeButton}
          onPress={handleAgree}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="I understand and agree"
        >
          <Text style={styles.agreeLabel}>I understand and agree</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.privacyLink}
          onPress={handlePrivacyPolicy}
          activeOpacity={0.7}
          accessibilityRole="link"
          accessibilityLabel="Read our privacy policy"
        >
          <Text style={styles.privacyLinkLabel}>Read our privacy policy</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PaletteC.deepCharcoal,
    paddingHorizontal: 28,
    paddingTop: Platform.OS === 'ios' ? 72 : 48,
    paddingBottom: Platform.OS === 'ios' ? 44 : 28,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: 20,
  },
  heading: {
    fontSize: 34,
    fontWeight: '700',
    color: PaletteC.softCream,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  body: {
    fontSize: 16,
    color: PaletteC.warmSand,
    lineHeight: 26,
  },
  footer: {
    gap: 12,
  },
  agreeButton: {
    paddingVertical: 16,
    backgroundColor: PaletteC.dawnGold,
    borderRadius: 14,
    alignItems: 'center',
  },
  agreeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: PaletteC.deepCharcoal,
  },
  privacyLink: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  privacyLinkLabel: {
    fontSize: 14,
    color: PaletteC.dustyMocha,
    textDecorationLine: 'underline',
  },
});
