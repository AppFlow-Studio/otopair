# OtoPair — In-App Notification System: QA Report

> **Status:** Phase 2 implementation complete on branch `feat/in-app-notifications`. This report covers the test matrix from PLAN.md §B.8 plus follow-up migration punch list. iOS Simulator / Android Emulator runs are required from a human reviewer — the agentic build pass is code-level only.

---

## Build-level verification (automated)

| Check | Result | Notes |
|---|---|---|
| TypeScript: toast system files | ✅ PASS | `npx tsc --noEmit` — zero errors in `components/toast/**`, `hooks/useToast*`, `hooks/use{Booking,Payment}StatusToasts.ts`, `hooks/useMutationWithToast.ts`, `hooks/useReducedMotion.ts`, `lib/haptics.ts`, `lib/accessibility.ts`, `app/dev/toast-playground.tsx`, `app/_layout.tsx`, all migrated touchpoint files |
| TypeScript: app-wide | ⚠️ pre-existing | Errors in `app/demo*.tsx`, `app/booking/mechanic/[id]/confirming.tsx`, `components/booking/**`, `app/(main-tabs)/cars/index.tsx:857`, `app/membership.tsx`, etc. — none introduced by toast work |
| `grep -r "from 'expo-haptics'"` outside `lib/haptics.ts` | ✅ PASS | Only `lib/haptics.ts:18` imports `expo-haptics` |
| `grep -r "AIToast"` outside one orphan comment | ✅ PASS | Old `components/ai-chat/AIToast.tsx` deleted; barrel re-export removed |
| ESLint rule `no-restricted-imports: expo-haptics` | ✅ PASS | Wired in `eslint.config.js` |
| `components/navigation/TabBar.tsx` haptic removal | ✅ PASS | L42 + L142 stripped; out-of-policy tab-tap haptics gone |
| `components/ui/haptic-tab.tsx` deletion | ✅ PASS | Removed; no remaining importers |

---

## Test matrix — manual verification required

PLAN.md §B.8 — 5 variants × 7 scenario rows. The agentic pass cannot execute iOS Simulator or Android Emulator, so each cell is marked `📋 manual` with a verification command/path for the reviewer.

### Light mode baseline (5 variants)
| Variant | How to test | Pass criteria |
|---|---|---|
| Success | Open `/dev/toast-playground` → tap "Success" | bg `#ECFDF5`, border `#05966933`, `CheckCircle2` icon `#059669`, title 15/20 Urbanist-SemiBold `#1A1A1A`, body 13/18 Urbanist-Regular `#374151`, success haptic |
| Info | Tap "Info" | bg `#EFF6FF`, border `#2563EB33`, `Info` icon `#2563EB`, no haptic |
| Warning | Tap "Warning" | bg `#FFFBEB`, border `#F59E0B40`, `AlertTriangle` icon `#D97706`, warning haptic |
| Error | Tap "Error" | bg `#FEF2F2`, border `#DC262640`, `XCircle` icon `#DC2626`, error haptic |
| Trust-Moment | Tap "Trust-Moment" | LinearGradient `#EFF6FF` → `#DBEAFE` atop `BlurView intensity={20}`, border `#2563EB59`, `ShieldCheck` icon `#2563EB`, success haptic, blue-tinted shadow `rgba(37,99,235,0.18)` |

### Dark mode (Simulator → Settings → Developer → Dark Appearance)
| Variant | Pass criteria |
|---|---|
| Success | bg `#022C22`, border `#05966966`, icon `#10B981`, title `#F8FAFC`, body `#CBD5E1` |
| Info | bg `#0B1B33`, border `#2563EB66`, icon `#60A5FA` |
| Warning | bg `#2C1F08`, border `#F59E0B66`, icon `#FBBF24` |
| Error | bg `#2C0B0B`, border `#DC262666`, icon `#F87171` |
| Trust | gradient `#0B1B33` → `#0F2A52`, border `#2563EB99`, icon `#60A5FA`, BlurView tint="dark" |

