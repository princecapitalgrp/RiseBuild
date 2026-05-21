/**
 * src/screens/paywall/PaywallScreen.tsx
 *
 * Displayed on day 14+ when the user is not subscribed.
 *
 * Grace session logic:
 *   - First time reaching day 14 (hasUsedGraceSession === false):
 *     Show "Maybe later" link. On tap: markGraceSessionUsed(), navigate to full plan.
 *   - All subsequent sessions without a subscription:
 *     No "Maybe later". Paywall only.
 *
 * The PaywallScreen receives the current plan so the preview section shows
 * real content — plan title, opening line, first block, rationale firstBlockReason,
 * and total duration.
 *
 * Design: Palette C Charcoal Sun. No countdown. No dark patterns.
 * No free tier language. No trial language.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Colors, PaletteC } from '../../design/tokens';
import { sessionRepository } from '../../repositories/SessionRepository';
import { subscriptionService } from '../../services/SubscriptionService';
import type { OperatingPlan } from '../../../domain/types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface PaywallScreenProps {
  plan: OperatingPlan | null;
  onSubscribed: () => void;
  onGraceContinue: () => void;  // only called on first day-14 session
}

// ─── Plan preview ─────────────────────────────────────────────────────────────

function PlanPreview({ plan }: { plan: OperatingPlan }) {
  const firstBlock = plan.mainSequence[0];
  const totalMinutes = plan.mainSequence.reduce((s, b) => s + b.durationMinutes, 0);

  return (
    <View style={styles.preview}>
      <Text style={styles.previewTitle}>{plan.planTitle}</Text>
      <Text style={styles.previewOpening}>{plan.openingLine}</Text>

      {firstBlock && (
        <View style={styles.firstBlockCard}>
          <Text style={styles.firstBlockLabel}>First block</Text>
          <Text style={styles.firstBlockTitle}>{firstBlock.title}</Text>
          <Text style={styles.firstBlockAction}>{firstBlock.action}</Text>
        </View>
      )}

      {plan.rationale.firstBlockReason ? (
        <Text style={styles.firstBlockReason}>{plan.rationale.firstBlockReason}</Text>
      ) : null}

      <Text style={styles.duration}>{totalMinutes} min total</Text>
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PaywallScreen({ plan, onSubscribed, onGraceContinue }: PaywallScreenProps) {
  const [loading, setLoading] = useState(false);

  // Grace session: only offered on first day-14 session
  // SessionRepository.hasUsedGraceSession() returns true once the user tapped
  // "Maybe later" in a prior session. After that, no grace link is shown.
  const showGraceLink = !sessionRepository.hasUsedGraceSession();

  const handleSubscribe = useCallback(async () => {
    setLoading(true);
    try {
      const result = await subscriptionService.presentPaywall();
      if (result === 'purchased') {
        onSubscribed();
      }
    } finally {
      setLoading(false);
    }
  }, [onSubscribed]);

  const handleRestore = useCallback(async () => {
    setLoading(true);
    try {
      const restored = await subscriptionService.restorePurchases();
      if (restored) onSubscribed();
    } finally {
      setLoading(false);
    }
  }, [onSubscribed]);

  const handleMaybeLater = useCallback(() => {
    sessionRepository.markGraceSessionUsed();
    onGraceContinue();
  }, [onGraceContinue]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Plan preview — omitted when no plan is available */}
      {plan && <PlanPreview plan={plan} />}

      {/* Divider */}
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>Your protocol continues here.</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Pricing */}
      <View style={styles.pricingSection}>
        <Text style={styles.price}>$79 / year</Text>
        <Text style={styles.priceTier}>Founding member</Text>
        <Text style={styles.priceLock}>Price locked for you permanently.</Text>
      </View>

      {/* Primary CTA */}
      <TouchableOpacity
        style={[styles.primaryButton, loading && styles.primaryButtonLoading]}
        onPress={handleSubscribe}
        disabled={loading}
        activeOpacity={0.88}
      >
        {loading ? (
          <ActivityIndicator color={Colors.background} />
        ) : (
          <Text style={styles.primaryButtonText}>Begin my protocol — $79/year</Text>
        )}
      </TouchableOpacity>

      {/* Restore */}
      <TouchableOpacity
        style={styles.secondaryLink}
        onPress={handleRestore}
        disabled={loading}
        activeOpacity={0.7}
      >
        <Text style={styles.secondaryLinkText}>Restore purchase</Text>
      </TouchableOpacity>

      {/* Grace session link — only on first day-14 session */}
      {showGraceLink && (
        <TouchableOpacity
          style={styles.tertiaryLink}
          onPress={handleMaybeLater}
          disabled={loading}
          activeOpacity={0.7}
        >
          <Text style={styles.tertiaryLinkText}>Maybe later</Text>
        </TouchableOpacity>
      )}

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PaletteC.deepCharcoal,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 36,
    paddingBottom: 48,
  },

  // Plan preview
  preview: {
    marginBottom: 36,
  },
  previewTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: PaletteC.softCream,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  previewOpening: {
    fontSize: 15,
    color: PaletteC.warmSand,
    lineHeight: 22,
    marginBottom: 20,
  },
  firstBlockCard: {
    backgroundColor: PaletteC.warmGraphite,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: PaletteC.smokyBrown,
  },
  firstBlockLabel: {
    fontSize: 10,
    color: PaletteC.dustyMocha,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  firstBlockTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: PaletteC.softCream,
    marginBottom: 4,
  },
  firstBlockAction: {
    fontSize: 14,
    color: PaletteC.warmSand,
    lineHeight: 20,
  },
  firstBlockReason: {
    fontSize: 13,
    color: PaletteC.dustyMocha,
    lineHeight: 19,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  duration: {
    fontSize: 12,
    color: PaletteC.dustyMocha,
    letterSpacing: 0.3,
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 36,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: PaletteC.warmGraphite,
  },
  dividerText: {
    fontSize: 14,
    color: PaletteC.warmSand,
    textAlign: 'center',
    flexShrink: 1,
  },

  // Pricing
  pricingSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  price: {
    fontSize: 32,
    fontWeight: '600',
    color: PaletteC.dawnGold,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  priceTier: {
    fontSize: 14,
    color: PaletteC.paleApricot,
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  priceLock: {
    fontSize: 13,
    color: PaletteC.dustyMocha,
  },

  // Primary CTA
  primaryButton: {
    backgroundColor: PaletteC.dawnGold,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
    minHeight: 54,
    justifyContent: 'center',
  },
  primaryButtonLoading: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: PaletteC.deepCharcoal,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.1,
  },

  // Secondary / restore
  secondaryLink: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  secondaryLinkText: {
    fontSize: 14,
    color: PaletteC.warmSand,
  },

  // Tertiary / grace
  tertiaryLink: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  tertiaryLinkText: {
    fontSize: 13,
    color: PaletteC.dustyMocha,
  },

  bottomSpacer: {
    height: 40,
  },
});
