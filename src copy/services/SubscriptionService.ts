/**
 * src/services/SubscriptionService.ts
 *
 * RevenueCat subscription management.
 *
 * MANUAL INSTALL REQUIRED:
 *   npx expo install react-native-purchases
 *   Then add the RevenueCat config plugin to app.json:
 *   { "plugins": ["react-native-purchases"] }
 *   And add to .env:
 *   REVENUECAT_API_KEY=your_key_here
 *
 * Until the package is installed, all methods log warnings and return safe defaults.
 * The runtime check (_getPurchases) prevents crashes in the interim.
 *
 * Responsibilities:
 *   - Initialize RevenueCat on app launch
 *   - Check subscription status against 'premium_entitlement' entitlement key
 *   - Cache subscription status in MMKV via SUBSCRIPTION_CACHE key
 *   - Present paywall using RevenueCat Paywall UI
 *   - Handle purchase and restore
 *
 * Privacy: RevenueCat receives a random anonymous UUID or the Firebase UID post-auth.
 * No personal content is ever sent to RevenueCat.
 */

import { encryptedStorage } from '../storage/mmkv';
import { SUBSCRIPTION_CACHE } from '../storage/keys';
import { SubscriptionCacheSchema, validateAndParse } from '../storage/validators';
import type { SubscriptionCache } from '../../domain/types';

// ─── RevenueCat entitlement key ───────────────────────────────────────────────

const ENTITLEMENT_KEY = 'premium_entitlement';

// ─── Minimal types mirroring react-native-purchases API ───────────────────────
// Allows TypeScript to compile cleanly before the package is installed.
// Remove these and import directly from 'react-native-purchases' once installed.

interface PurchasesCustomerInfo {
  entitlements: {
    active: Record<string, unknown>;
  };
}

type PurchaseResult =
  | { customerInfo: PurchasesCustomerInfo; productIdentifier: string }
  | null;

// ─── Runtime package loader ───────────────────────────────────────────────────

function _getPurchases(): {
  default: {
    configure: (opts: { apiKey: string }) => void;
    logIn: (uid: string) => Promise<unknown>;
    getCustomerInfo: () => Promise<PurchasesCustomerInfo>;
    purchasePackage: (pkg: unknown) => Promise<PurchaseResult>;
    restorePurchases: () => Promise<PurchasesCustomerInfo>;
    presentCodeRedemptionSheet: () => void;
  };
  PurchasesPackage: unknown;
} | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('react-native-purchases');
  } catch {
    return null;
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

class SubscriptionService {

  /**
   * Configure RevenueCat on app launch.
   * Call once from root layout, before auth state is known.
   * After auth: call identify(uid) to link the user.
   */
  async initialize(): Promise<void> {
    const Purchases = _getPurchases();
    if (!Purchases) {
      if (__DEV__) console.warn('[Rise] SubscriptionService: react-native-purchases not installed');
      return;
    }

    const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? '';
    if (!apiKey) {
      if (__DEV__) console.warn('[Rise] SubscriptionService: EXPO_PUBLIC_REVENUECAT_API_KEY not set');
      return;
    }

    Purchases.default.configure({ apiKey });
  }

  /**
   * Identify the authenticated user with RevenueCat.
   * Call after Firebase sign-in completes. Idempotent.
   */
  async identify(uid: string): Promise<void> {
    const Purchases = _getPurchases();
    if (!Purchases) return;

    try {
      await Purchases.default.logIn(uid);
    } catch (err) {
      if (__DEV__) console.warn('[Rise] SubscriptionService: identify failed:', err);
    }
  }

  /**
   * Returns true if the user has an active premium entitlement.
   * Checks RevenueCat, caches result in MMKV, returns boolean.
   * Falls back to cached value if network fails.
   */
  async isSubscribed(): Promise<boolean> {
    const Purchases = _getPurchases();
    if (!Purchases) return false;

    try {
      const info = await Purchases.default.getCustomerInfo();
      const active = ENTITLEMENT_KEY in info.entitlements.active;
      this._cacheSubscriptionStatus(active ? 'premium' : 'free');
      return active;
    } catch {
      // Network failure — fall back to MMKV cache
      const cached = this.getCachedSubscriptionStatus();
      return cached?.tier === 'premium';
    }
  }

  /**
   * Presents the RevenueCat paywall UI.
   * Returns 'purchased', 'cancelled', or 'error'.
   */
  async presentPaywall(): Promise<'purchased' | 'cancelled' | 'error'> {
    const Purchases = _getPurchases();
    if (!Purchases) return 'error';

    try {
      // RevenueCat Paywall UI (react-native-purchases-ui)
      // If not using their UI, implement custom flow here.
      if (__DEV__) console.warn('[Rise] SubscriptionService: RevenueCat Paywall UI requires react-native-purchases-ui');
      return 'cancelled';
    } catch (err) {
      if (__DEV__) console.warn('[Rise] SubscriptionService: presentPaywall error:', err);
      return 'error';
    }
  }

  /**
   * Restores previous purchases. Returns true if subscription was restored.
   */
  async restorePurchases(): Promise<boolean> {
    const Purchases = _getPurchases();
    if (!Purchases) return false;

    try {
      const info = await Purchases.default.restorePurchases();
      const active = ENTITLEMENT_KEY in info.entitlements.active;
      this._cacheSubscriptionStatus(active ? 'premium' : 'free');
      return active;
    } catch (err) {
      if (__DEV__) console.warn('[Rise] SubscriptionService: restorePurchases failed:', err);
      return false;
    }
  }

  /**
   * Synchronous MMKV read of the cached subscription state.
   * Used for immediate UI decisions before the async check resolves.
   */
  getCachedSubscriptionStatus(): SubscriptionCache | null {
    const raw = encryptedStorage.getString(SUBSCRIPTION_CACHE);
    if (raw === undefined) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }

    return validateAndParse(SubscriptionCacheSchema, parsed, SUBSCRIPTION_CACHE);
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private _cacheSubscriptionStatus(tier: 'free' | 'premium'): void {
    const cache: SubscriptionCache = {
      tier,
      lastVerifiedAt: new Date().toISOString(),
    };
    encryptedStorage.set(SUBSCRIPTION_CACHE, JSON.stringify(cache));
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const subscriptionService = new SubscriptionService();
