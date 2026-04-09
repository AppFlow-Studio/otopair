# User Signup & Authentication Flow

## Architecture Overview

| Layer | Technology | Role |
|-------|-----------|------|
| Auth | Clerk | Session management, OAuth providers, email/password, phone verification |
| Backend | Convex | User records, onboarding Q&A, file storage |
| Local State | Zustand | Onboarding progress, form data, auth UI flags |
| Navigation | Expo Router | Auth-aware routing, stack navigation with animated transitions |

## Entry Point: Auth-Aware Routing

**File:** `app/index.tsx`

The root index checks auth state on every mount and routes accordingly:

```
App Launch
  │
  ├─ Not loaded → Loading spinner
  ├─ Not signed in → /(onboarding)
  ├─ Signed in, no Convex user → /(main-tabs)/home (user created in background)
  ├─ Signed in, onboarding incomplete → /(onboarding) with resume params
  └─ Signed in, onboarding complete → /(main-tabs)/home
```

**Provider Stack** (`app/_layout.tsx`):
1. `ClerkProvider` (with `tokenCache` for persistent sessions)
2. `ConvexProviderWithClerk` (Convex client integrated with Clerk auth)
3. `GestureHandlerRootView`
4. `ThemeProvider`
5. `BottomSheetModalProvider`

Two key background components run in the layout:
- **`EnsureConvexUserRecord`** - Creates a Convex user document after Clerk login (with exponential backoff retry)
- **`SyncAuthStoreWithClerk`** - Keeps the Zustand auth store in sync with Clerk session state

---

## Signup Methods

### Google OAuth (`oauth_google`)

**Component:** `components/onboarding/steps/SignupStep.tsx`

1. User taps "Continue with Google"
2. Clerk SSO initiates with `strategy: "oauth_google"`, redirect: `otopair://oauth-callback`
3. Google consent screen opens in system browser
4. On success: session is set, Convex user ensured, flow proceeds to phone step
5. Pre-fills: `firstName`, `lastName`, `email`, `authProvider: "google"`

### Apple OAuth (`oauth_apple`)

Same flow as Google but with `strategy: "oauth_apple"`. Apple may hide the user's email (relay address provided instead).

### Email/Password

**Step 1 - Email Signup** (`EmailSignupStep.tsx`):
- Collects email + password (min 8 characters)
- Calls `signUp.create()` then `signUp.prepareEmailAddressVerification({ strategy: "email_code" })`

**Step 2 - Email Verification** (`EmailVerificationStep.tsx`):
- 6-digit code input with auto-focus and backspace navigation
- Calls `signUp.attemptEmailAddressVerification()`
- On success: activates session, ensures Convex user, proceeds to phone step
- Includes resend button and error modal for invalid codes

---

## Onboarding Steps (In Order)

After authentication, all users go through these steps. The progress bar tracks 11 steps (phone through location).

| # | Step | Component | Data Collected | Required | Notes |
|---|------|-----------|----------------|----------|-------|
| 1 | Welcome | `WelcomeStep` | - | - | Choose signup or login |
| 2 | Signup | `SignupStep` | authProvider, email, name | - | OAuth or email selection |
| 3 | Email Signup | `EmailSignupStep` | email, password | Email only | Skipped for OAuth |
| 4 | Email Verify | `EmailVerificationStep` | (verified email) | Email only | 6-digit code |
| 5 | Phone | `PhoneNumberStep` | phoneNumber, phoneCountryCode | Yes | Country picker with search |
| 6 | Confirm Phone | `ConfirmPhoneNumberStep` | phoneVerified | Yes | 6-digit SMS code, 60s resend timer |
| 7 | Name | `NameStep` | firstName, lastName | Yes | Pre-filled for OAuth users |
| 8 | Email Confirm | `EmailConfirmStep` | emailConfirmed | Yes | Displays collected email, allows editing |
| 9 | Profile Photo | `ProfilePhotoStep` | profilePhotoUri | No | Camera or library via expo-image-picker |
| 10 | User Intent | `UserIntentStep` | userIntentions[] | Yes | Multi-select from 10 options |
| 11 | Heard About | `HeardAboutStep` | heardAboutOtopair | Yes | Single-select, 7 options (dynamic from API) |
| 12 | Visit Reason | `VisitReasonStep` | visitReason | Yes | Single-select, 5 options (dynamic from API) |
| 13 | Zip Code | `ZipCodeStep` | zipCode | Yes | Validated as 5 or 5+4 digit format |
| 14 | Push Notifications | `PushNotificationsStep` | pushNotificationStatus | Yes | Auto-skipped if already granted |
| 15 | Location | `LocationServicesStep` | locationPermissionStatus | Yes | Auto-skipped if already granted |
| 16 | Complete | - | - | - | Marks onboarding done, redirects to home |

