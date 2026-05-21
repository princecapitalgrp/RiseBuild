/**
 * src/context/AuthContext.tsx
 *
 * Provides the current Firebase auth state to the component tree.
 *
 * Usage:
 *   const { uid, isLoading, signOut } = useAuth();
 *
 * uid is null when no user is signed in.
 * isLoading is true during the initial Firebase auth state check —
 * use it to suppress premature routing decisions.
 *
 * Note: onboarding auth is handled inside the onboarding machine/screen
 * directly via AuthService. This context is used for:
 *   - Knowing who is signed in at the app level (settings, etc.)
 *   - Sign-out (called from SettingsScreen)
 *   - Future: persisting user data across devices
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut } from '../services/AuthService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthState {
  uid: string | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthState>({
  uid: null,
  isLoading: true,
  signOut: async () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [uid, setUid] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Subscribe to Firebase auth state on mount.
    // Firebase resolves the initial state synchronously from cache,
    // so isLoading flips to false quickly — no blank-screen flash.
    const unsubscribe = onAuthStateChanged((nextUid) => {
      setUid(nextUid);
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut();
    // uid will update automatically via the onAuthStateChanged listener.
  }, []);

  const value = useMemo<AuthState>(
    () => ({ uid, isLoading, signOut }),
    [uid, isLoading, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
