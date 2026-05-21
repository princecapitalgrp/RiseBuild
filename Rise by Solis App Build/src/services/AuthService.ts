/**
 * src/services/AuthService.ts
 *
 * Centralised Firebase auth operations.
 * Replaces the stubs in AuthGateScreen that were marked Phase 4.
 *
 * Providers implemented:
 *   - Apple Sign In  (expo-apple-authentication + Firebase)
 *   - Google Sign In (@react-native-google-signin/google-signin + Firebase)
 *   - Email / Password (Firebase createUser / signIn)
 *
 * Phone / Passkey: not implemented. Phone adds friction + SMS costs;
 * Passkey is premature for a v1 consumer app.
 *
 * ── Apple nonce ────────────────────────────────────────────────────────────
 * Apple Sign In requires a cryptographic nonce to prevent replay attacks.
 * We generate a random raw nonce, SHA-256 hash it, send the hash to Apple,
 * and pass the raw nonce to Firebase so it can verify the token.
 * This is the pattern recommended by Firebase docs for native iOS.
 */

import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

// ─── Google Sign-In configuration ────────────────────────────────────────────
//
// webClientId: Firebase Console → Authentication → Sign-in method → Google
//              → Web SDK configuration → Web client ID
//
// Replace the placeholder below with your actual Web Client ID.
// It looks like: 404058225095-xxxxxxxxxxxx.apps.googleusercontent.com
//
const GOOGLE_WEB_CLIENT_ID = '404058225095-m51q89ip5jcciump07g88aqk4bajdchi.apps.googleusercontent.com';

export function configureGoogleSignIn(): void {
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
}

// ─── Nonce helpers ────────────────────────────────────────────────────────────

function generateRawNonce(length = 32): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => charset[b % charset.length])
    .join('');
}

async function sha256(input: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);
}

// ─── Apple Sign In ────────────────────────────────────────────────────────────
//
// Prerequisites (Firebase console):
//   Authentication → Sign-in method → Apple → Enable
//   Enter your Apple Services ID (from Apple Developer portal).
//
export async function signInWithApple(): Promise<string> {
  const rawNonce = generateRawNonce();
  const hashedNonce = await sha256(rawNonce);

  const appleCredential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  const { identityToken } = appleCredential;
  if (!identityToken) {
    throw new Error('Apple Sign In returned no identity token.');
  }

  // Pass raw nonce so Firebase can verify the hashed version Apple signed.
  const firebaseCredential = auth.AppleAuthProvider.credential(identityToken, rawNonce);
  const { user } = await auth().signInWithCredential(firebaseCredential);
  return user.uid;
}

// ─── Google Sign In ───────────────────────────────────────────────────────────
//
// Prerequisites (Firebase console):
//   Authentication → Sign-in method → Google → Enable
//   Copy the Web client ID into GOOGLE_WEB_CLIENT_ID above.
//
export async function signInWithGoogle(): Promise<string> {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const result = await GoogleSignin.signIn();
  const idToken = result.data?.idToken;

  if (!idToken) {
    throw new Error('Google Sign In returned no ID token.');
  }

  const firebaseCredential = auth.GoogleAuthProvider.credential(idToken);
  const { user } = await auth().signInWithCredential(firebaseCredential);
  return user.uid;
}

// ─── Email auth ───────────────────────────────────────────────────────────────
//
// createEmailAccount: for new users during onboarding.
// signInWithEmail:    for returning users who chose email originally.
//
// The UI in AuthGateScreen defaults to createEmailAccount and catches
// auth/email-already-in-use to offer signInWithEmail instead.
//
export async function createEmailAccount(email: string, password: string): Promise<string> {
  const { user } = await auth().createUserWithEmailAndPassword(email, password);
  return user.uid;
}

export async function signInWithEmail(email: string, password: string): Promise<string> {
  const { user } = await auth().signInWithEmailAndPassword(email, password);
  return user.uid;
}

// ─── Session ──────────────────────────────────────────────────────────────────

export async function signOut(): Promise<void> {
  try {
    // Only relevant if the current session used Google Sign-In.
    await GoogleSignin.signOut();
  } catch {
    // Not signed in with Google — safe to ignore.
  }
  await auth().signOut();
}

export function getCurrentUser() {
  return auth().currentUser;
}

/**
 * Subscribe to Firebase auth state changes.
 * Returns the unsubscribe function — call it on unmount.
 */
export function onAuthStateChanged(callback: (uid: string | null) => void): () => void {
  return auth().onAuthStateChanged((user) => callback(user?.uid ?? null));
}
