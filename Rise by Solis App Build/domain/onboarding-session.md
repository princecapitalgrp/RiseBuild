# domain/onboarding-session.md
# Rise by Solis — Onboarding Session Survival

**Purpose:** Define precisely how the onboarding-to-auth handoff behaves across three device scenarios.
This document governs the routing logic in `app/index.tsx` and the MMKV write order in `ArchetypeRevealScreen`.

---

## The Problem

The user completes 10 onboarding questions and reaches the archetype reveal.
At that moment — before they've created an account — we have their profile in memory.

If the app is killed, the device rebooted, or the process purged before auth completes,
we must decide: what does the user see when they relaunch?

Three scenarios. Each has a different answer.

---

## Scenario Table

| Scenario | Condition | Behavior | User Experience |
|---|---|---|---|
| **A — Same session** | App not purged (XState context still in memory) | Resume at auth gate — context already loaded | Seamless. User sees auth options. |
| **B — Same device, purged** | App purged / backgrounded too long, but `session:pending_onboarding` MMKV key exists | Skip welcome → render auth gate with pre-loaded profile from MMKV | Feels seamless. Profile was saved. |
| **C — Different device before auth** | No MMKV record on new device (profile never written to cloud without auth) | Not recoverable. Render welcome screen. Show explicit message. | Honest. User re-onboards. This is by design. |

---

## Scenario A — Same Session (App Not Purged)

**Condition:** The user navigated through all 10 steps, saw the archetype reveal, and the app is still alive.

**Behavior:**
- XState context holds the complete `Partial<OnboardingProfile>` in memory
- `app/index.tsx` detects `sessionState === 'pending_onboarding'` from `SessionRepository`
- Renders auth gate — XState context is passed directly (no MMKV read required)

**Routing in `app/index.tsx`:**
```typescript
if (sessionState === 'authenticated') → push /(app)/today
if (sessionState === 'pending_onboarding') → push /(auth)   ← also handles Scenario B
else → render welcome screen
```

---

## Scenario B — Same Device, App Purged

**Condition:** The app was purged from memory (killed by OS, backgrounded too long, device restarted) after the archetype reveal, but before auth was completed. The user relaunches the app.

**Behavior:**
1. `app/index.tsx` calls `SessionRepository.getState()` on launch
2. Reads `session:pending_onboarding` from MMKV → non-null
3. Sets `sessionState = 'pending_onboarding'`
4. Pushes to `/(auth)` — auth screen reads `profile:onboarding` from MMKV to pre-load archetype display

**Why this works:** MMKV writes happen synchronously at archetype reveal, before any navigation. Even if the process is killed 1ms later, the MMKV record is guaranteed to be present.

**Auth screen behavior (Scenario B):**
```typescript
const pending = SessionRepository.getPendingOnboarding()
if (pending) {
  // Show archetype name and description above the auth buttons
  // e.g. "You're an Architect. Let's keep your work."
  // This removes friction and explains why they should create an account
}
```

---

## Scenario C — Different Device Before Auth

**Condition:** The user completed onboarding on Device A, was shown the archetype reveal, but did not complete auth. They are now on Device B (or Device A after a fresh install that wiped MMKV).

**Behavior:**
- No `session:pending_onboarding` key in MMKV → `sessionState === 'none'`
- `app/index.tsx` renders the welcome screen
- The archetype and onboarding answers from the previous device are not recoverable

**Why this is intentional:**
Without auth, there is no cloud record. This is the privacy promise: we don't write anything to the cloud without your consent (account creation). If you choose not to create an account and switch devices, we cannot recover your session.