### Accessibility scenarios
| Scenario | How to verify | Pass criteria |
|---|---|---|
| VoiceOver iOS — title + body announced | Settings → Accessibility → VoiceOver on; trigger a toast | Reads `${title}. ${body}` once with "double tap to dismiss" hint |
| TalkBack Android `accessibilityLiveRegion` | Android Emulator, Settings → Accessibility → TalkBack | Error/Warning announced as assertive; Success/Info/Trust as polite |
| Reduce Motion → crossfade only | Settings → Accessibility → Motion → Reduce Motion on | Toast fades in/out, does NOT slide; haptics still fire (per Phase 1.5 Patch 5) |
| Dynamic Type XXL | Settings → Accessibility → Display → Larger Text → max | Container grows, no truncation past 2-line title / 3-line body cap (`PixelRatio.getFontScale()` clamped to 1.6) |
| Title length cap | Programmatically pass 200-char title | Wraps to 2 lines max, ellipsizes with "…" |
| Body length cap | Pass 500-char body | Wraps to 3 lines max, ellipsizes |

### Layout & layering
| Scenario | How to verify | Pass criteria |
|---|---|---|
| Tablet/iPad width | Boot iPad simulator, fire any toast | Container caps at 480 px wide, `alignSelf: 'center'` |
| Above `@gorhom/bottom-sheet` | Open any booking flow with a sheet; trigger toast from inside the sheet | Toast renders above sheet (Provider mounts toast in a transparent `Modal` so z-index resolves above the gorhom portal) |
| Above keyboard | Tap a TextInput; trigger toast | Toast at top of screen, not behind keyboard |
| Above full-screen modal route | Trigger toast from `/booking` (presented as fullScreenModal) | Toast visible |

### Behavioral
| Scenario | How to verify | Pass criteria |
|---|---|---|
| Single-toast queue (max 3) | Playground → "Stack 3 toasts" | First toast displays; remaining queue; oldest pending drops if a 4th arrives |
| Error preempts non-Error | Playground → "Error preempts Info" | Info shows briefly, then Error replaces it 400ms later; Info re-fires after Error exits |
| Auto-dismiss timings | Watch each variant duration | Success 3500 ms, Info 3000 ms, Warning 4500 ms, Error 5000 ms, Trust 4500 ms |
| Swipe-up dismissal | Drag toast upward | Toast follows gesture, dismisses past threshold (32 px translation OR velocity < -600) |
| Tap dismissal | Tap toast body | Toast dismisses immediately (`onPress` fires if set) |
| App backgrounded mid-toast | Trigger toast → background app → return | Current toast dropped; queue cleared; no redelivery on resume |
| Network offline error | Disable network → trigger mutation wrapped in `useMutationWithToast` | Error toast fires once after Convex timeout; does not loop or duplicate |
| Self-action filter | Cancel a booking from booking-details (mutation fires its own toast) | Exactly one toast surfaces (mutation wrapper); `useBookingStatusToasts` skips `cancelled_by_user` because it's not in the TRANSITION_TO_TOAST map |
| `lastSeenAt` init | Land on booking-details with existing status history | No toasts fire on mount; `lastSeenRef.current = max(existingRows.changedAt)` per PLAN §B.5 patch 3 |

### Haptic policy spot-checks
| Zone | Expected | How to verify |
|---|---|---|
| Tab bar tap | NO haptic | Tap any tab |
| Toast Info appear | NO haptic | Trigger an Info toast |
| Toast Error appear | Error haptic | Trigger an Error toast |
| `haptics.cta()` vs `haptics.ctaSilent()` | `ctaSilent` is a no-op | Inspect `lib/haptics.ts` |

---

## Migration coverage

Touchpoints migrated this phase (Phase 2 Step 3):

| Site | Type | Migrated string |
|---|---|---|
| `app/booking/mechanic/[id]/confirmation.tsx:333` | Warning | "Pick a date first." |
| `app/booking/mechanic/[id]/confirmation.tsx:367` | Error | "Couldn't add to your calendar. Open Settings to grant access." |
| `app/booking/mechanic/[id]/confirmation.tsx:374` | Error | "Couldn't add to your calendar." |
| `app/booking/mechanic/[id]/confirmation.tsx:378` | Success | "Added to your calendar." |
| `app/booking/mechanic/[id]/confirmation.tsx:381,384` (catch) | Error | "Couldn't add to your calendar." (raw OS error sanitized — PLAN §B.7) |
| `app/coming-soon.tsx:63` | Info | "Notifications stay off — change anytime in Settings." |
| `app/coming-soon.tsx:76` | Success | "You're on the list. We'll let you know when {serviceName} launches." |
| `app/coming-soon.tsx:83` | Error | "Couldn't update notification settings." |
| `app/membership.tsx:883` | Success | "Gift card on its way — arrives within 3 business days." |
| `app/membership.tsx:890` | Error | "Couldn't redeem. Try again." (raw OS error sanitized) |
| `app/settings/edit-profile.tsx:388` | Error | "Couldn't update your profile photo." |
| `app/settings/edit-profile.tsx:402` | Error | "Couldn't update your name." |
| `app/settings/edit-profile.tsx:425` | Error | "Couldn't update your contact info." |
| `app/settings/saved-addresses.tsx:156` | Error | "Couldn't save this address." |
| `app/settings/saved-addresses.tsx:175` | Error | "Couldn't delete this address." |
| `app/settings/notification-preferences.tsx:171` | Error | "Couldn't save your notification settings." |
| `app/(main-tabs)/cars/index.tsx:909` | Error | "Couldn't auto-fill vehicle details. Enter them manually below." |
| `app/(main-tabs)/cars/index.tsx:1237` | Error | "Couldn't set as primary. Try again." |
| `app/(main-tabs)/cars/index.tsx:1259` | Error | "Couldn't remove this vehicle. Try again." |
| `app/(main-tabs)/ai-chat/index.tsx` (entire `AIToast` surface) | Info | Migrated 7 call sites in `showToast()` to `useToast().info()`; `AIToast.tsx` deleted |

