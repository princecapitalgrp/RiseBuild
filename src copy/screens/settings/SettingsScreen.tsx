/**
 * src/screens/settings/SettingsScreen.tsx
 *
 * Minimum viable settings for TestFlight.
 * Resolves GDPR Gap C (right to erasure — Article 17).
 *
 * Sections:
 *   1. Account — sign out
 *   2. Data — erasure (Article 17)
 *   3. Privacy — policy link + inline explanation
 *   4. Notifications — morning notification toggle
 *   5. About — app version
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Linking,
  StyleSheet,
  Platform,
} from 'react-native';
import { Colors } from '../../design/tokens';
import { profileRepository } from '../../repositories/ProfileRepository';
import { notificationService } from '../../services/NotificationService';
import { erasureService } from '../../services/ErasureService';
import Constants from 'expo-constants';

// ─── Props ────────────────────────────────────────────────────────────────────

interface SettingsScreenProps {
  onSignOut: () => void;
  onDeleteAccount: () => void;
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function SettingsRow({
  label,
  onPress,
  destructive,
  right,
  disabled,
}: {
  label: string;
  onPress?: () => void;
  destructive?: boolean;
  right?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.row, disabled && styles.rowDisabled]}
      onPress={onPress}
      disabled={disabled || !onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>
        {label}
      </Text>
      {right && <View style={styles.rowRight}>{right}</View>}
    </TouchableOpacity>
  );
}

// ─── Privacy explanation (expandable) ─────────────────────────────────────────

function PrivacyExplanation() {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.explanationWrap}>
      <TouchableOpacity
        style={styles.explanationToggle}
        onPress={() => setExpanded(e => !e)}
        activeOpacity={0.7}
      >
        <Text style={styles.rowLabel}>How your data is used</Text>
        <Text style={styles.chevron}>{expanded ? '↑' : '↓'}</Text>
      </TouchableOpacity>
      {expanded && (
        <View style={styles.explanationBody}>
          <Text style={styles.explanationText}>
            Your check-ins, plans, reflections, and memory data live entirely on this device in encrypted storage. Nothing personal is uploaded to any server.{'\n\n'}
            When you generate a morning plan, your operating state (mood category, energy level) and behavioral patterns (not your words) are sent to our AI — never your raw text.{'\n\n'}
            Your subscription status is managed by RevenueCat. No personal content is shared with them — only an anonymous identifier.
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SettingsScreen({ onSignOut, onDeleteAccount }: SettingsScreenProps) {
  const profile    = profileRepository.getOnboardingProfile();
  const userProfile = profileRepository.getUserProfile();

  const [notifEnabled, setNotifEnabled] = useState(
    notificationService.getStoredPermissionState()
  );
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Account identifier display
  const accountLabel = userProfile?.email
    ? userProfile.email
    : userProfile?.providers?.includes('apple')
    ? 'Apple account'
    : userProfile?.providers?.includes('google')
    ? 'Google account'
    : 'Account';

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSignOut = useCallback(() => {
    Alert.alert(
      'Sign out',
      'You\'ll need to sign back in to access your data.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: onSignOut },
      ]
    );
  }, [onSignOut]);

  const handleDeleteAll = useCallback(() => {
    Alert.alert(
      'Delete all my data',
      'This will permanently delete your morning history, protocol data, and account. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: async () => {
            setDeletingAccount(true);
            await erasureService.deleteAll();
            setDeletingAccount(false);
            onDeleteAccount();
          },
        },
      ]
    );
  }, [onDeleteAccount]);

  const handlePrivacyPolicy = useCallback(() => {
    Linking.openURL('https://risebysolis.com/privacy').catch(() => {
      if (__DEV__) console.warn('[Rise] SettingsScreen: could not open privacy policy URL');
    });
  }, []);

  const handleNotificationToggle = useCallback(async (value: boolean) => {
    setNotifEnabled(value);

    if (value) {
      const granted = await notificationService.requestPermissions();
      if (!granted) {
        setNotifEnabled(false);
        return;
      }
      if (profile?.wakeTarget) {
        await notificationService.scheduleMorningNotification(profile.wakeTarget);
      }
    } else {
      await notificationService.cancelAll();
    }
  }, [profile]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const appVersion = Constants.expoConfig?.version ?? '—';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.heading}>Settings</Text>

      {/* 1. Account */}
      <SectionHeader title="Account" />
      <View style={styles.section}>
        <SettingsRow label={accountLabel} />
        <SettingsRow
          label="Sign out"
          onPress={handleSignOut}
        />
      </View>

      {/* 2. Data */}
      <SectionHeader title="Data" />
      <View style={styles.section}>
        <SettingsRow
          label="All your data lives on this device"
          disabled
        />
        <SettingsRow
          label={deletingAccount ? 'Deleting…' : 'Delete all my data'}
          onPress={handleDeleteAll}
          destructive
          disabled={deletingAccount}
        />
      </View>

      {/* 3. Privacy */}
      <SectionHeader title="Privacy" />
      <View style={styles.section}>
        <SettingsRow
          label="Privacy Policy"
          onPress={handlePrivacyPolicy}
        />
        <PrivacyExplanation />
      </View>

      {/* 4. Notifications */}
      <SectionHeader title="Notifications" />
      <View style={styles.section}>
        <SettingsRow
          label="Morning notification"
          right={
            <Switch
              value={notifEnabled}
              onValueChange={handleNotificationToggle}
              trackColor={{ false: Colors.border, true: Colors.accent }}
              thumbColor={Colors.textPrimary}
            />
          }
        />
      </View>

      {/* 5. About */}
      <SectionHeader title="About" />
      <View style={styles.section}>
        <SettingsRow label="Rise by Solis" />
        <SettingsRow label={`Version ${appVersion}`} />
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 56 : 32,
    paddingBottom: 48,
  },

  heading: {
    fontSize: 26,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    marginBottom: 28,
  },

  sectionHeader: {
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 24,
    marginLeft: 4,
  },

  section: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  rowLabel: {
    fontSize: 15,
    color: Colors.textSecondary,
    flex: 1,
  },
  rowLabelDestructive: {
    color: '#C05050',
  },
  rowRight: {
    marginLeft: 12,
  },
  chevron: {
    fontSize: 12,
    color: Colors.textMuted,
    marginLeft: 8,
  },

  // Privacy explanation
  explanationWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  explanationToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  explanationBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  explanationText: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 19,
  },

  bottomSpacer: {
    height: 40,
  },
});
