/**
 * src/screens/onboarding/AuthGateScreen.tsx
 *
 * Auth gate — presented after the archetype reveal during onboarding.
 * The user creates their account here before accessing the daily loop.
 *
 * Phase 4: Firebase auth wired. Stubs replaced with real provider calls.
 *
 * Sign-in providers (in App Store priority order):
 *   1. Apple Sign In  — required first when any social auth is offered
 *   2. Google Sign In
 *   3. Email / Password (inline form, toggled by tapping "Continue with email")
 *
 * Email flow:
 *   - Default: createEmailAccount (new user during onboarding)
 *   - If Firebase returns auth/email-already-in-use: switch to sign-in mode
 *   - User can also manually toggle to "Sign in" if they already have an account
 *
 * Machine interface is unchanged — onAuthComplete / onAuthFailed.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  StyleSheet,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import type { OnboardingMachineContext } from '../../machines/onboardingMachine';
import { PaletteC } from '../../design/tokens';
import {
  signInWithApple,
  signInWithGoogle,
  createEmailAccount,
  signInWithEmail,
} from '../../services/AuthService';
import { profileRepository } from '../../repositories/ProfileRepository';
import { sessionRepository } from '../../repositories/SessionRepository';
import { resolveCohortId } from '../../auth/resolveCohortId';
import type { AuthProvider, UserProfile } from '../../../domain/types';

// ─── Post-auth profile setup ──────────────────────────────────────────────────
// Called once per successful auth. Creates UserProfile, resolves cohortId,
// clears onboarding draft, and stamps the first session date.

async function handlePostAuth(
  uid: string,
  provider: AuthProvider,
  email: string | null | undefined,
  onAuthComplete: (uid: string) => void,
): Promise<void> {
  const cohortId = resolveCohortId();

  const profile: UserProfile = {
    schemaVersion: '1.0',
    uid,
    email: email ?? undefined,
    providers: [provider],
    onboardingCompleted: true,
    onboardingCompletedAt: new Date().toISOString(),
    subscriptionTier: 'free',
    cohortId,
    createdAt: new Date().toISOString(),
  };

  profileRepository.saveUserProfile(profile);
  sessionRepository.clearDraftSession();
  sessionRepository.recordFirstSessionIfNeeded();

  onAuthComplete(uid);
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface AuthGateScreenProps {
  context: OnboardingMachineContext;
  authError?: string;
  onAuthComplete: (uid: string) => void;
  onAuthFailed: (error: string) => void;
}

// ─── Firebase error → human message ──────────────────────────────────────────

function friendlyError(code: string | undefined): string {
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address isn\'t valid.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email or password is incorrect.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'No internet connection. Check your network and try again.';
    case 'auth/cancelled':
    case 'ERR_REQUEST_CANCELED':
      return ''; // User cancelled — show nothing
    default:
      return 'Sign in failed. Please try again.';
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AuthGateScreen({
  context,
  authError,
  onAuthComplete,
  onAuthFailed,
}: AuthGateScreenProps) {

  // Provider loading state
  const [loading, setLoading] = useState<'apple' | 'google' | 'email' | null>(null);

  // Email form state
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailMode, setEmailMode] = useState<'create' | 'signin'>('create');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const isLoading = loading !== null;

  // ── Apple ────────────────────────────────────────────────────────────────────

  const handleApple = useCallback(async () => {
    if (isLoading) return;
    setLoading('apple');
    setLocalError('');
    try {
      const uid = await signInWithApple();
      await handlePostAuth(uid, 'apple', null, onAuthComplete);
    } catch (err: any) {
      const msg = friendlyError(err?.code ?? err?.message);
      if (msg) onAuthFailed(msg);
    } finally {
      setLoading(null);
    }
  }, [isLoading, onAuthComplete, onAuthFailed]);

  // ── Google ───────────────────────────────────────────────────────────────────

  const handleGoogle = useCallback(async () => {
    if (isLoading) return;
    setLoading('google');
    setLocalError('');
    try {
      const uid = await signInWithGoogle();
      await handlePostAuth(uid, 'google', null, onAuthComplete);
    } catch (err: any) {
      const msg = friendlyError(err?.code ?? err?.message);
      if (msg) onAuthFailed(msg);
    } finally {
      setLoading(null);
    }
  }, [isLoading, onAuthComplete, onAuthFailed]);

  // ── Email ────────────────────────────────────────────────────────────────────

  const handleEmailSubmit = useCallback(async () => {
    if (isLoading) return;
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setLocalError('Please enter your email and password.');
      return;
    }

    setLoading('email');
    setLocalError('');

    try {
      let uid: string;

      if (emailMode === 'create') {
        try {
          uid = await createEmailAccount(trimmedEmail, trimmedPassword);
          // uid captured — handlePostAuth called below after mode check
        } catch (err: any) {
          if (err?.code === 'auth/email-already-in-use') {
            // Switch to sign-in mode automatically
            setEmailMode('signin');
            setLocalError('An account with this email already exists. Enter your password to sign in.');
            setLoading(null);
            return;
          }
          throw err;
        }
      } else {
        uid = await signInWithEmail(trimmedEmail, trimmedPassword);
      }

      await handlePostAuth(uid, 'email', trimmedEmail, onAuthComplete);
    } catch (err: any) {
      const msg = friendlyError(err?.code ?? err?.message);
      setLocalError(msg || 'Sign in failed. Please try again.');
    } finally {
      setLoading(null);
    }
  }, [isLoading, email, password, emailMode, onAuthComplete]);

  // ─── Render ──────────────────────────────────────────────────────────────────

  const displayError = localError || authError;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.root}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* Header */}
        <View style={styles.header}>
          {context.archetype ? (
            <Text style={styles.archetypeEcho}>{context.archetype}</Text>
          ) : null}
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>
            Your profile and morning data stay on this device.
            Your account keeps your archetype safe if you ever change phones.
          </Text>
        </View>

        {showEmailForm ? (

          /* ── Email form ───────────────────────────────────────────────────── */

          <View style={styles.emailForm}>

            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor={PaletteC.dustyMocha}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
              editable={!isLoading}
            />

            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={PaletteC.dustyMocha}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType={emailMode === 'create' ? 'newPassword' : 'password'}
              returnKeyType="done"
              onSubmitEditing={handleEmailSubmit}
              editable={!isLoading}
            />

            {emailMode === 'create' && (
              <Text style={styles.passwordHint}>Minimum 6 characters</Text>
            )}

            {/* Submit */}
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleEmailSubmit}
              activeOpacity={0.85}
              disabled={isLoading}
            >
              {loading === 'email' ? (
                <ActivityIndicator color={PaletteC.deepCharcoal} />
              ) : (
                <Text style={styles.submitLabel}>
                  {emailMode === 'create' ? 'Create account' : 'Sign in'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Toggle sign-in / create */}
            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => {
                setEmailMode(m => (m === 'create' ? 'signin' : 'create'));
                setLocalError('');
              }}
              disabled={isLoading}
            >
              <Text style={styles.toggleText}>
                {emailMode === 'create'
                  ? 'Already have an account? Sign in'
                  : 'No account yet? Create one'}
              </Text>
            </TouchableOpacity>

            {/* Back to provider list */}
            <TouchableOpacity
              style={styles.backRow}
              onPress={() => {
                setShowEmailForm(false);
                setLocalError('');
              }}
              disabled={isLoading}
            >
              <Text style={styles.backText}>← Other sign-in options</Text>
            </TouchableOpacity>
          </View>

        ) : (

          /* ── Provider buttons ─────────────────────────────────────────────── */

          <View style={styles.buttons}>

            {/* Apple — must appear first per App Store guidelines */}
            <TouchableOpacity
              style={[styles.authButton, styles.appleButton]}
              onPress={handleApple}
              activeOpacity={0.85}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="Sign in with Apple"
            >
              {loading === 'apple' ? (
                <ActivityIndicator color={PaletteC.deepCharcoal} />
              ) : (
                <>
                  <Text style={styles.appleIcon}></Text>
                  <Text style={[styles.authButtonLabel, styles.appleLabel]}>
                    Sign in with Apple
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Google */}
            <TouchableOpacity
              style={[styles.authButton, styles.googleButton]}
              onPress={handleGoogle}
              activeOpacity={0.85}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="Sign in with Google"
            >
              {loading === 'google' ? (
                <ActivityIndicator color={PaletteC.softCream} />
              ) : (
                <Text style={[styles.authButtonLabel, styles.googleLabel]}>
                  Sign in with Google
                </Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerLabel}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Email */}
            <TouchableOpacity
              style={[styles.authButton, styles.emailButton]}
              onPress={() => setShowEmailForm(true)}
              activeOpacity={0.85}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="Continue with email"
            >
              <Text style={[styles.authButtonLabel, styles.emailLabel]}>
                Continue with email
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Error display */}
        {displayError ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{displayError}</Text>
          </View>
        ) : null}

        {/* Privacy note */}
        <View style={styles.privacyNote}>
          <Text style={styles.privacyText}>
            Your morning data, check-ins, and reflections stay on this device only.
            Your account stores your archetype — nothing else.
          </Text>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: PaletteC.deepCharcoal,
  },
  root: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 64 : 40,
    paddingBottom: Platform.OS === 'ios' ? 44 : 28,
  },
  header: {
    marginBottom: 40,
  },
  archetypeEcho: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 1.5,
    color: PaletteC.dawnGold,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: PaletteC.softCream,
    marginBottom: 14,
  },
  subtitle: {
    fontSize: 15,
    color: PaletteC.dustyMocha,
    lineHeight: 23,
  },

  // ── Provider buttons ─────────────────────────────────────────────────────────
  buttons: {
    gap: 12,
    marginBottom: 24,
  },
  authButton: {
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  appleButton:  { backgroundColor: PaletteC.softCream },
  googleButton: { backgroundColor: PaletteC.warmGraphite, borderWidth: 1, borderColor: PaletteC.smokyBrown },
  emailButton:  { backgroundColor: 'transparent', borderWidth: 1, borderColor: PaletteC.smokyBrown },

  authButtonLabel: { fontSize: 16, fontWeight: '600' },
  appleIcon:       { fontSize: 18, color: PaletteC.deepCharcoal },
  appleLabel:      { color: PaletteC.deepCharcoal },
  googleLabel:     { color: PaletteC.softCream },
  emailLabel:      { color: PaletteC.warmSand },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: PaletteC.smokyBrown },
  dividerLabel: { fontSize: 13, color: PaletteC.dustyMocha },

  // ── Email form ───────────────────────────────────────────────────────────────
  emailForm: {
    gap: 12,
    marginBottom: 24,
  },
  input: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PaletteC.smokyBrown,
    backgroundColor: PaletteC.warmGraphite,
    paddingHorizontal: 16,
    fontSize: 16,
    color: PaletteC.softCream,
  },
  passwordHint: {
    fontSize: 12,
    color: PaletteC.dustyMocha,
    marginTop: -4,
    marginLeft: 4,
  },
  submitButton: {
    height: 56,
    borderRadius: 14,
    backgroundColor: PaletteC.dawnGold,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: PaletteC.deepCharcoal,
  },
  toggleRow: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  toggleText: {
    fontSize: 14,
    color: PaletteC.dustyMocha,
  },
  backRow: {
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  backText: {
    fontSize: 13,
    color: PaletteC.dustyMocha,
  },

  // ── Error / privacy ──────────────────────────────────────────────────────────
  errorContainer: {
    backgroundColor: PaletteC.smokyBrown,
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#E8956A',
    lineHeight: 20,
  },
  privacyNote: {
    marginTop: 'auto',
    paddingTop: 20,
  },
  privacyText: {
    fontSize: 12,
    color: PaletteC.dustyMocha,
    lineHeight: 18,
    textAlign: 'center',
  },
});