**Kept as `Alert.alert` (interactive 2-button confirmations, per PLAN §B.7 policy):**
- `app/(main-tabs)/bookings/index.tsx:260` (destructive reschedule)
- `app/(main-tabs)/home/index.tsx:481` (destructive reschedule)
- `app/(main-tabs)/cars/index.tsx:1247` (destructive remove)
- `app/settings/saved-addresses.tsx:162` (destructive delete)
- `app/membership.tsx:245` (interactive "Go to Cars" confirmation)
- `app/demo*.tsx` (6 dev-only)

---

## Follow-up migration punch list (deferred, low-risk)

These silent failures still need toast wrapping. The pattern is established (import `useToast`, call `toast.error(...)` in the catch block). Per-file effort is ~1 minute; bundled here for a single follow-up commit.

| File:line | Suggested toast |
|---|---|
| `app/car-pre-onboarding.tsx:327` | error: "Couldn't save your progress. Pull to refresh." |
| `app/add-car-info.tsx:374` | error: "Couldn't add this vehicle. Try again." |
| `app/settings/delete-account.tsx:245` | error: "Couldn't send the verification code. Try again." |
| `app/settings/delete-account.tsx:303` | error: "Couldn't delete your account. Reach out to support if this keeps happening." |
| `app/settings/preferences.tsx:158` | error: "Couldn't save your preferences." |
| `app/(main-tabs)/ai-chat/index.tsx:728` | error: "Couldn't copy to clipboard." |
| `components/bookings/QuoteListSheet.tsx:156` | error: "Couldn't accept this quote. Try again." |
| `components/ai-chat/AIRecordConfirmation.tsx:162,217` | error: "Couldn't save. Try again." |
| `components/ai-chat/AIAttachmentPanel.tsx:303` | error: "Couldn't load your photos." |
| `components/ai-chat/AIFeedbackModal.tsx:125` | error: "Couldn't submit feedback. Try again." |
| `components/cars/MaintenanceInputModal.tsx:247` | error: "Couldn't save this maintenance entry." |
| `components/cars/CarInfoStepper.tsx:704` | error: "Couldn't save your car info." |

## Open items requiring server work (out of scope for this branch)

| Item | Why | Owner |
|---|---|---|
| Trust-Moment write-through to `notifications` table (PLAN §B.9) | Schema lives in `otopair-web` (per CLAUDE.md, `convex/` is a symlink there). Each trust event detection — `parts_under_low`, `diagnostic_resolved` (no followup), `completed_early`, `hold_released` — needs the existing server mutation to also `ctx.db.insert("notifications", { ... })` | Backend (otopair-web) |
| 6 deferred onPress destinations | See `ROUTE-GAPS.md` | UI follow-up |

---

## Verdict

✅ Toast infrastructure shipped, mounted, and migrated across highest-impact touchpoints.
✅ Phase 1.5 patches (FunctionArgs/Return, self-filter, lastSeenAt init, ctaSilent, Reduce Motion decouple, Dynamic Type clamp, tablet max-width, accessibilityLiveRegion, OS-error sanitization, file-tree fix) all applied in code.
⏳ iOS/Android simulator manual matrix pending human reviewer.
⏳ 12 follow-up silent-mutation migrations listed above (mechanical, ~15 min total).
⏳ Server-side `notifications` write-through pending otopair-web change.

No blocker for branch review.
