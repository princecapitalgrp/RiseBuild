/**
 * src/screens/today/TodayScreen.tsx
 *
 * The daily entry point. Reads today's state from MMKV and renders one of
 * four display states. No external data fetch on mount — all reads are local.
 *
 * Display states:
 *   A — not checked in          → "Begin your morning" CTA
 *   B — checked in, no plan     → "Generate protocol" CTA (with inline loading)
 *   C — plan exists, not done   → plan preview card + "Continue your morning"
 *   D — session completed       → quiet completion state, no CTA
 *
 * Paywall gate (days ≥ 14 && not subscribed):
 *   First decline  → inline soft gate with "Maybe Later"
 *   Grace used     → hard navigate to /(app)/paywall
 *
 * Design: Palette B Amber Core — warm cream surfaces, Georgia greeting,
 * deepBrown card buttons. No streaks, no metrics, no optimization language.
 *
 * Navigation targets wired in Task 3:
 *   /(app)/checkin   — check-in flow
 *   /(app)/plan      — PlanView
 *   /(app)/paywall   — full paywall screen
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { checkInRepository } from '../../repositories/CheckInRepository';
import { executionRepository } from '../../repositories/ExecutionRepository';
import { memoryRepository } from '../../repositories/MemoryRepository';
import { planRepository } from '../../repositories/PlanRepository';
import { profileRepository } from '../../repositories/ProfileRepository';
import { sessionRepository } from '../../repositories/SessionRepository';
import { subscriptionService } from '../../services/SubscriptionService';
import { generateMorningPlan } from '../../engine/PersonalizationEngine';
import { PaletteB } from '../../design/tokens';
import { FontSize, FontWeight } from '../../design/typography';
import { todayKey } from '../../storage/keys';
import type { Archetype, OperatingPlan } from '../../../domain/types';

// ─── Greeting table ───────────────────────────────────────────────────────────

function getGreeting(archetype: Archetype | undefined | null): string {
  const hour = new Date().getHours();

  if (hour >= 12) {
    return 'The morning has passed.\nTomorrow is still yours.';
  }

  if (hour < 8) {
    switch (archetype) {
      case 'Architect': return 'The morning has structure.';
      case 'Alchemist': return 'Something is waiting to be finished.';
      case 'Sentinel':  return 'Start with the ground beneath you.';
      case 'Tide':      return 'The morning comes at its own pace.';
      default:          return 'Good morning.';
    }
  }

  // 8am–noon
  switch (archetype) {
    case 'Architect': return 'The day is taking shape.';
    case 'Alchemist': return 'What have you already moved?';
    case 'Sentinel':  return 'How is your footing?';
    case 'Tide':      return 'Where is the current running?';
    default:          return 'Good morning.';
  }
}

// ─── Plan duration helper ─────────────────────────────────────────────────────

function totalMinutes(plan: OperatingPlan): number {
  return plan.mainSequence.reduce((sum, step) => sum + step.durationMinutes, 0);
}

// ─── Display state ────────────────────────────────────────────────────────────

type ScreenState =
  | { tag: 'loading' }
  | { tag: 'paywall_soft' }
  | { tag: 'A' }                              // not checked in
  | { tag: 'B'; generating: boolean }         // checked in, no plan
  | { tag: 'C'; plan: OperatingPlan }         // plan exists, incomplete
  | { tag: 'D'; yesterdayTitle: string | null }; // session complete

// ─── Component ────────────────────────────────────────────────────────────────

export function TodayScreen() {
  const router = useRouter();
  const [screen, setScreen] = useState<ScreenState>({ tag: 'loading' });
  const [greeting, setGreeting] = useState('');

  // ── Mount: derive display state ──────────────────────────────────────────────

  useEffect(() => {
    // 1. Stamp first session date if this is the first ever launch
    sessionRepository.recordFirstSessionIfNeeded();

    // 2. Read profile
    const profile = profileRepository.getOnboardingProfile();

    // 3. Set archetype-aware greeting
    setGreeting(getGreeting(profile?.archetype));

    // 4. Subscription gate
    const days = sessionRepository.getDaysSinceFirstSession();
    const cached = subscriptionService.getCachedSubscriptionStatus();
    const subscribed = cached?.tier === 'premium';

    if (days >= 14 && !subscribed) {
      const graceUsed = sessionRepository.hasUsedGraceSession();
      if (graceUsed) {
        // Hard wall — navigate away
        router.replace('/(app)/paywall' as never);
        return;
      }
      // Soft wall — inline prompt with "Maybe Later"
      setScreen({ tag: 'paywall_soft' });
      return;
    }

    // 5. Determine daily state
    const hasCheckedIn = checkInRepository.hasCheckedInToday();
    const hasPlan = planRepository.hasPlanForToday();

    if (!hasCheckedIn) {
      setScreen({ tag: 'A' });
      return;
    }

    if (!hasPlan) {
      setScreen({ tag: 'B', generating: false });
      return;
    }

    // Plan exists — check if session is completed today
    const today = todayKey();
    const execution = executionRepository.getExecution(today);
    const sessionComplete = execution?.sessionCompleted === true;

    if (sessionComplete) {
      // State D — find yesterday's plan title for quiet echo
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
      const prevPlan = planRepository.getPlan(yKey);
      setScreen({ tag: 'D', yesterdayTitle: prevPlan?.planTitle ?? null });
      return;
    }

    const plan = planRepository.getTodayPlan();
    if (plan) {
      setScreen({ tag: 'C', plan });
    } else {
      setScreen({ tag: 'B', generating: false });
    }
  }, []);

  // ── State B: generate plan on tap ────────────────────────────────────────────

  const handleGeneratePlan = useCallback(async () => {
    if (screen.tag !== 'B' || screen.generating) return;

    setScreen({ tag: 'B', generating: true });

    const profile = profileRepository.getOnboardingProfile();
    if (!profile) {
      // Corrupted state — should not happen post-onboarding
      setScreen({ tag: 'A' });
      return;
    }

    const checkIn = checkInRepository.getLatestCheckIn();
    if (!checkIn) {
      setScreen({ tag: 'A' });
      return;
    }

    const memory = memoryRepository.getMemorySummary();

    // PersonalizationEngine always returns a plan — never throws to caller
    const result = await generateMorningPlan(profile, checkIn, memory);

    setScreen({ tag: 'C', plan: result.plan });
  }, [screen]);

  // ── Paywall soft: mark grace and continue ────────────────────────────────────

  const handleMaybeLater = useCallback(() => {
    sessionRepository.markGraceSessionUsed();
    // Re-derive state after dismissing soft paywall
    const hasCheckedIn = checkInRepository.hasCheckedInToday();
    const hasPlan = planRepository.hasPlanForToday();

    if (!hasCheckedIn) { setScreen({ tag: 'A' }); return; }
    if (!hasPlan) { setScreen({ tag: 'B', generating: false }); return; }

    const plan = planRepository.getTodayPlan();
    setScreen(plan ? { tag: 'C', plan } : { tag: 'B', generating: false });
  }, []);

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (screen.tag === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={PaletteB.warmWalnut} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.root}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Soft paywall gate ─────────────────────────────────────────────── */}
      {screen.tag === 'paywall_soft' ? (
        <View style={styles.paywallContainer}>
          <Text style={styles.paywallHeading}>Your free period has ended.</Text>
          <Text style={styles.paywallBody}>
            Rise runs entirely on your device. A subscription keeps it going.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/(app)/paywall' as never)}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonLabel}>See subscription options</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleMaybeLater}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryButtonLabel}>Maybe later</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* ── Greeting ──────────────────────────────────────────────────── */}
          <Text style={styles.greeting}>{greeting}</Text>

          {/* ── State A — begin morning ──────────────────────────────────── */}
          {screen.tag === 'A' && (
            <View style={styles.card}>
              <Text style={styles.cardHeading}>Begin your morning</Text>
              {(() => {
                const profile = profileRepository.getOnboardingProfile();
                return profile?.preferredDuration ? (
                  <Text style={styles.cardSubtext}>
                    Your protocol takes {profile.preferredDuration} minutes.
                  </Text>
                ) : null;
              })()}
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => router.push('/(app)/checkin' as never)}
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                <Text style={styles.primaryButtonLabel}>Start check-in →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── State B — generate plan ──────────────────────────────────── */}
          {screen.tag === 'B' && (
            <View style={styles.card}>
              <Text style={styles.cardHeading}>Your protocol is ready</Text>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleGeneratePlan}
                activeOpacity={0.85}
                disabled={screen.generating}
                accessibilityRole="button"
              >
                {screen.generating ? (
                  <ActivityIndicator color={PaletteB.warmCream} />
                ) : (
                  <Text style={styles.primaryButtonLabel}>Generate protocol →</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* ── State C — plan preview ───────────────────────────────────── */}
          {screen.tag === 'C' && (
            <View style={styles.card}>
              <Text style={styles.planTitle}>{screen.plan.planTitle}</Text>
              <View style={styles.planMeta}>
                <Text style={styles.planMetaText}>
                  {totalMinutes(screen.plan)} min
                </Text>
                {screen.plan.mainSequence[0] ? (
                  <Text style={styles.planMetaText}>
                    Starts with: {screen.plan.mainSequence[0].title}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => router.push('/(app)/plan' as never)}
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                <Text style={styles.primaryButtonLabel}>Continue your morning →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── State D — completed ──────────────────────────────────────── */}
          {screen.tag === 'D' && (
            <View style={styles.completedContainer}>
              <Text style={styles.completedHeading}>Morning complete.</Text>
              {screen.yesterdayTitle ? (
                <Text style={styles.yesterdayTitle}>{screen.yesterdayTitle}</Text>
              ) : null}
              <Text style={styles.completedSubtext}>Tomorrow is still yours.</Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: PaletteB.warmCream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
    backgroundColor: PaletteB.warmCream,
  },
  root: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 72 : 48,
    paddingBottom: 48,
  },

  // ── Greeting ──────────────────────────────────────────────────────────────
  greeting: {
    fontFamily: 'Georgia',
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.regular,
    color: PaletteB.deepBrown,
    lineHeight: FontSize.xxl * 1.3,
    marginBottom: 36,
  },

  // ── Card ──────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 16,
    // Shadow
    shadowColor: PaletteB.deepBrown,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeading: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: PaletteB.deepBrown,
  },
  cardSubtext: {
    fontSize: FontSize.base,
    color: PaletteB.warmWalnut,
    lineHeight: FontSize.base * 1.5,
  },

  // ── Plan preview ──────────────────────────────────────────────────────────
  planTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: PaletteB.deepBrown,
    lineHeight: FontSize.md * 1.3,
  },
  planMeta: {
    gap: 6,
  },
  planMetaText: {
    fontSize: FontSize.base,
    color: PaletteB.warmWalnut,
  },

  // ── Buttons ───────────────────────────────────────────────────────────────
  primaryButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: PaletteB.deepBrown,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: PaletteB.warmCream,
    letterSpacing: 0.2,
  },
  secondaryButton: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonLabel: {
    fontSize: FontSize.base,
    color: PaletteB.warmWalnut,
  },

  // ── Paywall soft gate ─────────────────────────────────────────────────────
  paywallContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 20,
    paddingTop: 40,
  },
  paywallHeading: {
    fontFamily: 'Georgia',
    fontSize: FontSize.xl,
    fontWeight: FontWeight.regular,
    color: PaletteB.deepBrown,
    lineHeight: FontSize.xl * 1.35,
  },
  paywallBody: {
    fontSize: FontSize.base,
    color: PaletteB.warmWalnut,
    lineHeight: FontSize.base * 1.6,
  },

  // ── State D: completed ────────────────────────────────────────────────────
  completedContainer: {
    gap: 16,
    paddingTop: 8,
  },
  completedHeading: {
    fontFamily: 'Georgia',
    fontSize: FontSize.xl,
    fontWeight: FontWeight.regular,
    color: PaletteB.deepBrown,
  },
  yesterdayTitle: {
    fontSize: FontSize.base,
    color: PaletteB.amberMist,
    fontStyle: 'italic',
  },
  completedSubtext: {
    fontSize: FontSize.base,
    color: PaletteB.warmWalnut,
    lineHeight: FontSize.base * 1.5,
  },
});