### User Intent Options (Step 10)

Users select one or more from:
1. Education / Learn about my car
2. Find a shop
3. Understand car maintenance
4. Track vehicle health
5. Maintenance reminders
6. Diagnose car issues
7. Save money on repairs
8. Track service history
9. Manage car settings
10. Improve car performance

### Phone Verification Paths

The phone verification mechanism differs based on how the user signed up:

- **OAuth users:** `user.createPhoneNumber()` + `prepareVerification()`
- **Email signup:** `signUp.update()` + `signUp.preparePhoneNumberVerification()`

Confirmation step similarly uses different Clerk methods:
- **OAuth:** `phoneNumberResource.attemptVerification()`
- **Email:** `signUp.attemptPhoneNumberVerification()`

### Permission Steps

Both permission steps share the same pattern:
1. Lazy-load the relevant Expo module (`expo-notifications` or `expo-location`)
2. Check current permission status
3. If already granted/provisional, auto-skip to next step
4. Show "Enable" / "Not now" buttons
5. Store result in onboarding store

---

## OAuth vs Email: Key Differences

| Aspect | OAuth (Google/Apple) | Email/Password |
|--------|---------------------|----------------|
| Initial auth | Clerk SSO, system browser | Email + password form |
| Email verification | Skipped (provider-verified) | 6-digit code to email |
| Session creation | Immediate on OAuth success | After email code verified |
| Phone setup API | `user.createPhoneNumber()` | `signUp.update()` + `preparePhoneNumberVerification()` |
| Pre-filled data | firstName, lastName, email from provider | No pre-filled profile data |
| Existing account detection | Auto-redirects to home if email matches | N/A (signup path only) |

---

## Resume Logic for Incomplete Onboarding

When a user has authenticated but hasn't finished onboarding (`me.onboardingCompleted === false`), the app calculates which steps are missing:

```
Step Completion Checks:
  phone        → !!data.phoneNumber
  confirm      → !!data.phoneVerified
  name         → !!(data.firstName && data.lastName)
  emailConfirm → !!data.emailConfirmed
  profilePhoto → !!data.profilePhotoUri
  userIntent   → !!(data.userIntentions?.length > 0)
  heardAbout   → !!data.heardAboutOtopair
  visitReason  → !!data.visitReason
  zipCode      → !!data.zipCode
  pushNotifs   → data.pushNotificationStatus !== null
  location     → data.locationPermissionStatus !== null
```

**Resume mode behavior:**
- Only incomplete steps are shown (filtered progress bar)
- Navigation stays within the filtered step array
- On completion: `router.back()` instead of `router.replace("/(main-tabs)/home")`

---

## Login Flow (Returning Users)

**Component:** `components/onboarding/steps/LoginStep.tsx`

- Three OAuth buttons + email/password form toggle
- Email login: `signIn.create()` + `signIn.attemptFirstFactor({ strategy: "password" })`
- On success:
  - Sets session with `setActive()`
  - Ensures Convex user record exists
  - Checks for pending account deletion → reactivates if needed
  - Sets `shouldShowReactivationSheet` flag for home screen notification
  - Navigates directly to home (no onboarding for returning users)

---

## Data Storage

### Zustand: `useOnboardingStore` (`stores/useOnboardingStore.ts`)

```typescript
interface OnboardingData {
  // Auth
  email: string | null
  phoneNumber: string | null          // Full number with country code
  phoneCountryCode: string | null     // e.g., "US"
  phoneVerified: boolean
  authProvider: "google" | "apple" | "email" | null
  emailConfirmed: boolean
  phoneNumberId: string | null        // Clerk phone resource ID

  // Profile
  firstName: string | null
  lastName: string | null
  profilePhotoUri: string | null      // Local file URI

  // Permissions
  pushNotificationsGranted: boolean
  pushNotificationStatus: "granted" | "provisional" | "denied" | "undetermined" | null
  locationGranted: boolean
  locationPermissionStatus: "granted" | "denied" | "undetermined" | null

  // Onboarding Questions
  userIntentions: string[] | null
  heardAboutOtopair: string | null
  visitReason: string | null
  zipCode: string | null
}
```

