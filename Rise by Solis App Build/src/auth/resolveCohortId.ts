/**
 * src/auth/resolveCohortId.ts
 *
 * Reads the cohort source key written externally before onboarding
 * (by TestFlight invite type, QR code deep link, or internal tooling)
 * and returns the matching CohortId.
 *
 * Key: solis.onboarding.cohort_source
 *   'A'        → ESCP / university cohort
 *   'C'        → referral cohort
 *   'internal' → internal team testing
 *   absent     → 'B' (default — organic / waitlist)
 *
 * Called once at auth completion, not in the screen layer.
 * Classification: aggregate-syncable (cohortId only — no personal content).
 */

import { encryptedStorage } from '../storage/mmkv';
import { COHORT_SOURCE } from '../storage/keys';
import type { CohortId } from '../../domain/types';

export function resolveCohortId(): CohortId {
  const raw = encryptedStorage.getString(COHORT_SOURCE);
  if (raw === 'A') return 'A';
  if (raw === 'C') return 'C';
  if (raw === 'internal') return 'internal';
  return 'B';
}
