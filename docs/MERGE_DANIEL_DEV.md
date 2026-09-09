# Merge Strategy: daniel-dev into waleedcodespace

**Purpose:** Single reference for merging the `daniel-dev` branch into `waleedcodespace` while **prioritizing our Convex backend**. We take Daniel's frontend/design and his **additive** Convex `.ts` files; we keep our schema, our Convex functions, our hooks, stores, and utils. We then **adapt our schema** to support his additive files if needed.

**Source branch:** `origin/daniel-dev`  
**Target branch:** `waleedcodespace`  
**Repo:** https://github.com/AppFlow-Studio/otopair

---

## Table of contents

1. [Priority rule](#1-priority-rule)
2. [Branch context and what each side changed](#2-branch-context-and-what-each-side-changed)
3. [Pre-merge checklist](#3-pre-merge-checklist)
4. [Merge strategy (high level)](#4-merge-strategy-high-level)
5. [File rules (detailed)](#5-file-rules-detailed)
6. [Step-by-step execution](#6-step-by-step-execution)
7. [Quick reference: paths to revert vs keep](#7-quick-reference-paths-to-revert-vs-keep)
8. [Post-merge: schema adaptation for additive Convex files](#8-post-merge-schema-adaptation-for-additive-convex-files)
9. [What may break until schema is adapted](#9-what-may-break-until-schema-is-adapted)
10. [Copy-paste command reference](#10-copy-paste-command-reference)

---

## 1. Priority rule

- **Our Convex wins over Daniel's** in every conflicting file.
- **Additive** Convex files (only on daniel-dev, no conflict) are **kept**; we adapt our schema to what those files expect.
- Even if some functionality (e.g. onboarding questions from Convex) temporarily fails, we keep our schema and Convex; we add or adjust schema only to support the additive `.ts` files we chose to keep.

---

## 2. Branch context and what each side changed

**Common base:** Both branches diverged from the same ancestor. Compare with:

```bash
git merge-base waleedcodespace origin/daniel-dev
```

**Our branch (waleedcodespace) changed:**

- **Convex:** Full backend — schema, bookings, mechanics, shops, services, time_slots, vehicle_owners, users, etc., and `_generated`.
- **Hooks:** All Convex-facing hooks (`useBookingsFromConvex`, `useMechanicsFromConvex`, `useShopsFromConvex`, etc.).
- **Stores:** Booking, mechanic, schedule, search, shop, vehicle stores; store types; mock data (mockMechanics, mockSchedules, mockShops).
- **Utils:** bookingAdapter, timeSlotUtils, linking.
- **App/UI:** Booking flow screens (mechanic/shop detail, payment, confirmation), bookings list, Live Tracker, demo.
- **Docs:** All docs in `docs/`.

**Daniel's branch (daniel-dev) changed:**

- **App:** Onboarding index, root layout, index, membership, suggested-deals; home index; settings (about, notification-preferences, refer-a-friend, two-factor-method, two-factor-verify).
- **Onboarding components:** OnboardingFlow and many steps (ConfirmPhoneNumber, CreatePassword, EmailConfirm, EmailEntry, EmailPasswordLogin, EmailSignup, EmailVerification, LoginMethods, Login, Name, PhoneNumber, ProfilePhoto, SignUpMethods, Signup, UserIntent, Username, Welcome).
- **Home/settings/payments UI:** ActionCardsCarousel, FinishAccountSetupCard, ActivityRewardsScreen, AddPaymentScreen; shared-ui (BlurHeaderOverlay, FooterButton, ReferralUtils, ScrollDrivenGradientBackground, index).
- **Tell-us-about:** TellUsAboutFlow and steps (AdditionalPreferences, CarUsage, DecisionStyle, DoItYourself, Experience, HouseholdRole, MaintenanceApproachLevel1/Level3, MaintenanceFrustration, MaintenanceTracking, PartsPhilosophy, PrimaryReason, RepairQuoteNeeds, ServiceHistory, ServicePriorities, ShopPriorities, ShopType, WhyNewOption).
- **Convex (additive only):** `onboarding_questions.ts`, `user_question_answers.ts`, `seed_onboarding_questions.ts`.
- **Convex (conflicting):** schema, users, `_generated/api.d.ts`.
- **Hooks/stores (additive):** useOnboardingPersistence, useOnboardingQuestion, usePrefetchOnboardingQuestions; useOnboardingQuestionsStore; changes to useOnboardingStore.

**Overlap (both touched):** `app/_layout.tsx`, `convex/schema.ts`, `convex/users.ts`, `convex/_generated/api.d.ts`, `package.json`, `package-lock.json`. We resolve by keeping **ours** for Convex and package files; we take **Daniel's** for `app/_layout.tsx`.

---

## 3. Pre-merge checklist

- [ ] Working tree clean or changes committed/stashed.
- [ ] Fetch latest daniel-dev: `git fetch origin daniel-dev`.
- [ ] Create backup branch: `git branch waleedcodespace-backup` (optional but recommended).
- [ ] You are on branch `waleedcodespace`.

---

## 4. Merge strategy (high level)

**Option A (recommended):** Merge `origin/daniel-dev` into `waleedcodespace`, then revert the "keep ours" paths (Convex except additive files, hooks, stores, utils, docs, package files, .env). Restore Daniel's additive Convex files after reverting Convex. Take Daniel's version for `app/_layout.tsx`. Resolve any remaining conflicts by choosing per file rule below.

**Option B:** Merge and resolve every conflict manually, applying the same file rules.

---

## 5. File rules (detailed)

### 5.1 Keep OUR version (revert after merge)

**Convex (except additive files):**

- Every file that exists on our branch: `convex/schema.ts`, `convex/users.ts`, `convex/bookings.ts`, `convex/mechanics.ts`, `convex/shops.ts`, `convex/services.ts`, `convex/time_slots.ts`, `convex/vehicle_owners.ts`, `convex/vehicles.ts`, and all other `convex/*.ts` and `convex/_generated/*`.
- **Do not revert** (keep from merge): `convex/onboarding_questions.ts`, `convex/user_question_answers.ts`, `convex/seed_onboarding_questions.ts`.

**Convex-facing hooks:**

- `hooks/useBookingsFromConvex.ts`
- `hooks/useCalendarAvailabilityForShop.ts`
- `hooks/useCreateBookingConvex.ts`
- `hooks/useMechanicsFromConvex.ts`
- `hooks/useMyBookingsWithDetails.ts`
- `hooks/useNextAvailabilityForShop.ts`
- `hooks/useNextAvailabilityPerMechanicForShop.ts`
- `hooks/useRecentlyBookedMechanicIdsFromConvex.ts`
- `hooks/useRecentlyBookedShopIdsFromConvex.ts`
- `hooks/useServiceCategoriesFromConvex.ts`
- `hooks/useServiceVehicleSpecsForEngine.ts`
- `hooks/useServicesFromConvex.ts`
- `hooks/useShopPortfolioFromConvex.ts`
- `hooks/useShopsFromConvex.ts`
- `hooks/useTimeSlotsForShop.ts`
- `hooks/useUserFromConvex.ts`
- `hooks/useVehicleOwnershipFromConvex.ts`

**Stores:**

- `stores/useBookingStore.ts`
- `stores/useMechanicStore.ts`
- `stores/useScheduleStore.ts`
- `stores/useSearchStore.ts`
- `stores/useShopStore.ts`
- `stores/useVehicleStore.ts`
- `stores/types/store.types.ts`
- `stores/data/mockMechanics.ts`
- `stores/data/mockSchedules.ts`
- `stores/data/mockShops.ts`

**Utils:**

- `utils/bookingAdapter.ts`
- `utils/timeSlotUtils.ts`
- `utils/linking.ts`

**Docs:**

- All of `docs/` (our versions).

**Config / env:**

- `package.json`, `package-lock.json` — keep ours (Convex and app deps); add any Daniel UI deps manually later if needed.
- `.env` — keep ours (secrets and Convex config).

### 5.2 Take DANIEL's version (accept from merge or resolve to his)

**App screens and layout:**

- `app/(main-tabs)/home/index.tsx`
- `app/(main-tabs)/settings/about.tsx`
- `app/(main-tabs)/settings/notification-preferences.tsx`
- `app/(main-tabs)/settings/refer-a-friend.tsx`
- `app/(main-tabs)/settings/two-factor-method.tsx`
- `app/(main-tabs)/settings/two-factor-verify.tsx`
- `app/(onboarding)/index.tsx`
- `app/_layout.tsx`
- `app/index.tsx`
- `app/membership.tsx`
- `app/suggested-deals.tsx`

**Onboarding components:**

- `components/onboarding/OnboardingFlow.tsx`
- All steps under `components/onboarding/steps/` (ConfirmPhoneNumberStep, CreatePasswordStep, EmailConfirmStep, EmailEntryStep, EmailPasswordLoginStep, EmailSignupStep, EmailVerificationStep, LoginMethodsStep, LoginStep, NameStep, PhoneNumberStep, ProfilePhotoStep, SignUpMethodsStep, SignupStep, UserIntentStep, UsernameStep, WelcomeStep).

**Home / settings / payments UI:**

- `components/home/ActionCardsCarousel.tsx`
- `components/home/FinishAccountSetupCard.tsx`
- `components/payments/ActivityRewardsScreen.tsx`
- `components/payments/AddPaymentScreen.tsx`
- `components/shared-ui/BlurHeaderOverlay.tsx`
- `components/shared-ui/FooterButton.tsx`
- `components/shared-ui/ReferralUtils.ts`
- `components/shared-ui/ScrollDrivenGradientBackground.tsx`
- `components/shared-ui/index.ts`

**Tell-us-about flow:**

- `components/tell-us-about/TellUsAboutFlow.tsx`
- All steps they changed or added (AdditionalPreferencesStep, CarUsageStep, DecisionStyleStep, DoItYourselfStep, ExperienceStep, HouseholdRoleStep, MaintenanceApproachStepLevel1, MaintenanceApproachStepLevel3, MaintenanceFrustrationStep, MaintenanceTrackingStep, PartsPhilosophyStep, PrimaryReasonStep, RepairQuoteNeedsStep, ServiceHistoryStep, ServicePrioritiesStep, ShopPrioritiesStep, ShopTypeStep, WhyNewOptionStep).

**Additive Convex files (keep from merge):**

- `convex/onboarding_questions.ts`
- `convex/user_question_answers.ts`
- `convex/seed_onboarding_questions.ts`

**Additive hooks and stores (keep from merge):**

- `hooks/useOnboardingPersistence.ts`
- `hooks/useOnboardingQuestion.ts`
- `hooks/usePrefetchOnboardingQuestions.ts`
- `stores/useOnboardingQuestionsStore.ts`
- `stores/useOnboardingStore.ts` (Daniel's version; merges UI/step logic with our store if needed).

### 5.3 Handle carefully

- **Onboarding persistence:** Daniel's hooks and stores call his Convex API (onboarding_questions, user_question_answers). We keep his **additive** Convex files and his UI/hooks/stores; we **adapt our schema** so that our schema defines the tables and indexes those files expect (see §8).
- **package.json / package-lock.json:** We keep ours on merge. If Daniel added UI-only deps (e.g. icons, animations), add them manually later and run `npm install`.

---

## 6. Step-by-step execution

1. **Backup and fetch**
   - `git fetch origin daniel-dev`
   - `git branch waleedcodespace-backup` (optional)

2. **Merge**
   - `git merge origin/daniel-dev -m "Merge daniel-dev: frontend/design; keep our Convex and backend"`
   - If conflicts appear, proceed to the next steps to resolve them.

3. **Revert Convex (two steps)**
   - Revert all Convex to ours:  
     `git checkout waleedcodespace -- convex/`
   - Restore Daniel's additive files:  
     `git checkout origin/daniel-dev -- convex/onboarding_questions.ts convex/user_question_answers.ts convex/seed_onboarding_questions.ts`

4. **Revert other "keep ours" paths**
   - Hooks (list in §7), stores, utils, docs, package.json, package-lock.json, .env.
   - Example:  
     `git checkout waleedcodespace -- hooks/useBookingsFromConvex.ts hooks/useCalendarAvailabilityForShop.ts ... docs/ package.json package-lock.json`
   - Restore .env if it was deleted:  
     `git checkout waleedcodespace -- .env` (if tracked).

5. **Take Daniel's version for conflicting frontend file**
   - `git checkout origin/daniel-dev -- app/_layout.tsx`

6. **Regenerated Convex types**
   - After adding the additive Convex files, restore our `convex/_generated/api.d.ts` for the commit so the repo is consistent:  
     `git checkout waleedcodespace -- convex/_generated/api.d.ts`
   - Then run `npx convex dev` (or `npx convex codegen`) locally so Convex regenerates types including the new onboarding API.

7. **Commit**
   - `git add .`
   - `git commit -m "Merge daniel-dev: frontend/design from Daniel; keep our Convex, hooks, stores, utils; add onboarding_questions, user_question_answers, seed_onboarding_questions"`  
     (or complete the merge commit if one was in progress.)

8. **Smoke test**
   - Run the app; go through onboarding, tell-us-about, one booking flow, and settings. Confirm UI is from Daniel and data still comes from our Convex. Fix any import or API name issues if the additive files reference Convex in a way that doesn’t match our `api`.

---

## 7. Quick reference: paths to revert vs keep

**Revert to ours (keep ours):**

```text
convex/                    (then restore additive files in step 3.2)
convex/_generated/api.d.ts (use ours for commit; Convex will regenerate)
hooks/useBookingsFromConvex.ts
hooks/useCalendarAvailabilityForShop.ts
hooks/useCreateBookingConvex.ts
hooks/useMechanicsFromConvex.ts
hooks/useMyBookingsWithDetails.ts
hooks/useNextAvailabilityForShop.ts
hooks/useNextAvailabilityPerMechanicForShop.ts
hooks/useRecentlyBookedMechanicIdsFromConvex.ts
hooks/useRecentlyBookedShopIdsFromConvex.ts
hooks/useServiceCategoriesFromConvex.ts
hooks/useServiceVehicleSpecsForEngine.ts
hooks/useServicesFromConvex.ts
hooks/useShopPortfolioFromConvex.ts
hooks/useShopsFromConvex.ts
hooks/useTimeSlotsForShop.ts
hooks/useUserFromConvex.ts
hooks/useVehicleOwnershipFromConvex.ts
stores/useBookingStore.ts
stores/useMechanicStore.ts
stores/useScheduleStore.ts
stores/useSearchStore.ts
stores/useShopStore.ts
stores/useVehicleStore.ts
stores/types/store.types.ts
stores/data/mockMechanics.ts
stores/data/mockSchedules.ts
stores/data/mockShops.ts
utils/bookingAdapter.ts
utils/timeSlotUtils.ts
utils/linking.ts
docs/
package.json
package-lock.json
.env
```

**Do not revert (keep from merge / Daniel):**

- `convex/onboarding_questions.ts`
- `convex/user_question_answers.ts`
- `convex/seed_onboarding_questions.ts`
- `app/_layout.tsx` (take Daniel's)
- All other app/, components/ changes from Daniel (onboarding, tell-us-about, home, settings, payments, shared-ui).
- `hooks/useOnboardingPersistence.ts`, `hooks/useOnboardingQuestion.ts`, `hooks/usePrefetchOnboardingQuestions.ts`
- `stores/useOnboardingQuestionsStore.ts`, `stores/useOnboardingStore.ts` (Daniel's version).

---

## 8. Post-merge: schema adaptation for additive Convex files

Our schema must define the tables and indexes that the additive Convex files use.

**`convex/onboarding_questions.ts`** expects:

- Table `onboarding_questions` with fields used in queries (e.g. `rank`, `step_name`, `is_active`) and indexes:
  - `by_rank` on `rank`
  - `by_step_name` on `step_name`
- Table `onboarding_question_answers` with `question_id` and index `by_question_id` on `question_id`.

**`convex/user_question_answers.ts`** expects:

- Table `user_question_answers` with fields: `user_id`, `question_id`, `answer_id`, `answer_ids`, `free_text_answer`, `answered_at`, and index `by_user_and_question` on `user_id` and `question_id`.
- Table `users` (we already have this) with index `by_clerkUserId` on `clerkUserId`.

**`convex/seed_onboarding_questions.ts`** expects:

- Tables `onboarding_questions` and `onboarding_question_answers` (same as above) so that the seed can insert questions and answers.

If our schema already defines these tables and indexes (see [convex/schema.ts](../convex/schema.ts)), no change is needed. If not, add:

- `onboarding_questions` with indexes `by_rank`, `by_step_name`, and field `is_active`.
- `onboarding_question_answers` with `question_id` and index `by_question_id`.
- `user_question_answers` with `user_id`, `question_id`, `answer_id`, `answer_ids`, `free_text_answer`, `answered_at`, and index `by_user_and_question`.

Then run Convex codegen and redeploy. Optionally run the seed: use the mutations exposed by `seed_onboarding_questions.ts` (or call them from a one-off script) to populate onboarding questions and answers.

---

## 9. What may break until schema is adapted

- **Onboarding questions / persistence:** If the schema does not yet define `onboarding_questions`, `onboarding_question_answers`, and `user_question_answers` with the expected indexes, any code that calls `api.onboarding_questions.*` or `api.user_question_answers.*` will fail at runtime until the schema is updated and codegen is run.
- **Everything else** (bookings, shops, mechanics, users, vehicles, etc.) remains on our Convex and should work as before.

---

## 10. Copy-paste command reference

**Fetch and backup:**

```bash
git fetch origin daniel-dev
git branch waleedcodespace-backup
```

**Merge:**

```bash
git merge origin/daniel-dev -m "Merge daniel-dev: frontend/design; keep our Convex and backend"
```

**Resolve: revert Convex then restore additive files:**

```bash
git checkout waleedcodespace -- convex/
git checkout origin/daniel-dev -- convex/onboarding_questions.ts convex/user_question_answers.ts convex/seed_onboarding_questions.ts
```

**Resolve: revert hooks, stores, utils, docs, package, .env:**

```bash
git checkout waleedcodespace -- \
  hooks/useBookingsFromConvex.ts hooks/useCalendarAvailabilityForShop.ts hooks/useCreateBookingConvex.ts \
  hooks/useMechanicsFromConvex.ts hooks/useMyBookingsWithDetails.ts hooks/useNextAvailabilityForShop.ts \
  hooks/useNextAvailabilityPerMechanicForShop.ts hooks/useRecentlyBookedMechanicIdsFromConvex.ts hooks/useRecentlyBookedShopIdsFromConvex.ts \
  hooks/useServiceCategoriesFromConvex.ts hooks/useServiceVehicleSpecsForEngine.ts hooks/useServicesFromConvex.ts \
  hooks/useShopPortfolioFromConvex.ts hooks/useShopsFromConvex.ts hooks/useTimeSlotsForShop.ts \
  hooks/useUserFromConvex.ts hooks/useVehicleOwnershipFromConvex.ts \
  stores/useBookingStore.ts stores/useMechanicStore.ts stores/useScheduleStore.ts stores/useSearchStore.ts \
  stores/useShopStore.ts stores/useVehicleStore.ts stores/types/store.types.ts \
  stores/data/mockMechanics.ts stores/data/mockSchedules.ts stores/data/mockShops.ts \
  utils/bookingAdapter.ts utils/timeSlotUtils.ts utils/linking.ts \
  docs/ package.json package-lock.json .env
```

**Take Daniel's app layout:**

```bash
git checkout origin/daniel-dev -- app/_layout.tsx
```

**Restore our generated API types (then run Convex codegen):**

```bash
git checkout waleedcodespace -- convex/_generated/api.d.ts
git add convex/_generated/api.d.ts
```

**Complete merge commit:**

```bash
git add .
git commit -m "Merge daniel-dev: frontend/design from Daniel; keep our Convex, hooks, stores, utils; add onboarding_questions, user_question_answers, seed_onboarding_questions"
```

---

**Last updated:** After merge of `origin/daniel-dev` into `waleedcodespace`. For schema and API details, see [REFERENCE.md](./REFERENCE.md). For booking integration, see [BOOKING_INTEGRATION.md](./BOOKING_INTEGRATION.md).
