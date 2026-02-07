# Merge Plan: temur-dev ↔ waleedcodespace

**Purpose:** Compare `temur-dev` and `waleedcodespace`, document all code differences, and plan merging—especially around Convex and vehicle data intelligence.

**Branches:**

- **waleedcodespace** (current): has Convex backend, vehicle schema, vehicle data intelligence pipeline, booking integration, onboarding, etc.
- **temur-dev**: older branch at common ancestor; no Convex folder, different app/component set.

---

## 1. Branch relationship

| Check                                           | Result                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------ |
| Merge base                                      | `b9550de` (MERGE 12-30-25: Removed redundant comments in map.tsx)        |
| Commits on **temur-dev** not in waleedcodespace | **None**                                                                 |
| Commits on **waleedcodespace** not in temur-dev | **~90 commits** (Convex, vehicle schema, booking, onboarding, refactors) |

**Conclusion:** `temur-dev` is strictly behind `waleedcodespace`. All new work (Convex, vehicle data intelligence, bookings, hooks, stores) lives on `waleedcodespace`. There are no commits on `temur-dev` to “import” into `waleedcodespace`.

---

## 2. Convex / vehicle data intelligence

### 2.1 What temur-dev has

- **No `convex/` folder.**  
  `git ls-tree temur-dev` shows no `convex/` and no `docs/`. So Temur’s branch has no Convex backend and no vehicle data intelligence in this repo.

### 2.2 What waleedcodespace has (vs temur-dev)

All of the following exist only on **waleedcodespace** (they appear as “added” when diffing temur-dev → waleedcodespace):

| Area                   | Files (all only on waleedcodespace)                                                                                                                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Schema & generated** | `schema.ts`, `_generated/api.d.ts`, `api.js`, `dataModel.d.ts`, `server.d.ts`, `server.js`                                                                                                                                                |
| **Vehicle pipeline**   | `vehicles.ts`, `vehicle_owners.ts`, `vehicle_specs.ts`, `specs.ts`, `fitments.ts`, `job_actuals.ts`, `engines.ts`, `trims.ts`, `models.ts`, `makes.ts`, `chassis_variants.ts`, `transmissions.ts`, `oemParts.ts`                          |
| **Booking & services** | `bookings.ts`, `time_slots.ts`, `services.ts`, `service_categories.ts`, `service_options.ts`, `service_vehicle_specs.ts`, `service_insights.ts`, `mechanics.ts`, `shops.ts`, `shops_hours.ts`, `shop_services.ts`, `shop_portfolio.ts`    |
| **Payments & history** | `payments.ts`, `payment_status_history.ts`, `booking_status_history.ts`, `transactions.ts`                                                                                                                                                |
| **AI / enrichment**    | `ai_conversations.ts`, `ai_messages.ts`, `ai_enrichment_logs.ts`, `manual_review_queue.ts`                                                                                                                                                |
| **Other**              | `users.ts`, `onboarding_questions_answers.ts`, `reviews.ts`, `spec_confirmations.ts`, `spec_variances.ts`, `follow_ups.ts`, `conversion_funnels.ts`, `analytics_events.ts`, `cdn_assets.ts`, `auth.config.ts`, `migrations.ts`, `seed.ts` |

**Diff stat (temur-dev → waleedcodespace):** 51 files under `convex/`, **+9,835 lines** (all additions on waleedcodespace).

### 2.3 Vehicle data intelligence on waleedcodespace

- **Schema:** `vehicles`, `vehicle_owners`, `vehicle_specs`, `engines`, `trims`, `models`, `makes`, `chassis_variants`, `transmissions`, `fitments`, `oemParts`, `service_vehicle_specs`, `job_actuals`, etc.
- **Logic:** `convex/specs.ts` (spec & intelligence access, `getFullVehicleSpecPack`), `convex/fitments.ts`, `convex/job_actuals.ts`, `convex/seed.ts` (vehicle intelligence demo seed).
- **Docs:** `docs/DATA_MODEL_VEHICLE_SPECS.md` describes vehicle specs and job actuals.

So the “Convex/vehicle data intelligence pipeline” is entirely on **waleedcodespace**; **temur-dev** has no Convex and no vehicle pipeline in this repo.

---

## 3. All code differences by area

Legend: **M** = modified on waleedcodespace, **D** = only on waleedcodespace (deleted from temur-dev view), **A** = added on waleedcodespace, **R** = renamed on waleedcodespace.

