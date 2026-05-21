/**
 * src/storage/mmkv.ts
 *
 * Encrypted MMKV singleton. The only file in the codebase that instantiates MMKV.
 *
 * KEY MANAGEMENT:
 *   First launch  → generate 256-bit random key → store in iOS Keychain
 *   Every launch  → retrieve key from Keychain → open MMKV with that key
 *   Key failure   → throw StorageInitError (never fall back to unencrypted)
 *
 * USAGE:
 *   Call `initializeStorage()` once in app/_layout.tsx before any renders.
 *   Await it. Then access `encryptedStorage` freely from repositories.
 *   Never import MMKV from any other file.
 *
 * PRIVACY:
 *   The encryption key is never logged, never included in error payloads,
 *   never passed to any function except the MMKV constructor.
 */

import * as SecureStore from 'expo-secure-store';
import { MMKV } from 'react-native-mmkv';

// ─── Constants ───────────────────────────────────────────────────────────────

const KEYCHAIN_KEY_ID = 'solis.mmkv.encryption.key';
const MMKV_INSTANCE_ID = 'solis-encrypted-storage';

// ─── Error type ──────────────────────────────────────────────────────────────

export type StorageInitErrorCode =
  | 'KEYCHAIN_READ_FAILED'
  | 'KEYCHAIN_WRITE_FAILED'
  | 'MMKV_INIT_FAILED';

export class StorageInitError extends Error {
  readonly code: StorageInitErrorCode;

  constructor(code: StorageInitErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'StorageInitError';
    // Maintain correct prototype chain in transpiled ES5
    Object.setPrototypeOf(this, StorageInitError.prototype);
  }
}

// ─── Singleton state ─────────────────────────────────────────────────────────

// Definite assignment: valid only after initializeStorage() resolves.
// Any access before that resolves is a programming error.
// eslint-disable-next-line prefer-const
export let encryptedStorage!: MMKV;

/**
 * Returns true once initializeStorage() has resolved successfully.
 * Repositories may check this during bootstrap; outside of that, rely on
 * the architectural guarantee that initializeStorage() completes before
 * any navigation renders.
 */
export function isStorageReady(): boolean {
  return encryptedStorage !== undefined;
}

// ─── Key generation ──────────────────────────────────────────────────────────

/**
 * Generates a cryptographically random 256-bit (32-byte) key
 * encoded as a 64-character lowercase hex string.
 *
 * Uses crypto.getRandomValues (available in Hermes / RN 0.73+).
 * The generated string is never assigned to a variable with a name
 * that could leak it into logs or error payloads.
 */
function generateEncryptionKey(): string {
  const bytes = new Uint8Array(32);
  // crypto.getRandomValues is available in React Native 0.73+ (Hermes)
  // and in all Expo 52 environments
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    // Fallback: should not occur in Expo 52 / RN 0.76 — included defensively
    for (let i = 0; i < 32; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── Initializer ─────────────────────────────────────────────────────────────

/**
 * Must be called once at app bootstrap (app/_layout.tsx) and awaited
 * before any navigation or repository access.
 *
 * On first launch: generates and stores the encryption key in Keychain.
 * On subsequent launches: retrieves the key from Keychain.
 * On any failure: throws StorageInitError. Never opens unencrypted storage.
 */
export async function initializeStorage(): Promise<void> {
  // Idempotent: safe to call multiple times (e.g. during hot reload)
  if (isStorageReady()) return;

  // ── Step 1: retrieve existing key ────────────────────────────────────────
  let key: string | null = null;

  try {
    key = await SecureStore.getItemAsync(KEYCHAIN_KEY_ID);
  } catch {
    throw new StorageInitError(
      'KEYCHAIN_READ_FAILED',
      'Failed to read the MMKV encryption key from Keychain. ' +
        'The device may not support SecureStore.'
    );
  }

  // ── Step 2: first launch — generate and persist key ───────────────────────
  if (key === null) {
    const freshKey = generateEncryptionKey();

    try {
      await SecureStore.setItemAsync(KEYCHAIN_KEY_ID, freshKey, {
        // Not migrated to a new device when restoring from backup.
        // Intentional: MMKV data is device-local; a restored MMKV without
        // the matching key would be unreadable. Users re-onboard on new devices.
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    } catch {
      throw new StorageInitError(
        'KEYCHAIN_WRITE_FAILED',
        'Failed to store the MMKV encryption key in Keychain. ' +
          'Ensure the app has Keychain entitlements.'
      );
    }

    key = freshKey;
  }

  // ── Step 3: open encrypted MMKV instance ──────────────────────────────────
  // key is captured in closure scope only — never exposed beyond this block
  try {
    encryptedStorage = new MMKV({
      id: MMKV_INSTANCE_ID,
      encryptionKey: key,
    });
  } catch {
    throw new StorageInitError(
      'MMKV_INIT_FAILED',
      'Failed to initialise the encrypted MMKV instance. ' +
        'The encryption key may not match the existing database.'
    );
  }

  // key goes out of scope here — it is not stored in any module-level variable
}