**What the user sees:**
A clear, honest message on the welcome screen if we detect this scenario is likely (e.g., if the user tries to tap "Continue" but there's no session):

> "Your morning profile is saved on your device. Sign in to access it from anywhere, or start fresh here."

We do not say "your data is lost." We say what's true: it's on the other device, or can be rebuilt.

---

## MMKV Write Order (Critical — Must Not Be Reordered)

Executed in `ArchetypeRevealScreen` immediately after archetype calculation:

```typescript
// Step 1: Calculate archetype (pure computation)
const { archetype, translation, confidence } = calculateArchetype(onboardingContext)

// Step 2: Build the full profile
const profile: OnboardingProfile = {
  ...onboardingContext,
  internalArchetype: archetype,
  archetypeTranslation: translation,
  archetypeConfidence: confidence,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  profileVersion: 1,
}

// Step 3: Write session key FIRST (synchronous — this is the recovery anchor)
SessionRepository.writePendingOnboarding({
  profile,
  calculatedArchetype: archetype,
  archetypeTranslation: translation,
  archetypeConfidence: confidence,
  completedSteps: getAllCompletedStepNames(),
  deviceOrigin: getDeviceId(),
  savedAt: new Date().toISOString(),
})
// session:pending_onboarding is now written

// Step 4: Write full profile (synchronous — confirms the profile is fully available)
ProfileRepository.writeOnboarding(profile)
// profile:onboarding is now written

// Step 5: NOW navigate to auth gate
router.push('/(auth)')
```

**Why this order matters:**
- If the app is killed between Step 2 and Step 3: session key not written → Scenario C (acceptable — archetype not calculated)
- If the app is killed between Step 3 and Step 4: session key written, partial profile → Scenario B with partial data. Auth screen reads what's available and prompts re-onboard if profile is incomplete.
- If the app is killed between Step 4 and Step 5: both keys written → Scenario B works perfectly. User relaunches → auth gate appears with full profile.

The session key is written first because it is the recovery anchor. If only one write can succeed, it must be the one that determines routing.

---

## Session State Machine

The session state (`SessionStateValue`) is managed by `SessionRepository` and read on every app launch:

```
'none'                  → welcome screen
'pending_onboarding'    → auth gate (with pre-loaded archetype if available)
'authenticated'         → today screen (/(app)/today)
```

**Transitions:**
- `none` → `pending_onboarding`: triggered by ArchetypeRevealScreen MMKV writes
- `pending_onboarding` → `authenticated`: triggered by successful auth (Firebase sign-in)
- `authenticated` → `none`: triggered by sign-out or account deletion (clears all MMKV + Keychain)

---

## `app/index.tsx` Routing Logic (Full)

```typescript
export default function RootIndex() {
  const sessionState = useSession() // reads SessionRepository on mount

  useEffect(() => {
    if (sessionState === 'loading') return

    if (sessionState === 'authenticated') {
      router.replace('/(app)/today')
    } else if (sessionState === 'pending_onboarding') {
      router.replace('/(auth)')
    } else {
      // sessionState === 'none' — render welcome inline (not a push)
    }
  }, [sessionState])

  if (sessionState === 'loading') return <SplashScreen />
  if (sessionState !== 'none') return null // routing in progress

  return <WelcomeScreen />
}
```

---

## Edge Cases

### Pending Onboarding Edge Cases

| Case | Handling |
|---|---|
| `session:pending_onboarding` exists but `profile:onboarding` is missing | `PendingOnboardingSession.profile` contains `Partial<OnboardingProfile>` and `calculatedArchetype` is already stored in the pending session. Recompute is not needed — archetype is recoverable from the pending session directly. Auth screen renders the archetype reveal and proceeds to auth gate. After auth, complete the profile write using `PendingOnboardingSession.profile` data. Only prompt re-onboard if the partial profile is missing the archetype inputs required for `calculateArchetype()` to be valid. |
| `profile:onboarding` exists but `session:pending_onboarding` is missing | Anomalous state. Treat as `none`. Render welcome screen. The session key is the routing anchor — if it's absent, we do not route to auth gate. |
| MMKV decryption fails on launch | Treat all keys as absent. Route to welcome. Log diagnostic event (non-personal) to Firestore. Do not crash. |
| Auth succeeds but UID is different from `OnboardingProfile.uid` (pre-auth state) | Update `OnboardingProfile.uid` with the new Firebase UID on auth completion. Write `profile:user`. Delete `session:pending_onboarding`. |

### Cross-User Same-Device Sign-Out Protection

When User A signs out on a shared or previously used device, User B must not see or inherit User A's data. This is enforced by a strict sign-out and sign-in sequence:

**On sign-out (User A):**
1. Write `session:state` → `'none'`
2. Delete `profile:user` (auth identity gone)
3. Delete `session:pending_onboarding` (no ghost session for next user)
4. **Preserve** User A's personal data (`profile:onboarding`, all loop keys) — it belongs to User A, not the device. If User A signs back in later on this device, their data is still here.
5. Sign out of Firebase Auth

**On sign-in (User B):**
1. Firebase auth completes — new UID obtained
2. **UID mismatch check:** Compare incoming UID against `profile:onboarding.uid` and `memory.uid`
3. If UIDs differ: User B is a different person. Immediately wipe all personal MMKV keys before loading User B's session (loop data, profile, memory all belong to User A). Do not show User B anything from User A.
4. If UIDs match: User A returned. Restore session normally.
5. Load User B's profile from Firestore (if they have prior account on another device) or route to onboarding

**UID mismatch wipe scope:**
```
DELETE: checkin:*, context:*, operatingState:*, plan:*, execution:*, reflection:*, memory, profile:onboarding, session:pending_onboarding
PRESERVE: profile:user (will be overwritten with User B's data), Keychain MMKV key (device-level)
```

The MMKV encryption key stays in Keychain — it is device-bound, not user-bound. User A's data was encrypted with this key and is now deleted. User B's data will be encrypted with the same key going forward.

### Account Lifecycle

| Action | MMKV | Keychain | Firestore |
|---|---|---|---|
| Sign out | Delete `profile:user`, `session:pending_onboarding`, `session:state` → `'none'`. Preserve all personal data. | No change | No change |
| Sign in (same user) | Restore `profile:user`. Recheck UID match. | No change | Read `subscriptions/{uid}` |
| Sign in (different user) | Wipe all personal data (see above). Write new `profile:user`. | No change | Read `subscriptions/{uid}` |
| Delete account | Wipe all MMKV keys. | Wipe auth token. Wipe MMKV key. | Delete `subscriptions/{uid}`. Call `auth.deleteUser()`. |