### 3.1 Root / config

- **M:** `.gitignore`, `README.md`, `app.json`, `package.json`, `package-lock.json`

### 3.2 App (`app/`)

- **M:** `_layout.tsx`, `index.tsx`, `(main-tabs)/_layout.tsx`, `(main-tabs)/ai-chat/index.tsx`, `(main-tabs)/bookings/index.tsx`, `(main-tabs)/cars/index.tsx`, `(main-tabs)/home/_layout.tsx`, `(main-tabs)/home/index.tsx`, `(main-tabs)/home/map.tsx`, `(main-tabs)/home/mechanic/[id]/*`, `(main-tabs)/settings/_layout.tsx`, `(main-tabs)/settings/index.tsx`, `(onboarding)/index.tsx`
- **D (only on waleedcodespace):** `add-car-info.tsx`, `add-payment.tsx`, `add-vehicle.tsx`, `demo-learning.tsx`, `demo.tsx`, `membership.tsx`, `suggested-deals.tsx`, `vehicle-added.tsx`, `vin-scanner.tsx`, `(main-tabs)/home/shop/[id]/*`, many `(main-tabs)/settings/*` (about, biometric, contact-us, faq, notification-preferences, privacy, refer-a-friend, success, terms, transactions, two-factor-\*)
- **R:** `app/payments.tsx` → `app/payment-methods.tsx`

### 3.3 Components

- **Booking:** Many **M** (FullScreenBookingView, MechanicCarouselSheet, ServiceBottomSheet, sheets, footers, topbars, etc.), **A** MechanicAvailabilityBreakdown, **D** (ShopDetails, ShopReviewsSection, several modals, CarSelectionCard, FloatingMapControls, FullSearchModal, etc.)
- **AI chat:** **M** (AIChatHistory, AIGreeting, AIInputBox, AIMessageBubble, AISuggestionTile, AITypingIndicator, index), **D** (AIAttachmentPanel, AIBookingCarousel, AIQuickReplies, AIReasoning, AISelectedImages, AIServicePicker, AISources, AIToast, AIWelcomeScreen, PromptSuggestions)
- **Home:** **M** (ActionCardsCarousel, FinishAccountSetupCard, FinishCarSetupCard, MechanicSearchBar, etc.), **A** AIAssistantButton, **D** AddFirstVehicleCard, HomeSearchOverlay, MoreServicesSection
- **Onboarding / Tell-us-about:** Multiple **M**, **A** (UsernameStep, AdditionalPreferencesStep, DoItYourselfStep, PrimaryReasonStep, WhyNewOptionStep, etc.), **R** (e.g. ServiceHistoryStep → CommunicationPreferenceStep, PartsPhilosophyStep → DecisionHelperStep, MaintenanceApproachStepLevel3 → MaintenanceApproachStep, etc.)
- **Cars, bookings, shared-ui, icons, payments:** Mix of **M**, **A**, **D** as in the full file list above.

### 3.4 Convex

- **All 51 files:** Present only on waleedcodespace (see Section 2.2). None exist on temur-dev.

### 3.5 Hooks

- **D (only on waleedcodespace):** All Convex-facing hooks: `useBookingsFromConvex`, `useCalendarAvailabilityForShop`, `useCreateBookingConvex`, `useEnsureConvexUser`, `useMechanicsFromConvex`, `useMyBookingsWithDetails`, `useNextAvailabilityForShop`, `useNextAvailabilityPerMechanicForShop`, `useOnboardingPersistence`, `useOnboardingQuestion`, `usePrefetchOnboardingQuestions`, `useRecentlyBookedMechanicIdsFromConvex`, `useRecentlyBookedShopIdsFromConvex`, `useServiceCategoriesFromConvex`, `useServiceVehicleSpecsForEngine`, `useServicesFromConvex`, `useShopPortfolioFromConvex`, `useShopsFromConvex`, `useTimeSlotsForShop`, `useTransactionsFromConvex`, `useUserFromConvex`, `useVehicleOwnershipFromConvex`, `useVoiceRecording`.

### 3.6 Docs

- **D (only on waleedcodespace):** All of `docs/` (AUTH*SESSION, BOOKING_INTEGRATION, CACHING_PLAN, CHECKLIST, DATA_MODEL_VEHICLE_SPECS, MERGE*_, ONBOARDING*QA, REFERENCE, SCHEMA*_, diagrams, README).