**Key methods:**
- `updateData(updates)` - Partial update
- `getIncompleteOnboardingSteps()` - Returns array of missing steps
- `isCreateAccountComplete()` - Checks if all core data is filled

### Zustand: `useAuthStore` (`stores/useAuthStore.ts`)

```typescript
interface AuthState {
  isNewUser: boolean              // true = just created, false = returning
  isAuthenticated: boolean        // Synced with Clerk
  shouldShowReactivationSheet: boolean  // One-time flag after reactivation
}
```

### Convex: `users` Table

```typescript
{
  clerkUserId: string              // Clerk external ID (indexed)
  auth_provider?: string           // "google" | "apple" | "email"
  first_name?: string
  last_name?: string
  email?: string
  emailConfirmed?: boolean
  phone?: string
  phoneVerified?: boolean
  profile_photo_url?: string | null
  profile_photo_storage_id?: string | null
  onboardingCompleted: boolean     // Flipped to true at completion
  tellUsAboutCompleted?: boolean
  user_intentions?: string[]
  createdAt: number
  lastUpdated?: number
}
```

### Convex: `onboarding_questions_answers` Table

```typescript
{
  user_id: Id<"users">
  questions_and_answers: Array<{
    question: string
    answer: string
  }>
  user_intentions?: {
    question: string
    intentions: string[]
  }
  car_knowledge_level?: number     // 1-3 scale from Tell Us About flow
  last_updated: number
}
```

---

## Completion & Transition

1. User reaches the "complete" step
2. `completeOnboarding()` Convex mutation sets `onboardingCompleted: true`
3. Normal mode: `router.replace("/(main-tabs)/home")`
4. Resume mode: `router.back()`
5. On next app launch, `app/index.tsx` routes directly to home

---

## Visual: Animation & Transitions

- **Step transitions:** Slide-from-right stack animation (250ms)
- **Gradient background:** 12 gradient color configs, 1200ms Bezier transition between steps
- **Keyboard:** Dismissed on every step navigation
- **Progress bar:** Shows only during the 11 trackable steps (phone through location)

---

## Key Source Files

| File | Purpose |
|------|---------|
| `app/index.tsx` | Auth-aware routing entry point |
| `app/_layout.tsx` | Root layout, providers, background auth sync |
| `app/(onboarding)/index.tsx` | Onboarding screen with resume params |
| `components/onboarding/OnboardingFlow.tsx` | Main flow container, step management |
| `components/onboarding/steps/SignupStep.tsx` | OAuth + email signup selection |
| `components/onboarding/steps/EmailSignupStep.tsx` | Email/password form |
| `components/onboarding/steps/EmailVerificationStep.tsx` | 6-digit email code |
| `components/onboarding/steps/LoginStep.tsx` | Returning user login |
| `components/onboarding/steps/PhoneNumberStep.tsx` | Phone input with country picker |
| `components/onboarding/steps/ConfirmPhoneNumberStep.tsx` | SMS code verification |
| `components/onboarding/steps/NameStep.tsx` | First/last name |
| `components/onboarding/steps/EmailConfirmStep.tsx` | Confirm/edit email |
| `components/onboarding/steps/ProfilePhotoStep.tsx` | Photo upload (optional) |
| `components/onboarding/steps/UserIntentStep.tsx` | App usage intentions |
| `components/onboarding/steps/HeardAboutStep.tsx` | Discovery channel |
| `components/onboarding/steps/VisitReasonStep.tsx` | Visit motivation |
| `components/onboarding/steps/ZipCodeStep.tsx` | Location zip code |
| `components/onboarding/steps/PushNotificationsStep.tsx` | Push permission |
| `components/onboarding/steps/LocationServicesStep.tsx` | Location permission |
| `stores/useOnboardingStore.ts` | Onboarding state (Zustand) |
| `stores/useAuthStore.ts` | Auth UI state (Zustand) |
| `convex/schema.ts` | Database schema definitions |