### 3.7 Constants, services, stores, utils

- **M:** `constants/services.ts`, `constants/theme.ts`; `services/types/ai.types.ts`, `stores/*` (booking, mechanic, onboarding, payment, schedule, shop, vehicle, useAIChatStore), `utils/bookingAdapter.ts`
- **D:** `constants/faq.ts`; `services/ai/scenarioEngine.ts`, `scenarios.ts`, `types.ts`; `stores/useAuthStore`, `useSearchStore`, `stores/data/mockTransactions.ts`; `utils/linking.ts`, `utils/timeSlotUtils.ts`
- **A:** `services/api/aiChat.ts`, `services/api/huggingface.ts`, `services/config/ai.config.ts`; `stores` mock and type updates; `components/payments/PaymentMethodsMock.tsx`

### 3.8 Assets

- **D (only on waleedcodespace):** Many images under `assets/images/` and `assets/animations/` (temur-dev has a smaller set).

---

## 4. Summary: who has what

| Item                                                                          | temur-dev | waleedcodespace                             |
| ----------------------------------------------------------------------------- | --------- | ------------------------------------------- |
| Convex backend                                                                | No        | Yes (full)                                  |
| Vehicle schema (vehicles, vehicle_owners, specs, fitments, job_actuals, etc.) | No        | Yes                                         |
| Vehicle data intelligence pipeline                                            | No        | Yes (specs.ts, fitments, seed, job_actuals) |
| Booking integration (Convex)                                                  | No        | Yes                                         |
| Convex hooks / stores / utils                                                 | No        | Yes                                         |
| Newer app/settings/onboarding/booking UI                                      | No        | Yes                                         |
| docs/                                                                         | No        | Yes                                         |

So: **all “Convex/vehicle data intelligence” work in this repo is on waleedcodespace.** temur-dev does not add any new commits or Convex code.

---

## 5. Merge options and plan

### Option A: Merge temur-dev into waleedcodespace (bring Temur’s work into our branch)

- **Result:** “Already up to date.” There are no commits on temur-dev that waleedcodespace doesn’t already have.
- **Action:** None required if the goal is to get Temur’s _commits_ into waleedcodespace.

### Option B: Merge waleedcodespace into temur-dev (bring our work into Temur’s branch)

- **Result:** temur-dev would get the full Convex backend, vehicle schema, vehicle data intelligence pipeline, all hooks/docs, and all app/component changes.
- **Conflicts:** Unlikely at the Convex level (temur-dev has no convex/). Possible in `app/`, `components/`, `package.json`, or `stores/` if Temur has local uncommitted or unpushed changes elsewhere.
- **Steps:**
  1. `git checkout temur-dev`
  2. `git merge waleedcodespace`
  3. Resolve any conflicts (prefer keeping waleedcodespace for convex/, hooks, and vehicle pipeline).
  4. Run tests and Convex dev, then push `temur-dev`.

### If Temur’s “vehicle data intelligence” is somewhere else

- If his work is on another branch, in a fork, or only local: get that branch or patch set and either:
  - Merge that branch into waleedcodespace, or
  - Apply his changes on top of waleedcodespace and then merge waleedcodespace into temur-dev (Option B) so both branches stay aligned.

---

## 6. Recommended next steps

1. **Confirm with Temur** where his Convex/vehicle data intelligence work lives (this repo’s temur-dev has none of it; it’s all on waleedcodespace).
2. **If the goal is one shared branch with Convex + vehicle pipeline:**  
   Use **Option B**: merge waleedcodespace into temur-dev, resolve conflicts, then use waleedcodespace (or an updated temur-dev) as the single source of truth.
3. **If Temur has a different branch with new logic:**  
   Merge that branch into waleedcodespace first, then optionally update temur-dev from waleedcodespace.
4. **After any merge:**  
   Run `npx convex dev`, verify schema and vehicle-related queries/mutations, and re-check booking flow and onboarding.

---

## 7. Useful commands

```bash
# See commits we have that temur-dev doesn’t
git log --oneline temur-dev..waleedcodespace

# See Convex diff (all additions on waleedcodespace)
git diff --stat temur-dev waleedcodespace -- convex/

# Merge waleedcodespace into temur-dev (Option B)
git checkout temur-dev
git merge waleedcodespace
```
