// 1. React & React Native
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Image, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

// 2. Expo & Third-party
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
import {
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { BlurBackdrop } from "@/components/shared-ui/BlurBackdrop";
import type { FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";
// MVP-DISABLED: loyalty/rewards — re-enable post-launch (drop Trophy)
import { MoveRight, Star, Car, CalendarX } from 'lucide-react-native';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useMutationWithToast } from '@/hooks/useMutationWithToast';
import { useToast } from '@/hooks/useToast';
import { useOemServiceIntervalsBatch } from '@/hooks/useOemServiceIntervals';

// 3. Shared UI
import { Button, BrandColors, ScrollDrivenGradientBackground, Text } from "@/components/shared-ui";

// 4. Stores & Hooks
import { useAuthStore } from '@/stores/useAuthStore';
import { useBookingStore } from '@/stores/useBookingStore';
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import {
  MAINTENANCE_TYPE_TO_CATEGORY,
  extractMaintenanceType,
  findServiceForMaintenanceType,
  findServiceFromDescription,
} from '@/lib/maintenanceServiceMapping';
import { buildWarningLightItem } from "@/lib/warningLightItems";
import { canonicalWarningLights } from "@/lib/warningLightVocab";
import { usePendingNavigationStore } from "@/stores/usePendingNavigationStore";
import { useVehicleStore } from "@/stores/useVehicleStore";
import { useNotificationsSheetStore } from "@/stores/useNotificationsSheetStore";
import { useNotificationsFromConvex } from "@/hooks/useNotificationsFromConvex";
import { useShallow } from 'zustand/react/shallow';
import { useVehicleOwnershipFromConvex } from '@/hooks/useVehicleOwnershipFromConvex';
import { fetchVehicleImageUrl } from '@/utils/vehicleImage';
import { adaptConvexBookingWithDetailsToCard } from '@/utils/bookingAdapter';
import { BookingDetailsSheet, type BookingDetailsSheetRef } from '@/components/bookings/BookingDetailsSheet';
import type { Booking as BookingCardBooking } from '@/components/bookings/BookingCard';
import { AvailabilityModal } from '@/components/booking/modals/AvailabilityModal';
import { CustomerLateBanner } from '@/components/bookings/CustomerLateBanner';
import { LeaveReviewSheet, type LeaveReviewSheetRef } from '@/components/bookings/LeaveReviewSheet';
import { ReceiptSheet } from '@/components/receipts/ReceiptSheet';
import { useMyBookingsWithDetails } from '@/hooks/useMyBookingsWithDetails';
import { useUserFromConvex } from '@/hooks/useUserFromConvex';
import { useStagedLocation } from '@/hooks/useStagedLocation';
import * as SecureStore from 'expo-secure-store';

// Persists the set of booking IDs that have already triggered the
// review-prompt sheet on home, so each completed booking only auto-prompts
// once across app restarts.
const REVIEW_PROMPT_SEEN_KEY = 'otopair.reviewPromptSeenBookingIds.v1';

/** Rotating example searches shown in the Home search bar's placeholder
 *  with a typewriter effect. Same vibe as the doc-marked QUICK 3-LINE
 *  summaries: real things real users say, not feature names. Add /
 *  remove freely — the bar cycles indefinitely. */
const SEARCH_PLACEHOLDER_PHRASES = [
  'Book an oil change',
  'Mechanics near me',
  'Book an inspection',
  'Check engine light',
  'Brake service',
  'Tire rotation',
  'Find a shop nearby',
] as const;
async function loadPromptedBookingIds(): Promise<Set<string>> {
  try {
    const raw = await SecureStore.getItemAsync(REVIEW_PROMPT_SEEN_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? (arr as string[]) : []);
  } catch {
    return new Set();
  }
}
async function addPromptedBookingId(id: string, current: Set<string>): Promise<Set<string>> {
  const next = new Set(current);
  next.add(id);
  try {
    await SecureStore.setItemAsync(REVIEW_PROMPT_SEEN_KEY, JSON.stringify([...next]));
  } catch {
    // Non-fatal: prompt may re-fire next launch if writing fails.
  }
  return next;
}
import { computeMaintenanceStatus, MAINTENANCE_LABELS } from '@/utils/maintenanceStatus';
import { computeUrgency } from '@/utils/urgency';
import type { Id } from '@/convex/_generated/dataModel';

// 6. Flow-specific components
import { ActionCardsCarousel } from "@/components/home/ActionCardsCarousel";
import {
  UpcomingAppointmentHero,
  HERO_SHEET_OVERLAP,
  HERO_SURFACE,
  HERO_SURFACE_DEEP,
} from "@/components/home/UpcomingAppointmentHero";
import { HomeHeaderBar, HOME_HEADER_SUBLINE_HEIGHT } from "@/components/home/HomeHeaderBar";
import { AddVehicleRequiredSheet } from "@/components/home/AddVehicleRequiredSheet";
import { AddFirstVehicleCard } from "@/components/home/AddFirstVehicleCard";
import {
  FinishCarSetupPickerSheet,
  type FinishCarSetupPickerSheetRef,
  type IncompleteVehicleRow,
} from "@/components/home/FinishCarSetupPickerSheet";
import { LoyaltyCard } from "@/components/home/LoyaltyCard";
import { MechanicSearchBar } from "@/components/home/MechanicSearchBar";
import { ServiceBundlesSection } from "@/components/home/ServiceBundlesSection";
import { MoreServicesSection } from "@/components/home/MoreServicesSection";
import { ProviderTypesSection } from "@/components/home/ProviderTypesSection";
import { VehicleMaintenanceCard } from "@/components/home/VehicleMaintenanceCard";
import { NowTierCallout } from "@/components/home/NowTierCallout";
import { OtoPairIcon } from "@/components/icons/oto-pair";

function formatBookingDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatBookingTime(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, '0')} ${suffix}`;
}

interface HomeMaintenanceItem {
  id: string;
  serviceName: string;
  dueText: string;
  isOverdue: boolean;
  description?: string;
  suggestedServiceId?: string;
}

interface HomeNowItem {
  itemId: string;
  serviceName: string;
  description?: string;
  suggestedServiceId?: string;
  urgencyScore: number;
}

interface HomeVehicleBaseData {
  id: string;
  name: string;
  vin: string;
  maintenanceItems: HomeMaintenanceItem[];
  nowItems: HomeNowItem[];
}

// --- Home top-chrome / hero choreography tuning -----------------------------
/** Design height of the header row with its location subline showing. Only a
 *  seed value — the real height is measured via onLayout. */
const HOME_HEADER_ROW_HEIGHT = 52;
/** Seed height for the pinned search row; replaced by the measured height of
 *  the in-flow search bar + PINNED_SEARCH_ROW_PADDING. */
const PINNED_SEARCH_ROW_HEIGHT = 66;
/** `pinnedSearchInner.paddingTop` + `pinnedSearch.paddingBottom`. */
const PINNED_SEARCH_ROW_PADDING = 16;
/** Distance from the sheet's top edge to the in-flow search bar
 *  (`searchContainer.marginTop`) — used to recover the sheet's own Y from
 *  `searchBarOffsetY`. */
const SHEET_SEARCH_LEAD = 34;
/** The header's navy→light switch runs while the sheet's top edge climbs from
 *  this far below the header's bottom edge to level with it, so it completes
 *  exactly as the seam docks. Kept short deliberately: backdrop and copy have
 *  to invert together, and their midpoint is necessarily the low-contrast
 *  moment — at flick speed 40pt is a couple of frames. */
const HEADER_TONE_START_OFFSET = 40;
const HEADER_TONE_END_OFFSET = 0;
/** The copy inverts on a later, tighter window than the backdrop. Flipping both
 *  together puts mid-grey text on a mid-grey bar at the midpoint; letting the
 *  bar lighten first means the worst case is grey-on-light, which still reads. */
const COPY_TONE_START_OFFSET = 24;
const COPY_TONE_END_OFFSET = 6;
/** Fraction of the scroll speed the appointment banner moves at. 0 = pinned
 *  (reads as stuck), 1 = moves with the content (no parallax at all). */
const HERO_PARALLAX_RATE = 0.45;
/** Banner height used until onLayout reports the real one. */
const HERO_FALLBACK_HEIGHT = 160;
/** How far the banner's background extends above the banner, to cover an
 *  overscroll bounce. */
const HERO_BACKDROP_OVERSCROLL = 400;
/** The app-wide page gradient's middle stop (see ScrollDrivenGradientBackground).
 *  The booked Home's sheet starts here so it continues the same ramp the
 *  unbooked Home shows at that point on screen. */
const PAGE_GRADIENT_MID = '#B0D6F0';
/** Where both the page gradient and the sheet settle. */
const SHEET_SETTLED = '#EAF2FA';
/** Height of the sheet's blue wash. Fixed, not a gradient fraction, so it
 *  doesn't drift with page length. */
const SHEET_WASH_HEIGHT = 260;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  // Lock `insets.top` to its first-render value for the lifetime of the
  // screen. The app is portrait-only (app.json), so legitimate top-inset
  // changes don't happen — but transparent Modal mounts (the settings
  // overlay, etc.) DO cause iOS to re-emit a transient `insets.top` to
  // safe-area-context subscribers. Without this lock,
  // `paddingTop: insets.top + 12` on the ScrollView jiggles for a frame
  // when the overlay's <Modal> mounts, shifting the home content (and
  // the profile button) up and then back down on every press.
  const initialInsetTopRef = useRef<number | null>(null);
  if (initialInsetTopRef.current === null) {
    initialInsetTopRef.current = insets.top;
  }
  const stableInsetTop = initialInsetTopRef.current;
  const router = useRouter();
  const { isNewUser, shouldShowReactivationSheet, setShouldShowReactivationSheet } = useAuthStore();
  const { vehicles: listVehicles, hasVehicles, isLoading: vehiclesLoading } = useVehicleOwnershipFromConvex();
  const [showWelcome, setShowWelcome] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { location: stagedLocation, stage: locationStage } = useStagedLocation();
  const locationName =
    stagedLocation?.label ??
    (locationStage === "unavailable" ? "Location unavailable" : "Finding location...");
  const [vehicleImageUrls, setVehicleImageUrls] = useState<Record<string, string>>({});
  const fetchedVinsRef = useRef<Set<string>>(new Set());
  const saveVehicleImageUrl = useMutation(api.vehicles.saveVehicleImageUrl);
  const dismissSetupCard = useMutation(api.vehicle_owners.dismissSetupCard);
  const dismissAccountSetupCard = useMutation(api.users.dismissSetupCard);
  const [showLoyaltyCard, setShowLoyaltyCard] = useState(false);
  const [isCardSwiping, setIsCardSwiping] = useState(false);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  // Sticky search: the in-flow search bar's Y within the scroll content
  // (set via onLayout). The pinned-search overlay's opacity AND its
  // pointerEvents are both driven on the UI thread from `scrollYRef`, so
  // nothing re-renders while scrolling — that JS re-render at the cover
  // threshold was the source of the "shake".
  const scrollYRef = useSharedValue(0);
  const searchBarOffsetY = useSharedValue(400);
  // Measured height of the header row at full height (location subline
  // visible). Seeded with the design value so the first frame lays out at
  // roughly the right offset and the measurement doesn't visibly shift it.
  const [headerRowHeight, setHeaderRowHeight] = useState(HOME_HEADER_ROW_HEIGHT);
  const headerMeasuredRef = useRef(false);
  // Height of the appointment hero (measured) — drives how far the sheet has
  // to travel before the hero is fully covered.
  const heroHeightSV = useSharedValue(HERO_FALLBACK_HEIGHT);
  // Natural height of the pinned search row, measured off the in-flow search
  // bar (same component → same height) plus the row's own vertical padding.
  const searchRowHeightSV = useSharedValue(PINNED_SEARCH_ROW_HEIGHT);
  // Screen-space bottom edge of the fixed chrome once it has condensed: the
  // safe-area inset plus the header row minus its collapsed-away location
  // subline. Stays at just the inset when there's no hero, since the chrome
  // (and its header) isn't mounted then — which keeps the no-hero pinned
  // search firing at exactly the offset it always did.
  const condensedChromeHeight = useSharedValue(stableInsetTop);

  // Single source of truth for "the in-flow search has scrolled up under the
  // chrome". Drives the pinned search, its touch-eligibility, and the header's
  // location-subline collapse — all on the UI thread, no re-renders.
  const searchPinned = useDerivedValue<number>(() => {
    const threshold = searchBarOffsetY.value - condensedChromeHeight.value - 6;
    return scrollYRef.value > threshold ? 1 : 0;
  });
  const pinnedSearchStyle = useAnimatedStyle(() => {
    const show = searchPinned.value === 1;
    return {
      opacity: withTiming(show ? 1 : 0, { duration: 160 }),
      transform: [{ translateY: withTiming(show ? 0 : -8, { duration: 160 }) }],
    };
  });
  // Same fade, but inside the fixed chrome the row also has to claim (and give
  // back) its vertical space so the chrome grows from header-only to
  // header+search instead of reserving a permanent gap. Height comes from the
  // in-flow search bar's measured height — the pinned copy is the same
  // component, so it's the same size.
  const pinnedSearchRowStyle = useAnimatedStyle(() => {
    const show = searchPinned.value === 1;
    return {
      opacity: withTiming(show ? 1 : 0, { duration: 160 }),
      height: withTiming(show ? searchRowHeightSV.value : 0, { duration: 200 }),
      transform: [{ translateY: withTiming(show ? 0 : -8, { duration: 160 }) }],
    };
  });
  // Toggle the overlay's touch-eligibility on the UI thread (no state / no
  // re-render) so the hidden copy never eats taps meant for the header/hero.
  const pinnedSearchProps = useAnimatedProps(() => {
    return { pointerEvents: searchPinned.value === 1 ? ("auto" as const) : ("none" as const) };
  });
  // What's behind the fixed header: 0 = the navy banner, 1 = the light content
  // sheet. Drives the header's copy/bell cross-fade, its frosted backdrop, and
  // the status-bar style — all off one value so they can never disagree.
  // Screen-space Y of the content sheet's top edge — the seam that both tone
  // values key off. Derived once rather than recomputed inside each.
  const sheetTopOnScreen = useDerivedValue<number>(
    () => searchBarOffsetY.value - SHEET_SEARCH_LEAD - scrollYRef.value,
  );
  const headerTone = useDerivedValue<number>(() => {
    return interpolate(
      sheetTopOnScreen.value,
      [
        condensedChromeHeight.value + HEADER_TONE_START_OFFSET,
        condensedChromeHeight.value + HEADER_TONE_END_OFFSET,
      ],
      [0, 1],
      Extrapolation.CLAMP,
    );
  });
  // Frosted backdrop behind the fixed chrome. Absent while the header sits on
  // the navy banner (it's already an opaque surface); fades in with the tone
  // switch, so the light blur only ever appears over the light sheet.
  const chromeNavyStyle = useAnimatedStyle(() => ({
    opacity: 1 - headerTone.value,
  }));
  // The bar is fixed to the screen while the sheet scrolls beneath it, so no
  // single colour can match: at the moment the seam docks the sheet's top is
  // PAGE_GRADIENT_MID, and SHEET_WASH_HEIGHT later it's SHEET_SETTLED. Sample
  // the same ramp at the bar's own depth into the sheet so it always matches
  // whatever it's sitting on, instead of splitting the difference and being
  // visibly wrong at both ends.
  const chromeLightStyle = useAnimatedStyle(() => {
    const depth = condensedChromeHeight.value - sheetTopOnScreen.value;
    const p = Math.min(1, Math.max(0, depth / SHEET_WASH_HEIGHT));
    return {
      backgroundColor: interpolateColor(p, [0, 1], [PAGE_GRADIENT_MID, SHEET_SETTLED]),
    };
  });
  // Same crossing, later window — see COPY_TONE_START_OFFSET.
  const copyTone = useDerivedValue<number>(() => {
    return interpolate(
      sheetTopOnScreen.value,
      [
        condensedChromeHeight.value + COPY_TONE_START_OFFSET,
        condensedChromeHeight.value + COPY_TONE_END_OFFSET,
      ],
      [0, 1],
      Extrapolation.CLAMP,
    );
  });
  // The status bar has to follow the same surface the header does — light icons
  // over the navy banner, dark once the light sheet is behind it. This is the
  // one thing that can't be driven on the UI thread, so it's a single state
  // flip at the midpoint of the cross-fade rather than a per-frame value.
  const [statusBarLight, setStatusBarLight] = useState(true);
  useAnimatedReaction(
    // Follows the copy, not the backdrop — the status-bar icons sit on the same
    // bar the header copy does, so they should invert with it.
    () => copyTone.value < 0.5,
    (isOverBanner, prev) => {
      if (prev !== null && isOverBanner !== prev) {
        runOnJS(setStatusBarLight)(isOverBanner);
      }
    },
    [],
  );
  // Hero parallax: the banner drifts up at a fraction of the scroll speed while
  // the content sheet rises at full speed, so the sheet closes on it and the
  // page reads as two layers rather than one flat surface. Clamped at 0 so an
  // overscroll bounce moves banner and sheet together — that's what used to
  // open a gap at the seam and forced `bounces={false}`.
  const heroParallaxStyle = useAnimatedStyle(() => {
    const y = Math.max(0, scrollYRef.value);
    return { transform: [{ translateY: y * (1 - HERO_PARALLAX_RATE) }] };
  });
  // As the sheet closes over it, the banner dims and shrinks a hair so it reads
  // as receding behind the sheet instead of just being clipped by it. Applied
  // to the hero's content only — never its background layer, which has to stay
  // full-bleed to cover the page gradient.
  const heroRecedeStyle = useAnimatedStyle(() => {
    const closed = Math.max(0, scrollYRef.value) * (1 - HERO_PARALLAX_RATE);
    const travel = Math.max(1, heroHeightSV.value - HERO_SHEET_OVERLAP);
    const p = Math.min(1, closed / travel);
    return {
      opacity: 1 - p * 0.45,
      transform: [{ scale: 1 - p * 0.04 }],
    };
  });
  const [carSetupDismissed, setCarSetupDismissed] = useState(false);
  const [rescheduleBooking, setRescheduleBooking] = useState<BookingCardBooking | null>(null);
  const toast = useToast();
  const selectVehicle = useVehicleStore((s) => s.selectVehicle);
  const updateOnboardingData = useOnboardingStore((s) => s.updateData);

  // Reactivation bottom sheet (from temur-dev)
  const sheetRef = useRef<BottomSheetModal>(null);
  const hasPresentedReactivationRef = useRef(false);
  const snapPoints = useMemo(() => ["42%"], []);
  const noVehicleSheetRef = useRef<FloatingSheetRef>(null);

  useEffect(() => {
    if (shouldShowReactivationSheet && showWelcome) {
      setShowWelcome(false);
    }
  }, [shouldShowReactivationSheet, showWelcome]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        BackHandler.exitApp();
        return true;
      });
      return () => subscription.remove();
    }, []),
  );

  useEffect(() => {
    if (!shouldShowReactivationSheet || showWelcome || hasPresentedReactivationRef.current) return;
    hasPresentedReactivationRef.current = true;
    requestAnimationFrame(() => {
      sheetRef.current?.present();
      setShouldShowReactivationSheet(false);
    });
  }, [shouldShowReactivationSheet, showWelcome, setShouldShowReactivationSheet]);

  // ── Data for action cards ──
  const me = useQuery(api.users.getMe);
  const allBookings = useQuery(
    api.bookings.getByUserIdWithDetails,
    me?._id ? { userId: me._id } : "skip"
  );

  useEffect(() => {
    if (!me) return;
    updateOnboardingData({
      firstName: me.first_name ?? null,
      lastName: me.last_name ?? null,
      email: me.email ?? null,
    });
  }, [me, updateOnboardingData]);

  // Hold a splash screen until the critical Convex queries — current
  // user + vehicle ownership — have settled. Without this, the home
  // page paints "no account / no car" defaults for a frame or two
  // while individual queries arrive at different times, then snaps
  // to the real state. We also enforce a small minimum hold (350ms)
  // so the splash itself doesn't flash on fast cache-warm reloads.
  const isCriticalDataLoading = me === undefined || vehiclesLoading;
  const [splashHidden, setSplashHidden] = useState(false);
  const splashStartedAtRef = useRef(Date.now());
  useEffect(() => {
    if (isCriticalDataLoading) return;
    const elapsed = Date.now() - splashStartedAtRef.current;
    const wait = Math.max(0, 350 - elapsed);
    const t = setTimeout(() => setSplashHidden(true), wait);
    return () => clearTimeout(t);
  }, [isCriticalDataLoading]);
  const { selectedServiceIds, availableServices } = useBookingStore(
    useShallow((s) => ({ selectedServiceIds: s.selectedServiceIds, availableServices: s.availableServices }))
  );

  /*
   * The hero headlines a job that has actually STARTED — status in_progress —
   * and nothing else.
   *
   * vehicle_at_shop is deliberately excluded. It only means the car was
   * dropped off, and nothing moves a booking off that status if work never
   * begins, so those rows pile up and sit there indefinitely (one on this
   * account stayed "at the shop" from June with live_stage null). The hero is
   * a "what is happening to my car right now" surface; a car parked in a lot
   * is not that. Future bookings live in the Bookings tab.
   *
   * `upcomingBooking` keeps its name — it is read in ~12 places downstream —
   * but now means "the job in progress".
   *
   * Qualifying on status alone also retires the local-vs-UTC date compare this
   * once needed: scheduled_date is a local "YYYY-MM-DD", and comparing it to a
   * UTC-derived key was off by one in evenings west of UTC, which is what made
   * the card randomly disappear at certain hours.
   */
  const upcomingBooking = useMemo(() => {
    if (!allBookings) return null;
    return allBookings
      .filter((b: any) => b.status === 'in_progress')
      // Soonest first when a customer somehow has two jobs running at once.
      .sort(
        (a: any, b: any) =>
          (a.scheduled_date || '').localeCompare(b.scheduled_date || '') ||
          (a.scheduled_time || '').localeCompare(b.scheduled_time || ''),
      )[0] ?? null;
  }, [allBookings]);

  // Resume booking: user has services selected in an incomplete flow
  const hasResumeBooking = selectedServiceIds.length > 0;
  const resumeServicesPreview = useMemo(() => {
    if (!hasResumeBooking) return '';
    const names = availableServices
      .filter((s: any) => selectedServiceIds.includes(s.id))
      .map((s: any) => s.name);
    const joined = names.join(', ');
    return joined.length > 25 ? joined.slice(0, 22) + '...' : joined;
  }, [selectedServiceIds, availableServices]);

  // Resume booking vehicle context — LOCKED to the vehicle the booking was
  // started for (snapshotted into useBookingStore.selectedVehicleVin when the
  // cart went from empty → first service). Reading the global active vehicle
  // here would let a later selectVehicle() call (e.g. tapping a different
  // car's maintenance card) mis-swap the resume card to the wrong vehicle.
  const resumeVehicleVin = useBookingStore((s) => s.selectedVehicleVin);
  const resumeVehicle = useVehicleStore((s) =>
    resumeVehicleVin ? s.vehicles[resumeVehicleVin] : undefined,
  );
  const resumeVehicleName = resumeVehicle ? `${resumeVehicle.make} ${resumeVehicle.model}` : undefined;
  const resumeVehicleImage = resumeVehicle?.imageSource;

  // Account setup: hide when all checkable steps are done. Mirrors the
  // per-step logic inside FinishAccountSetupCard:
  //   - Create Account: signed-in user with name (covers OAuth signups
  //     that skip the full onboarding flow)
  //   - About You: tellUsAboutCompleted flag
  //   - Add Car: at least one registered vehicle
  //   - Payment Method: has_saved_payment_method flag
  //
  // Override: if the user tapped "Finish later" mid-onboarding
  // (`onboardingDeferred`) AND full onboarding isn't actually
  // complete, keep the card visible so they have a path back to the
  // steps they skipped — otherwise a partial signup with a car looks
  // "done" here even though profile photo / intent / zip are missing.
  const hasCreateAccount = !!(me?.first_name && me?.last_name) || me?.onboardingCompleted === true;
  const hasAboutYou = me?.tellUsAboutCompleted === true;
  const hasPaymentMethod = me?.has_saved_payment_method === true;
  const isAccountSetupComplete = hasCreateAccount && hasAboutYou && hasVehicles && hasPaymentMethod;
  const onboardingDeferred = (me as { onboardingDeferred?: boolean } | null | undefined)?.onboardingDeferred === true;
  const onboardingFullyComplete = me?.onboardingCompleted === true;
  const shouldForceShowForDeferred = onboardingDeferred && !onboardingFullyComplete;
  // The card now stays up until the user acknowledges it with the ×, which
  // is the only thing that sets `setupCardDismissed`. Vanishing the instant
  // the fourth step lands would rob the user of the payoff for finishing
  // the checklist — and gives them nothing to dismiss.
  const showAccountSetup = me?.setupCardDismissed !== true;
  // The × is only offered once all four steps are done. `shouldForceShow`
  // still applies here: a user who tapped "Finish later" mid-onboarding can
  // look complete by the four-tile test while profile photo / intent / zip
  // are still missing, and dismissing would bury their only path back.
  const canDismissAccountSetup =
    isAccountSetupComplete && !shouldForceShowForDeferred;

  // Car setup: prefer incomplete vehicles, then completed-but-not-acknowledged.
  // `incompleteVehicles` is the full list of not-yet-onboarded cars so we can
  // show a picker when there are multiple; `carSetupVehicle` remains the
  // single representative used for the card's checklist state.
  const incompleteVehicles = useMemo(
    () => (listVehicles ?? []).filter((r: any) => r.ownership && r.ownership.onboardingComplete !== true),
    [listVehicles],
  );
  const carSetupVehicle = incompleteVehicles[0] ?? (listVehicles ?? []).find(
    (r: any) => r.ownership && r.ownership.onboardingComplete === true && !r.ownership.setupCardDismissed
  );
  const isCarSetupDone = !!carSetupVehicle?.ownership?.onboardingComplete;
  const showCarSetup = !!carSetupVehicle && !carSetupDismissed;

  // Rows for the picker sheet, adapted from the Convex shape.
  const pickerVehicles = useMemo<IncompleteVehicleRow[]>(
    () =>
      incompleteVehicles.map((r: any) => ({
        ownershipId: String(r.ownership?._id ?? r.vin),
        vin: r.vin,
        year: r.vehicle?.year ?? 0,
        make: (r.vehicle?.metadata?.make as string | undefined) ?? "Vehicle",
        model: (r.vehicle?.metadata?.model as string | undefined) ?? "",
        imageUrl: (r.vehicle?.image_url as string | null | undefined) ?? null,
        preOnboardingComplete: !!r.ownership?.preOnboardingComplete,
      })),
    [incompleteVehicles],
  );
  const pickerSheetRef = useRef<FinishCarSetupPickerSheetRef>(null);

  // Checklist state for FinishCarSetupCard
  const carSetupChecklist = useMemo(() => {
    const o = carSetupVehicle?.ownership;
    return [
      { id: 'vin', label: 'Add your Car with your VIN number', completed: !!o },
      { id: 'mileage', label: 'Answer Questions about your Service History', completed: !!o?.onboardingComplete },
    ];
  }, [carSetupVehicle]);

  // Display label for the Finish Setup card so the user knows which
  // car they're about to resume — falls back to a nickname or the
  // last 6 of the VIN when make/model are missing.
  const carSetupVehicleLabel = useMemo(() => {
    if (!carSetupVehicle) return undefined;
    const v = carSetupVehicle.vehicle as
      | { year?: number; metadata?: { make?: string; model?: string } }
      | undefined;
    const meta = v?.metadata;
    const yearPart = v?.year ? String(v.year) : "";
    const makeModel = [meta?.make, meta?.model].filter(Boolean).join(" ").trim();
    const fromMeta = [yearPart, makeModel].filter(Boolean).join(" ").trim();
    if (fromMeta) return fromMeta;
    const nickname = carSetupVehicle.ownership?.nickname;
    if (nickname) return nickname;
    const vin = carSetupVehicle.vin;
    return vin ? `VIN ${vin.slice(-6)}` : undefined;
  }, [carSetupVehicle]);

  useEffect(() => {
    if (!listVehicles?.length) return;
    listVehicles.forEach((r: any) => {
      if (!r.vin || fetchedVinsRef.current.has(r.vin)) return;
      fetchedVinsRef.current.add(r.vin);

      // Reuse cached image_url ONLY if it's from the new transparent-bg
      // endpoint. Old cached URLs (legacy white-bg `vehicle-media/v2`)
      // are skipped here so the cars screen — the single owner of the
      // VDB fetch — can re-fetch and upgrade them.
      const cachedUrl = r.vehicle?.image_url;
      if (typeof cachedUrl === "string" && cachedUrl.includes("/transparent/")) {
        setVehicleImageUrls((prev) => ({ ...prev, [r.vin]: cachedUrl }));
      }
    });
  }, [listVehicles]);

  // ── Maintenance records for ALL vehicles ──
  const allOwnershipIds = useMemo(
    () => (listVehicles ?? []).map((r: any) => r.ownership?._id).filter(Boolean) as Id<"vehicle_owners">[],
    [listVehicles]
  );
  const allMaintenanceRecords = useQuery(
    api.maintenance.getRecordsByMultipleVehicles,
    allOwnershipIds.length > 0 ? { vehicleOwnerIds: allOwnershipIds } : "skip"
  );

  // ── OEM service intervals for ALL vehicles (per-config map) ──
  // Batched into one round-trip so the per-vehicle loop below can look
  // up its config's intervals without N queries. Configs that haven't
  // been enriched yet just won't have a key — the maintenance calc
  // falls back to MAKE_OVERRIDES / DEFAULT_INTERVALS for those.
  const allVehicleConfigIds = useMemo(
    () =>
      (listVehicles ?? [])
        .map((r: any) => r.vehicle?.vehicle_config_id)
        .filter(Boolean) as Id<"vehicle_configs">[],
    [listVehicles],
  );
  const allOemIntervals = useOemServiceIntervalsBatch(allVehicleConfigIds);

  // ── Vehicle data with maintenance (no image dep — avoids cascading recomputation) ──
  const vehicleBaseData = useMemo<HomeVehicleBaseData[]>(() => {
    if (!listVehicles?.length) return [];
    const seen = new Set<string>();
    return listVehicles
      .filter((r: any) => {
        if (seen.has(r.vin)) return false;
        seen.add(r.vin);
        return true;
      })
      .map((r: any) => {
        const v = r.vehicle;
        const o = r.ownership;
        const meta = v?.metadata as { make?: string; model?: string } | undefined;
        const titleCase = (s: string) => s.toLowerCase().split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const make = meta?.make ? titleCase(meta.make) : "";
        const model = meta?.model ? titleCase(meta.model) : "";
        const rawName = make && model ? `${make}\n${model}` : o?.nickname ?? "My Vehicle";
        const displayName = rawName.split('\n').map((part: string) => titleCase(part)).join('\n');

        const ownershipId = o?._id as string | undefined;
        const records = ownershipId && allMaintenanceRecords ? (allMaintenanceRecords[ownershipId] ?? []) : [];
        const isOnboardingComplete = o?.onboardingComplete === true;
        const odometer: number | null = isOnboardingComplete ? (o?.mileage ?? null) : null;
        const knownIssues = o?.knownIssues as string[] | undefined;
        // Canonical dashboard lights (folds both knownIssues shapes + the
        // symptom-code vocabulary) so the Now-tier paired-light check below fires
        // for a light logged via Oto/check-in in any vocabulary — matching the
        // Cars page instead of leaving Home silent.
        const canonicalLights = canonicalWarningLights(knownIssues) as readonly string[];
        // Per-vehicle OEM intervals from the batch query above. Empty
        // map when the v3 pipeline hasn't enriched this config yet —
        // computeMaintenanceStatus → getInterval falls back through
        // MAKE_OVERRIDES → DEFAULT_INTERVALS for that case.
        const configId = v?.vehicle_config_id as string | undefined;
        const oemIntervalsForVehicle = configId
          ? (allOemIntervals[configId] ?? undefined)
          : undefined;

        const urgentItems: HomeMaintenanceItem[] = [];
        // Now-tier items per Yassin v1.1 §3.2 — aggregated into
        // allNowItems below to drive the Home callout. Always populated
        // (no cap), unlike urgentItems which is capped at 3 for the
        // existing VehicleMaintenanceCard.
        const nowItems: HomeNowItem[] = [];
        for (const rec of records) {
          const result = computeMaintenanceStatus(
            {
              type: rec.type,
              lastServiceDate: rec.lastServiceDate ?? undefined,
              lastServiceMileage: rec.lastServiceMileage ?? undefined,
              customInputs: rec.customInputs as Record<string, unknown> | undefined,
              confirmedHealthyAt: rec.confirmedHealthyAt ?? undefined,
            },
            odometer,
            make,
            undefined,
            o?.drivingConditions as string | undefined,
            o?.avgMonthlyDriving as string | undefined,
            knownIssues,
            v?.year as number | undefined,
            oemIntervalsForVehicle,
          );
          const itemId = `${rec.type}-${ownershipId}`;

          // Action Engine tier compute (always runs, never capped).
          const urgency = computeUrgency({
            id: itemId,
            status: result.status,
            percentUsed: result.percentUsed,
          });
          if (urgency.tier === "now") {
            const matched = findServiceFromDescription(result.description, availableServices);
            const genericLabel = MAINTENANCE_LABELS[rec.type as keyof typeof MAINTENANCE_LABELS] || rec.type;
            nowItems.push({
              itemId,
              serviceName: matched?.name ?? genericLabel,
              description: result.description,
              suggestedServiceId: matched?.id,
              urgencyScore: urgency.score,
            });
          }

          // Legacy urgentItems collection (capped at 3 for VehicleMaintenanceCard).
          if (
            urgentItems.length < 3 &&
            (result.status === "overdue" || result.status === "due_soon" || result.status === "needs_attention")
          ) {
            // If the status description literally names a service in the
            // booking catalog (e.g. "replacement recommended" → Tire
            // Replacement), prefer that as the label + preselect id.
            // Matcher is cross-category; the booking flow uses the matched
            // service's own category to pick the right tab.
            const matched = findServiceFromDescription(result.description, availableServices);
            const genericLabel = MAINTENANCE_LABELS[rec.type as keyof typeof MAINTENANCE_LABELS] || rec.type;
            urgentItems.push({
              id: itemId,
              serviceName: matched?.name ?? genericLabel,
              dueText: result.status === "overdue" ? "Overdue" : result.status === "due_soon" ? "Due soon" : "Needs attention",
              isOverdue: result.status === "overdue",
              description: result.description,
              suggestedServiceId: matched?.id,
            });
          }
        }

        // ── Warning lights → nowItems (Yassin urgency model) ───────────
        // Home's loop above only iterates maintenance_records, so any
        // active dashboard warning light that doesn't have a paired
        // record (e.g. user reports oil_pressure but hasn't logged any
        // oil change yet, OR user reports check_engine which has no
        // paired type at all) was silently dropped here — that's the
        // bug Ahmad caught.
        //
        // Two passes mirror useMergedMaintenance for the Cars page:
        //  1. Paired-light fallback: for each paired light active in
        //     knownIssues with no corresponding record, push a
        //     synthesized now-tier item so Home shows it.
        //  2. Consolidated unpaired-light card via buildWarningLightItem.
        if (ownershipId && knownIssues && knownIssues.length > 0) {
          const trackedTypes = new Set(records.map((r: any) => r.type as string));
          const PAIRED_LIGHT_BY_TYPE_HOME: Record<
            string,
            { lightId: string; label: string }
          > = {
            oil: {
              lightId: "oil_pressure",
              label: "Oil pressure warning light active — service urgently needed",
            },
            battery: {
              lightId: "battery_charging",
              label: "Battery / charging warning light active — have it tested",
            },
            brakes: {
              lightId: "abs",
              label: "ABS / brake warning light active — have brakes inspected",
            },
            tires: {
              lightId: "tpms",
              label: "Tire pressure (TPMS) warning light active — check tires",
            },
          };
          for (const [type, info] of Object.entries(PAIRED_LIGHT_BY_TYPE_HOME)) {
            if (!canonicalLights.includes(info.lightId)) continue;
            if (trackedTypes.has(type)) continue; // record loop already handled it
            const itemId = `${type}-${ownershipId}`;
            const matched = findServiceFromDescription(info.label, availableServices);
            const genericLabel =
              MAINTENANCE_LABELS[type as keyof typeof MAINTENANCE_LABELS] ?? type;
            nowItems.push({
              itemId,
              serviceName: matched?.name ?? genericLabel,
              description: info.label,
              suggestedServiceId: matched?.id,
              urgencyScore: 100,
            });
            // Also push to urgentItems so the Home VehicleMaintenanceCard
            // surfaces the same warning. Without this, a car whose only
            // urgent item is a paired-light fallback (no maintenance
            // records logged yet) shows "All systems healthy" on the
            // card while the NowTierCallout above screams about the
            // light — exactly the inconsistency Ahmad caught.
            if (urgentItems.length < 3) {
              urgentItems.push({
                id: itemId,
                serviceName: matched?.name ?? genericLabel,
                dueText: "Overdue",
                isOverdue: true,
                description: info.label,
                suggestedServiceId: matched?.id,
              });
            }
          }

          const warningItem = buildWarningLightItem({
            knownIssues,
            scopeId: String(ownershipId),
          });
          if (warningItem) {
            // Pre-seed the diagnostic scan service so the booking flow
            // opens with it ticked. Slug match is intentional — the
            // catalog seed alternates `diagnostic_scan` (underscored)
            // vs `diagnostic-scan` (hyphenated) across environments.
            const diagnostic = availableServices.find((s) => {
              const slug = (s.slug ?? "").toLowerCase().replace(/-/g, "_");
              return slug === "diagnostic_scan";
            });
            nowItems.push({
              itemId: warningItem.id,
              serviceName: warningItem.serviceName,
              description: warningItem.description,
              suggestedServiceId: diagnostic?.id,
              urgencyScore: 100,
            });
            // Mirror into urgentItems so VehicleMaintenanceCard shows
            // the consolidated warning card too. Cap of 3 preserved —
            // first-come-first-served is fine; the NowTierCallout shows
            // everything.
            if (urgentItems.length < 3) {
              urgentItems.push({
                id: warningItem.id,
                serviceName: warningItem.serviceName,
                dueText: "Overdue",
                isOverdue: true,
                description: warningItem.description,
                suggestedServiceId: diagnostic?.id,
              });
            }
          }
        }

        const items = urgentItems.length > 0
          ? urgentItems
          : [{ id: "healthy", serviceName: "All systems healthy", dueText: "No action needed", isOverdue: false }];
        return { id: r.vin, name: displayName, vin: r.vin, maintenanceItems: items, nowItems };
      });
  }, [listVehicles, allMaintenanceRecords, availableServices, allOemIntervals]);

  // Merge image URLs separately — cheap, only re-maps when images arrive
  const mappedVehicles = useMemo(
    () => vehicleBaseData.map((v) => ({ ...v, imageUrl: vehicleImageUrls[v.vin] ?? "" })),
    [vehicleBaseData, vehicleImageUrls]
  );

  // Aggregate Now-tier items across all vehicles for the Home callout
  // (Yassin v1.1 §3.2 "Assertive card at top of Home"). Grouped by
  // vehicle so a car with N due-now items renders as ONE pager card
  // with N checkable rows (locked decision) instead of N cards. Items
  // inside each group sort by urgency-desc; groups sort by their top
  // item's urgency so the most urgent vehicle leads.
  /*
   * VINs with a job actually under way. A "Book Service" prompt for a car
   * that is mid-service is worse than useless — the work is already
   * happening, and the hero directly above says so. Suppressing the whole
   * vehicle rather than just the service being worked on is deliberate: while
   * the car is being worked on, anything else it needs is a conversation with
   * the mechanic, not a second booking.
   *
   * Matches the hero on in_progress only. vehicle_at_shop was included at
   * first, but that status never self-clears — a drop-off that was never
   * started would have hidden that vehicle's Now items forever, silently.
   */
  /*
   * VINs whose health score is mid-recompute. applyBookingStatusTransition
   * schedules the inspection-health write two hours after a job closes and
   * stamps health_score_pending_until for that window (see
   * inspectionHealthDeferred). Until it lands, knownIssues still holds the
   * pre-service warning lights — so the Now callout would otherwise sit there
   * urging the customer to book work the shop has just finished.
   */
  const healthPendingVins = useMemo(() => {
    const vins = new Set<string>();
    const now = Date.now();
    (listVehicles ?? []).forEach((r: any) => {
      const until = r?.ownership?.health_score_pending_until;
      if (typeof until === "number" && until > now) {
        vins.add(String(r.vin).toUpperCase());
      }
    });
    return vins;
  }, [listVehicles]);

  const inServiceVins = useMemo(() => {
    const vins = new Set<string>();
    (allBookings ?? []).forEach((b: any) => {
      if (b.status === 'in_progress') {
        const vin = String(b.vin ?? '').toUpperCase();
        if (vin) vins.add(vin);
      }
    });
    return vins;
  }, [allBookings]);

  const allNowGroups = useMemo(() => {
    type BaseVehicle = (typeof vehicleBaseData)[number];
    type BaseNowItem = BaseVehicle["nowItems"][number];
    return vehicleBaseData
      .filter(
        (v: BaseVehicle) =>
          v.nowItems.length > 0 && !inServiceVins.has(String(v.vin).toUpperCase()),
      )
      .map((v: BaseVehicle) => {
        const vehicleName = v.name.replace(/\n/g, " ");
        const vehicleImageUrl = vehicleImageUrls[v.vin] || undefined;
        const items = v.nowItems
          .map((n: BaseNowItem) => ({
            ...n,
            vehicleVin: v.vin,
            vehicleName,
            vehicleImageUrl,
          }))
          .sort(
            (a: { urgencyScore: number }, b: { urgencyScore: number }) =>
              b.urgencyScore - a.urgencyScore,
          );
        return {
          vehicleVin: v.vin,
          vehicleName,
          vehicleImageUrl,
          items,
          topUrgency: items[0]?.urgencyScore ?? 0,
          healthPending: healthPendingVins.has(String(v.vin).toUpperCase()),
        };
      })
      .sort(
        (a: { topUrgency: number }, b: { topUrgency: number }) =>
          b.topUrgency - a.topUrgency,
      );
  }, [vehicleBaseData, vehicleImageUrls, inServiceVins, healthPendingVins]);

  const handleSearch = (query: string) => {
    console.log("Search submitted:", query);
    // TODO: Implement search functionality
  };

  const openBookingFlow = useCallback((): boolean => {
    if (vehiclesLoading) return false;
    if (!hasVehicles) {
      noVehicleSheetRef.current?.open();
      return false;
    }
    return true;
  }, [hasVehicles, vehiclesLoading]);

  // Both the search field and the map button route to the booking
  // flow's service picker, but the map button passes `entry=map` so
  // the picker mounts in peek mode: low sheet, interactive map
  // underneath. Search-entry behavior is unchanged (full sheet).
  // Object form for router.push so Expo Router serializes the param
  // into the route consistently across SDK versions.
  const handleMapPress = () => {
    if (!openBookingFlow()) return;
    router.push({
      pathname: "/(booking-flow)/select-services",
      params: { entry: "map" },
    });
  };

  const handleSearchPress = () => {
    if (!openBookingFlow()) return;
    router.push("/(booking-flow)/select-services");
  };

  // Notifications bell — opens the global NotificationsSheet and
  // surfaces an unread dot when the customer has pending outbox rows
  // (e.g., a shop has just proposed a reschedule).
  const openNotificationsSheet = useNotificationsSheetStore((s) => s.open);
  const { unreadCount: notificationsUnreadCount } = useNotificationsFromConvex();
  const hasUnreadNotifications = notificationsUnreadCount > 0;

  // userId still consumed by the review-sheet flow below; keep it.
  const { userId } = useUserFromConvex();
  // MVP-DISABLED: loyalty/rewards — re-enable post-launch
  // Trophy dot — true when the user has earned any credit since the
  // last time they opened the loyalty surface. Cleared by the
  // `markCreditsSeen` mutation when the loyalty popover opens.
  // const hasUnseenCredits = useQuery(
  //   api.rewards.hasUnseenCredits,
  //   userId ? { userId } : "skip",
  // );
  // const markCreditsSeen = useMutation(api.rewards.markCreditsSeen);

  // When returning from map modal with "Add vehicle" tapped: navigate to cars tab
  const pendingNavigateToCars = usePendingNavigationStore((s) => s.pendingNavigateToCars);
  const setPendingNavigateToCars = usePendingNavigationStore((s) => s.setPendingNavigateToCars);
  useFocusEffect(
    useCallback(() => {
      if (pendingNavigateToCars) {
        setPendingNavigateToCars(false);
        router.navigate("/(main-tabs)/cars");
      }
    }, [pendingNavigateToCars, setPendingNavigateToCars, router])
  );

  // Clear any pre-pinned shop from a previous shop-detail Book CTA the
  // moment the user lands back on Home. Without this, `preSelectedShopId`
  // (set on shop-detail at `app/booking/shop/[id]/index.tsx:226`) lives
  // forever in the booking store, so a brand-new booking started from
  // Home would silently inherit the previous shop — exactly the bug
  // Ahmad caught. The `Resume Booking` flow on Home uses a different
  // store field (`selectedVehicleVin` + `selectedServiceIds`) and is
  // unaffected; we're only resetting the shop / service pre-pins set by
  // shop-detail, not the in-progress cart.
  const clearPreSelections = useBookingStore((s) => s.clearPreSelections);
  useFocusEffect(
    useCallback(() => {
      clearPreSelections();
    }, [clearPreSelections]),
  );

  // The deferred "Connecting to your <car>" one-shot toast that used to
  // fire here (stashed by add-vehicle-review) is gone — the persistent
  // EnrichmentStatusPill mounted in the (main-tabs) layout now shows the
  // same message for as long as any garage vehicle is enriching.

  const handleAppointmentPress = () => {
    console.log("Appointment pressed");
    // TODO: Navigate to appointment details
  };

  // Adapt the upcoming booking row to the BookingCard shape so the home
  // screen can render the same card the bookings tab uses.
  const upcomingBookingCard = useMemo(
    () => (upcomingBooking ? adaptConvexBookingWithDetailsToCard(upcomingBooking) : null),
    [upcomingBooking],
  );
  // Whether the full-bleed appointment hero is showing — drives the
  // "content sheet covers the hero" treatment below.
  const hasHero = !!upcomingBooking && !!upcomingBookingCard;

  // Pull the shop record for the upcoming booking so we can fall back
  // to a postal address when the shop hasn't been geocoded (shopLat /
  // shopLng missing or 0). Without this, the Navigate button would
  // happily route the user to 0,0 in the middle of the ocean.
  const upcomingShop = useQuery(
    api.shops.getById,
    upcomingBooking?.shop_id
      ? { id: upcomingBooking.shop_id as Id<"shops"> }
      : "skip",
  );
  const upcomingShopAddress = useMemo(() => {
    if (!upcomingShop) return undefined;
    const parts = [
      upcomingShop.address,
      upcomingShop.city,
      upcomingShop.state,
      upcomingShop.zip,
    ]
      .map((p) => (typeof p === "string" ? p.trim() : ""))
      .filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : undefined;
  }, [upcomingShop]);

  // Cancel handler — mirror the bookings tab's behavior. Convex bookings
  // get the cancelBooking mutation; tire-quote-prefixed local IDs are
  // out of scope here (those don't surface as upcoming on home).
  const cancelConvexBooking = useMutationWithToast(api.bookings.cancelBooking, {
    success: "Booking cancelled.",
    successIcon: CalendarX,
    error: "Couldn't cancel this booking. Try again.",
  });
  const handleAppointmentCancel = useCallback(
    (bookingId: string, feeAcknowledgedCents?: number) => {
      const isLocalId = bookingId.startsWith("tire_quote_") || bookingId.startsWith("booking_");
      if (!isLocalId) {
        // Forward the late-cancel fee BookingCard disclosed so the server's
        // stale-fee guard can reject if the fee rose past what was shown.
        void cancelConvexBooking({
          bookingId: bookingId as Id<"bookings">,
          feeAcknowledgedCents,
        });
      }
    },
    [cancelConvexBooking],
  );

  const handleReschedule = useCallback(
    (bookingId: string) => {
      const isLocalId = bookingId.startsWith("tire_quote_") || bookingId.startsWith("booking_");
      if (!upcomingBookingCard || upcomingBookingCard.id !== bookingId || isLocalId || !upcomingBookingCard.shopId) {
        toast.warning("This booking can't be rescheduled from here.");
        return;
      }
      if (upcomingBookingCard.vin) {
        selectVehicle(upcomingBookingCard.vin.toUpperCase());
      }
      setRescheduleBooking(upcomingBookingCard);
    },
    [selectVehicle, toast, upcomingBookingCard],
  );

  const handleCloseRescheduleModal = useCallback(() => {
    setRescheduleBooking(null);
  }, []);

  const handleConfirmRescheduleSlot = useCallback(
    (_date: Date, _time: string, mechanicId: string | null) => {
      if (!rescheduleBooking) return;
      const routeId = mechanicId ?? rescheduleBooking.mechanicId ?? rescheduleBooking.shopId;
      if (!routeId) {
        toast.warning("Choose a mechanic before rescheduling.");
        return;
      }
      router.push({
        pathname: "/booking/mechanic/[id]/confirming",
        params: {
          id: routeId,
          mode: "reschedule",
          bookingDbId: rescheduleBooking.id,
        },
      });
    },
    [rescheduleBooking, router, toast],
  );

  // View Details — open the same BookingDetailsSheet the bookings tab uses.
  const detailsSheetRef = useRef<BookingDetailsSheetRef>(null);
  const handleAppointmentViewDetails = useCallback(
    (_bookingId: string) => {
      if (upcomingBookingCard) detailsSheetRef.current?.open(upcomingBookingCard);
    },
    [upcomingBookingCard],
  );

  // ── Pending-review prompt ────────────────────────────────────────────────
  // When a user has a completed booking they haven't reviewed yet, surface
  // the LeaveReviewSheet the first time they land on home after the booking
  // completes. Once shown — whether the user submits a rating or dismisses —
  // we persist the booking id to SecureStore so the prompt never auto-fires
  // again for that booking. (Submitting a review also drops the booking
  // from `pendingReviewBookings` via Convex `listReviewedBookingIdsForUser`,
  // so this guard is mainly for "No thanks" dismissals.)
  const { pendingReviewBookings } = useMyBookingsWithDetails();
  const reviewSheetRef = useRef<LeaveReviewSheetRef>(null);
  const promptedIdsRef = useRef<Set<string> | null>(null);
  // The auto-prompt now opens the ReceiptSheet for the eligible booking.
  // The LeaveReviewSheet only opens when the user taps "Leave a review"
  // inside the receipt — we keep the booking here so we can hand it off.
  const [pendingReviewBooking, setPendingReviewBooking] = useState<
    typeof pendingReviewBookings[number] | null
  >(null);
  // Holds the (booking, userId) tuple stashed when the user taps
  // "Leave a review" inside the receipt. The receipt closes first;
  // its onClose fires after the Modal has actually unmounted, and
  // we open the LeaveReviewSheet from there. Driving the chain off
  // onClose (instead of a setTimeout) avoids the iOS Modal-stacking
  // race that left users staring at a blank white sheet.
  const pendingReviewActionRef = useRef<{
    booking: typeof pendingReviewBookings[number];
    userId: string;
  } | null>(null);
  useEffect(() => {
    void loadPromptedBookingIds().then((set) => {
      promptedIdsRef.current = set;
    });
  }, []);
  useFocusEffect(
    useCallback(() => {
      const seen = promptedIdsRef.current;
      // Wait for the persisted set to hydrate before deciding — otherwise
      // we could prompt a booking that was already shown last launch.
      if (!seen || !userId) return;
      const target = pendingReviewBookings.find((b) => !seen.has(b.id));
      if (!target) return;
      setPendingReviewBooking(target);
      void addPromptedBookingId(target.id, seen).then((next) => {
        promptedIdsRef.current = next;
      });
    }, [pendingReviewBookings, userId]),
  );

  // Dynamic visible card IDs — matches the order in ActionCardsCarousel
  const visibleCardIds = useMemo(() => {
    return [
      showAccountSetup ? 'account' : null,
      // Appointment now lives in the top hero (UpcomingAppointmentHero), not
      // the carousel — keep it out of here so it isn't shown twice.
      hasResumeBooking ? 'resume' : null,
      showCarSetup ? 'car' : null,
    ].filter(Boolean) as ('account' | 'appointment' | 'resume' | 'car')[];
  }, [showAccountSetup, upcomingBooking, hasResumeBooking, showCarSetup]);

  const getCardTypeAtIndex = (index: number): 'appointment' | 'resume' | 'account' | 'car' | null => {
    return visibleCardIds[index] ?? null;
  };

  // Custom margins for content below carousel based on active card
  const getCardMargin = (cardIndex: number): number => {
    const cardType = getCardTypeAtIndex(cardIndex);

    switch (cardType) {
      case "appointment":
        return 12;
      case "resume":
        return 20;
      case "account":
        return 20;
      case "car":
        return 20;
      default:
        return 20;
    }
  };

  if (!splashHidden) {
    return (
      <ScrollDrivenGradientBackground colors={["#5BA3D9", "#8FC4E8", "#d9e8f5"]}>
        {() => (
          <View style={styles.splashContainer}>
            <ActivityIndicator size="large" color="#FFFFFF" />
          </View>
        )}
      </ScrollDrivenGradientBackground>
    );
  }

  return (
    <>
    {/* With a banner the top surface starts navy and ends light, so the status
        bar follows `headerTone`. Without one it's the blue page gradient the
        whole way down, which has always taken dark icons. */}
    <StatusBar style={hasHero && statusBarLight ? "light" : "dark"} />
    <ScrollDrivenGradientBackground colors={["#5BA3D9", "#8FC4E8", "#d9e8f5"]} scrollY={scrollYRef}>
      {(scrollHandler) => (
        <View style={styles.container}>
          {/* Full Page Scroll */}
          <Animated.ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              // With a hero, the header lives in the fixed chrome above the
              // ScrollView, so the content has to start clear of it.
              { paddingTop: hasHero ? stableInsetTop + headerRowHeight : 0 },
            ]}
            showsVerticalScrollIndicator={false}
            scrollEnabled={!isCardSwiping}
            // Rubber-band is back: the banner's parallax is clamped at scroll 0
            // (see heroParallaxStyle) so banner and sheet move together on an
            // overscroll bounce, and the banner's background layer extends far
            // enough above itself that pulling down reveals more banner rather
            // than the page gradient.
            bounces
            overScrollMode="never"
            // Prevent iOS from re-adjusting the scroll content when a
            // transparent Modal (e.g. the settings overlay) mounts and
            // triggers a transient safe-area renegotiation — without
            // this, the home content shifts up then back down on press.
            contentInsetAdjustmentBehavior="never"
            automaticallyAdjustContentInsets={false}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
          >
            {/* Appointment banner. Only the banner lives in the scroll flow
                now — the header sits in the fixed chrome below, outside the
                ScrollView, so it survives the whole scroll. The banner drifts
                up at HERO_PARALLAX_RATE while the content sheet rises at full
                speed and closes over it. With no booking, the header is
                in-flow here instead and scrolls away as it always has. */}
            {hasHero ? (
              <Animated.View
                style={heroParallaxStyle}
                onLayout={(e) => {
                  heroHeightSV.value = e.nativeEvent.layout.height;
                }}
              >
                {/* Banner background. The solid fill extends far above the
                    banner so an overscroll bounce pulls more navy into view
                    rather than exposing the page gradient above it; the
                    gradient is offset back down to sit exactly over the
                    banner, so its stops aren't smeared across the overscroll
                    slack. */}
                <View style={styles.heroBackdrop} pointerEvents="none">
                  <LinearGradient
                    colors={[HERO_SURFACE, HERO_SURFACE_DEEP]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={styles.heroBackdropFill}
                  />
                </View>

                <Animated.View style={heroRecedeStyle}>
                  <UpcomingAppointmentHero
                    flat
                    booking={upcomingBookingCard!}
                    carImageUri={
                      upcomingBookingCard!.vin
                        ? vehicleImageUrls[upcomingBookingCard!.vin]
                        : undefined
                    }
                    onPress={() => handleAppointmentViewDetails(upcomingBookingCard!.id)}
                  />
                </Animated.View>
              </Animated.View>
            ) : (
              <View style={{ paddingTop: stableInsetTop + 19 }}>
                <HomeHeaderBar
                  variant="onGradient"
                  locationName={locationName}
                  hasUnreadNotifications={hasUnreadNotifications}
                  onBellPress={openNotificationsSheet}
                />
              </View>
            )}

            {/* Everything below the hero is a rounded "sheet" that slides up
                and COVERS the hero as you scroll (Uber-style). When a hero is
                present it carries the old light-blue home gradient (opaque, so
                it covers the white banner and blends with the page gradient at
                the bottom); otherwise it stays transparent as before. */}
            <View
              style={[styles.sheet, hasHero && styles.sheetOverHero]}
              onLayout={(e) => {
                // Search sits ~34pt into the sheet; use the sheet's Y within
                // the scroll content to drive the sticky-search fade.
                searchBarOffsetY.value = e.nativeEvent.layout.y + SHEET_SEARCH_LEAD;
              }}
            >
              {hasHero && (
                <>
                  {/* Flat base. The wash below is a FIXED height rather than a
                      gradient stop, because LinearGradient locations are
                      fractions of the element and this sheet's height is the
                      whole page — a 30% stop landed hundreds of points below
                      the fold, and moved whenever the content length changed. */}
                  <View style={styles.sheetOverHeroFill} pointerEvents="none" />
                  {/* Picks up the page gradient's mid stop so the booked and
                      unbooked Home read as the same screen below the banner. */}
                  <LinearGradient
                    colors={[PAGE_GRADIENT_MID, SHEET_SETTLED]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={styles.sheetOverHeroWash}
                    pointerEvents="none"
                  />
                </>
              )}

              {/* Search Bar — search field opens the map AND auto-expands
                  the booking sheet (entry point for booking a service). The
                  Map button opens only the map (sheet stays collapsed). */}
              <View
                style={styles.searchContainer}
                onLayout={(e) => {
                  // Feed the pinned copy's collapsed→expanded height animation.
                  // PINNED_SEARCH_ROW_PADDING accounts for the pinned row's own
                  // vertical padding, which the in-flow copy doesn't have.
                  searchRowHeightSV.value =
                    e.nativeEvent.layout.height + PINNED_SEARCH_ROW_PADDING;
                }}
              >
                <MechanicSearchBar
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmit={handleSearch}
                  onMapPress={handleMapPress}
                  onPress={handleSearchPress}
                  placeholderPhrases={SEARCH_PLACEHOLDER_PHRASES}
                />
              </View>

            {/* Content Area */}
            <View style={styles.content}>
              {/* Running-late / overrun banner self-renders when the shop has
                  fired a customer_late_push_reminder or overrun notification. */}
              <CustomerLateBanner
                onReschedule={(bookingId) => handleReschedule(String(bookingId))}
              />
              {/* Action Cards Carousel */}
              {visibleCardIds.length > 0 && <View style={styles.carouselContainer}>
                <ActionCardsCarousel
                  // Upcoming Appointment — now uses the same BookingCard
                  // the bookings tab renders, fed by the adapted booking
                  // row + view-details/cancel handlers below.
                  showAppointment={false}
                  appointmentBooking={upcomingBookingCard}
                  appointmentDestinationLatitude={upcomingBooking?.shopLat ?? 0}
                  appointmentDestinationLongitude={upcomingBooking?.shopLng ?? 0}
                  appointmentDestinationName={upcomingBooking?.shopName}
                  appointmentDestinationAddress={upcomingShopAddress}
                  onAppointmentViewDetails={handleAppointmentViewDetails}
                  onAppointmentCancel={handleAppointmentCancel}
                  onAppointmentReschedule={handleReschedule}
                  // Resume Booking
                  showResumeBooking={hasResumeBooking}
                  resumeServicesPreview={resumeServicesPreview}
                  resumeVehicleName={resumeVehicleName}
                  resumeVehicleImage={resumeVehicleImage}
                  onResumePress={() => {
                    // Re-activate the vehicle the cart was started for before
                    // entering the flow — the booking-flow layout evicts any
                    // cart whose snapshot VIN doesn't match the active car,
                    // so resuming with a different car selected (e.g. after
                    // tapping another car's maintenance card) would otherwise
                    // wipe the very booking this card promises to resume.
                    if (resumeVehicleVin) {
                      useVehicleStore.getState().selectVehicle(resumeVehicleVin);
                    }
                    router.push('/(booking-flow)/select-services');
                  }}
                  // Account Setup — the × only exists once all four steps
                  // are complete; before that there is no dismiss handler,
                  // so the card renders without one.
                  showAccountSetup={showAccountSetup}
                  onAccountSetupDismiss={
                    canDismissAccountSetup
                      ? () => { dismissAccountSetupCard({}); }
                      : undefined
                  }
                  // Car Setup
                  showCarSetup={showCarSetup}
                  carSetupChecklist={carSetupChecklist}
                  isCarSetupDone={isCarSetupDone}
                  carSetupVehicleLabel={carSetupVehicleLabel}
                  carSetupVehicleCount={incompleteVehicles.length}
                  onCarSetupPress={() => {
                    const o = carSetupVehicle?.ownership;
                    if (isCarSetupDone) {
                      // All done — dismiss permanently
                      if (o?._id) dismissSetupCard({ vehicleOwnerId: o._id });
                      setCarSetupDismissed(true);
                      return;
                    }
                    // More than one car still to onboard → let the user choose.
                    if (incompleteVehicles.length > 1) {
                      pickerSheetRef.current?.open();
                      return;
                    }
                    if (!o) {
                      router.push('/add-vehicle');
                    } else if (!o.preOnboardingComplete) {
                      router.push({ pathname: '/car-pre-onboarding', params: { vehicleOwnerId: o._id } });
                    } else {
                      router.push({ pathname: '/(main-tabs)/cars', params: { openStepper: 'true' } });
                    }
                  }}
                  onCarSetupDismiss={() => setCarSetupDismissed(true)}
                  // Carousel callback
                  onCardChange={(index) => setActiveCardIndex(index)}
                  // User status - determines card order
                  isNewUser={isNewUser}
                />
              </View>}

              {/* Action Engine "Now" callout (Yassin v1.1 §3.2). Visible
                  only when allNowItems is non-empty. Sits above the
                  vehicle carousel so the most urgent action is the
                  first thing a returning user sees. */}
              <NowTierCallout
                groups={allNowGroups}
                onCardPress={(group, item) => {
                  // Single card: route with the item's detail modal open.
                  // Multi card (no item): route to the vehicle without a
                  // specific detail (the multi-card header should feel
                  // like "open this car" not "open service X").
                  useVehicleStore.getState().selectVehicle(group.vehicleVin);
                  router.push({
                    pathname: '/(main-tabs)/cars',
                    params: item ? { openItemDetail: item.itemId } : {},
                  });
                }}
                onBookNow={(group, selectedItems) => {
                  // Group carries the vehicle; selectedItems is the
                  // checked subset (single-card path passes an array
                  // of one, so behavior collapses to the old handler).
                  useVehicleStore.getState().selectVehicle(group.vehicleVin);
                  const store = useBookingStore.getState();
                  store.clearSelectedServices();

                  type MatchedService = NonNullable<
                    ReturnType<typeof findServiceForMaintenanceType>
                  >;
                  const matched: MatchedService[] = [];
                  for (const item of selectedItems) {
                    const itemType = extractMaintenanceType(item.itemId);
                    const explicit = item.suggestedServiceId
                      ? store.availableServices.find((s) => s.id === item.suggestedServiceId)
                      : undefined;
                    const svc = explicit ?? findServiceForMaintenanceType(itemType, store.availableServices);
                    if (svc) matched.push(svc);
                  }

                  // Seed the initial tab off the first matched service
                  // (falls back to the type→category map, then a hard
                  // default) so if we do land on select-services, the
                  // correct tab opens.
                  const firstType = selectedItems[0]
                    ? extractMaintenanceType(selectedItems[0].itemId)
                    : null;
                  store.setInitialServiceCategory(
                    matched[0]?.category ??
                      (firstType ? MAINTENANCE_TYPE_TO_CATEGORY[firstType] : null) ??
                      'basic_maintenance',
                  );

                  for (const svc of matched) store.toggleServiceSelection(svc.id);

                  // Skip Screen 1 only when every checked item resolved
                  // to a catalog service — otherwise land on
                  // select-services so the user can see what's missing.
                  router.push(
                    matched.length === selectedItems.length && matched.length > 0
                      ? '/(booking-flow)/choose-mechanic'
                      : '/(booking-flow)/select-services',
                  );
                }}
              />

              {/* Vehicle Maintenance - with dynamic margin based on active card.
                  Constant offset trimmed all the way (24 → -4) to absorb the
                  28 px carouselContainer.marginTop added above (NOW card
                  slides down without nudging this section). */}
              <View style={{ marginTop: (visibleCardIds.length > 0 ? getCardMargin(activeCardIndex) : 0) - 4 }}>
                {hasVehicles ? (
                  <VehicleMaintenanceCard
                    vehicles={mappedVehicles.length > 0 ? mappedVehicles : undefined}
                    onBookNow={(vehicleId, serviceId) => {
                      useVehicleStore.getState().selectVehicle(vehicleId);
                      // serviceId here is the row id, shaped like "<type>-<ownershipId>"
                      // (see urgentItems builder above). Pre-attach the natural
                      // service so the cart isn't empty when the sheet opens.
                      const itemType = extractMaintenanceType(serviceId);
                      const store = useBookingStore.getState();
                      // Prefer the description-matched service we captured at
                      // build time (e.g. Tire Replacement when the status copy
                      // names it). Falls back to the slug default for the type.
                      const tappedItem = vehicleBaseData
                        .flatMap((v) => v.maintenanceItems ?? [])
                        .find((m) => m.id === serviceId);
                      const explicit = tappedItem?.suggestedServiceId
                        ? store.availableServices.find((s) => s.id === tappedItem.suggestedServiceId)
                        : undefined;
                      const matched = explicit ?? findServiceForMaintenanceType(itemType, store.availableServices);
                      // Use the matched service's own category for the tab.
                      // Important when the matcher picks a service from a
                      // different category than the maintenance type's default
                      // (e.g. Brake System Inspection lives in system_diagnostics
                      // even though the maintenance type is "brakes").
                      store.setInitialServiceCategory(
                        matched?.category ?? MAINTENANCE_TYPE_TO_CATEGORY[itemType] ?? 'basic_maintenance',
                      );
                      store.clearSelectedServices();
                      if (matched) store.toggleServiceSelection(matched.id);
                      // Same short-circuit as the NowTierCallout above —
                      // when the service pre-selects cleanly, skip
                      // Screen 1 and land on Choose Mechanic.
                      router.push(
                        matched
                          ? '/(booking-flow)/choose-mechanic'
                          : '/(booking-flow)/select-services',
                      );
                    }}
                    onSwipeStart={() => setIsCardSwiping(true)}
                    onSwipeEnd={() => setIsCardSwiping(false)}
                  />
                ) : (
                  <AddFirstVehicleCard showAccountSetup={showAccountSetup} />
                )}
              </View>

              {/* More Services Section (6-card service-type grid) */}
              <MoreServicesSection onBeforeOpenBookingFlow={openBookingFlow} />

              {/* Service Bundles + Provider Types ("More") only make sense
                  once the user has a car — hide both until one is added. */}
              {hasVehicles && (
                <>
                  {/* Service Bundles Section */}
                  <ServiceBundlesSection onBeforeOpenBookingFlow={openBookingFlow} />

                  {/* Provider Types Section ("More" — 3 provider cards) */}
                  <ProviderTypesSection onBeforeOpenBookingFlow={openBookingFlow} />
                </>
              )}
            </View>
            </View>
          </Animated.ScrollView>

          {/* Fixed top chrome (hero only) — one overlay holding the header for
              the whole scroll plus the search bar that slides in beneath it
              once the in-flow one has passed underneath. Both share a single
              frosted backdrop and hairline so the top of the screen reads as
              one surface instead of two stacked bars. Lives outside the
              ScrollView so we control its safe-area offset directly (avoids
              the sticky-header-under-the-notch problem). */}
          {hasHero && (
            <View style={[styles.topChrome, { paddingTop: stableInsetTop }]} pointerEvents="box-none">
              {/* Chrome background, in two layers. The light bar is the base and
                  is ALWAYS fully opaque; only the navy on top animates.
                  Cross-fading both would let the banner ghost through at the
                  midpoint — two layers at opacity t and 1-t composite to
                  1-t(1-t), so 25% of whatever is behind leaks through dead
                  centre. One opaque base + one fading layer is a true blend
                  between the two colours at every point.

                  Both are opaque rather than frosted for the same reason: a
                  translucent light layer over the navy reads as grey mush and
                  puts the copy at its worst contrast exactly mid-transition.
                  Content passing under simply clips at the hairline, which is
                  standard opaque nav-bar behaviour. */}
              <Animated.View
                style={[StyleSheet.absoluteFill, chromeLightStyle]}
                pointerEvents="none"
              >
                <View style={styles.topChromeHairline} />
              </Animated.View>
              <Animated.View
                style={[StyleSheet.absoluteFill, styles.topChromeNavy, chromeNavyStyle]}
                pointerEvents="none"
              />

              <View
                onLayout={(e) => {
                  // Measure ONCE, at full height. The location subline collapses
                  // on scroll, which re-fires onLayout — re-reading it there
                  // would shrink the ScrollView's paddingTop and jerk the
                  // content up by the subline's height mid-scroll.
                  if (headerMeasuredRef.current) return;
                  headerMeasuredRef.current = true;
                  const h = Math.round(e.nativeEvent.layout.height);
                  setHeaderRowHeight(h);
                  condensedChromeHeight.value =
                    stableInsetTop + h - HOME_HEADER_SUBLINE_HEIGHT;
                }}
              >
                <HomeHeaderBar
                  variant="onHero"
                  locationName={locationName}
                  hasUnreadNotifications={hasUnreadNotifications}
                  onBellPress={openNotificationsSheet}
                  collapse={searchPinned}
                  tone={copyTone}
                />
              </View>

              <Animated.View
                animatedProps={pinnedSearchProps}
                style={[styles.pinnedSearch, pinnedSearchRowStyle]}
              >
                <View style={styles.pinnedSearchInner}>
                  <MechanicSearchBar
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onSubmit={handleSearch}
                    onMapPress={handleMapPress}
                    onPress={handleSearchPress}
                    placeholderPhrases={SEARCH_PLACEHOLDER_PHRASES}
                  />
                </View>
              </Animated.View>
            </View>
          )}

          {/* No hero: the header is in-flow and scrolls away, so the search bar
              still pins on its own as before. */}
          {!hasHero && (
            <Animated.View
              animatedProps={pinnedSearchProps}
              style={[styles.pinnedSearchStandalone, { paddingTop: stableInsetTop }, pinnedSearchStyle]}
            >
              <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
              <View style={styles.pinnedSearchInner}>
                <MechanicSearchBar
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmit={handleSearch}
                  onMapPress={handleMapPress}
                  onPress={handleSearchPress}
                  placeholderPhrases={SEARCH_PLACEHOLDER_PHRASES}
                />
              </View>
            </Animated.View>
          )}

          {/* Loyalty Card Overlay — commented out; the trophy icon now
              navigates straight to /membership instead of opening this
              popover. Restore the block to bring the inline preview back. */}
          {/* {showLoyaltyCard && (
            <LoyaltyCard
              totalPoints={1240}
              currentTier="Gold Member"
              currentPoints={240}
              pointsToNextTier={260}
              nextTier="Platinum"
              maxPoints={500}
              onClose={() => setShowLoyaltyCard(false)}
              onViewFullPage={() => {
                setShowLoyaltyCard(false);
                router.push("/membership");
              }}
            />
          )} */}

          <BottomSheetModal
            ref={sheetRef}
            snapPoints={snapPoints}
            backdropComponent={BlurBackdrop}
            enableDynamicSizing={false}
            enableContentPanningGesture={false}
            handleIndicatorStyle={styles.sheetHandle}
            backgroundStyle={styles.sheetBackground}
          >
            <BottomSheetScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.sheetContentContainer, { paddingBottom: insets.bottom + 24 }]}
            >
              <View style={styles.sheetTitleWrap}>
                <Text style={styles.sheetTitle}>Welcome back!</Text>
              </View>

              <View style={styles.sheetBody}>
                <Text style={styles.sheetBodyText}>
                  Your account was scheduled for deletion, but has now been automatically reactivated since you logged
                  back in.
                </Text>
                <Text style={styles.sheetBodyText}>Your data is safe and your account is fully restored.</Text>
              </View>

              <View style={styles.sheetActions}>
                <Pressable
                  style={({ pressed }) => [styles.sheetPrimaryButton, pressed && styles.sheetPressed]}
                  onPress={() => sheetRef.current?.dismiss()}
                >
                  <Text weight="semiBold" color="#FFF" style={styles.sheetPrimaryButtonText}>
                    Great!
                  </Text>
                </Pressable>
              </View>
            </BottomSheetScrollView>
          </BottomSheetModal>
        </View>
      )}
    </ScrollDrivenGradientBackground>

    {/* No-vehicle gate — shown when user taps into booking without a vehicle */}
    <AddVehicleRequiredSheet
      ref={noVehicleSheetRef}
      onAddVehicle={() => {
        noVehicleSheetRef.current?.close();
        router.push('/add-vehicle');
      }}
      onMaybeLater={() => noVehicleSheetRef.current?.close()}
    />

    {/* Reschedule availability picker. Mirrors the bookings tab's wiring. */}
    <AvailabilityModal
      visible={rescheduleBooking !== null}
      mode="reschedule"
      mechanicId={rescheduleBooking?.mechanicId ?? null}
      shopId={rescheduleBooking?.shopId ?? null}
      onClose={handleCloseRescheduleModal}
      onConfirm={handleConfirmRescheduleSlot}
    />

    {/* Booking details sheet opened by the upcoming appointment card's View Details button. */}
    <BookingDetailsSheet ref={detailsSheetRef} />

    {/* Settings overlay is layout-mounted in (main-tabs)/_layout.tsx and
        opened via useSettingsOverlayStore.open(rect). */}

    {/* Auto-prompt: when the user lands on home with a completed-but-
        unreviewed booking, the receipt rises first (Shopify-style
        post-purchase moment). The LeaveReviewSheet is now only triggered
        by the "Leave a review" CTA inside the receipt; it no longer
        auto-opens on focus. */}
    <ReceiptSheet
      bookingId={(pendingReviewBooking?.id as Id<'bookings'> | undefined) ?? null}
      onClose={() => {
        setPendingReviewBooking(null);
        // Fire any queued review hand-off now that the receipt's
        // Modal has unmounted. Tiny breather so iOS gets one frame
        // post-unmount before we present the next Modal — empirically
        // presenting on the same tick still no-op'd occasionally.
        const pending = pendingReviewActionRef.current;
        pendingReviewActionRef.current = null;
        if (pending) {
          setTimeout(() => {
            reviewSheetRef.current?.open(pending.booking, pending.userId);
          }, 50);
        }
      }}
      onLeaveReview={() => {
        const target = pendingReviewBooking;
        if (!target || !userId) return;
        // Stash the hand-off, then null the booking id which now
        // properly triggers ReceiptSheet's close (the wasOpenRef
        // gate inside it). The Review sheet opens from onClose
        // above once the Modal has unmounted.
        pendingReviewActionRef.current = {
          booking: target,
          userId: String(userId),
        };
        setPendingReviewBooking(null);
      }}
    />
    <LeaveReviewSheet ref={reviewSheetRef} />

    <FinishCarSetupPickerSheet
      ref={pickerSheetRef}
      vehicles={pickerVehicles}
      onSelect={(v) => {
        if (!v.preOnboardingComplete) {
          router.push({ pathname: '/car-pre-onboarding', params: { vehicleOwnerId: v.ownershipId } });
        } else {
          router.push({
            pathname: '/(main-tabs)/cars',
            params: { openStepper: 'true', vehicleOwnerId: v.ownershipId },
          });
        }
      }}
    />
    </>
  );
}

const styles = StyleSheet.create({
  // Welcome screen styles
  welcomeContainer: {
    flex: 1,
    backgroundColor: "#E8ECF0",
    justifyContent: "center",
    alignItems: "center",
  },
  welcomeContent: {
    alignItems: "center",
    gap: 16,
  },
  welcomeTitle: {
    color: "#141C24",
    letterSpacing: 0.5,
  },
  // Main home screen styles
  container: {
    flex: 1,
  },
  splashContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    // NO paddingBottom here — it would sit *outside* the sheet, cutting the
    // sheet's surface short and leaving a hard edge with the page gradient
    // showing beneath it. The tab-bar clearance lives on the sheet instead.
    flexGrow: 1,
  },
  sheet: {
    // Clearance for the floating tab bar. Inside the sheet so the sheet's own
    // surface runs all the way to the bottom of the scroll.
    paddingBottom: 150,
  },
  sheetOverHero: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    // Overlap the hero's lower edge by exactly its paddingBottom (26) so no
    // page gradient shows between them; as the page scrolls, this light-blue
    // surface rises and covers the white hero.
    marginTop: -HERO_SHEET_OVERLAP,
    // NOT `overflow: 'hidden'` — that would kill the shadow on iOS. The
    // gradient fill clips itself instead (see sheetOverHeroFill).
    // Cast a soft shadow upward onto the banner so the sheet reads as a layer
    // lifting over it rather than a rectangle sliding across it.
    shadowColor: '#0B1B33',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -5 },
    elevation: 14,
    // Fill down to the tab bar so the page gradient never shows at the bottom.
    flexGrow: 1,
  },
  // The sheet's gradient fill, clipped to the rounded top corners itself so the
  // sheet view can keep its shadow. Runs past the sheet's bottom edge so an
  // overscroll bounce at the end of the page pulls more sheet into view rather
  // than exposing the page gradient beneath it.
  sheetOverHeroFill: {
    ...StyleSheet.absoluteFillObject,
    bottom: -400,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: SHEET_SETTLED,
  },
  sheetOverHeroWash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SHEET_WASH_HEIGHT,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  // Full-bleed banner background. `top` reaches far above the banner so an
  // overscroll bounce pulls more banner down instead of exposing the page
  // gradient behind the status bar. The solid fill matches the gradient's first
  // stop, so the overscroll slack and the banner proper meet seamlessly.
  heroBackdrop: {
    position: 'absolute',
    top: -HERO_BACKDROP_OVERSCROLL,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: HERO_SURFACE,
  },
  heroBackdropFill: {
    position: 'absolute',
    top: HERO_BACKDROP_OVERSCROLL,
    left: 0,
    right: 0,
    bottom: 0,
  },
  // Fixed top chrome: header (always) + pinned search (on scroll).
  topChrome: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    // Must out-stack the content sheet, which carries elevation for its own
    // upward shadow — on Android that would otherwise paint over the header.
    zIndex: 10,
    elevation: 20,
  },
  topChromeNavy: {
    backgroundColor: HERO_SURFACE,
  },
  topChromeHairline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(15,27,45,0.08)',
  },
  searchContainer: {
    paddingHorizontal: 16,
    // SHEET_SEARCH_LEAD is defined as this offset — keep them one value, since
    // the sticky-search threshold recovers the sheet's Y by subtracting it.
    marginTop: SHEET_SEARCH_LEAD,
    marginBottom: 16,
  },
  // Search row inside the fixed chrome — in normal flow under the header, its
  // height animated from 0 so the chrome grows only once the row is needed.
  pinnedSearch: {
    paddingBottom: 10,
    overflow: 'hidden',
  },
  // No-hero variant: still its own absolutely-positioned bar with its own
  // backdrop, exactly as before.
  pinnedSearchStandalone: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 20,
    paddingBottom: 10,
    overflow: 'hidden',
    // Hairline separation from the content scrolling beneath it.
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(15,27,45,0.08)',
  },
  pinnedSearchInner: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 6,
  },
  content: {
    paddingHorizontal: 16,
  },
  carouselContainer: {
    marginTop: 28,
    marginBottom: 0,
  },
  sheetBackground: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  sheetHandle: {
    backgroundColor: "#E5E5EA",
    width: 44,
  },
  sheetContentContainer: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  sheetTitleWrap: {
    marginTop: 12,
    marginBottom: 20,
    alignItems: "center",
  },
  sheetTitle: {
    fontSize: 24,
    lineHeight: 30,
    color: "#1d1d1f",
    fontWeight: "700",
  },
  sheetBody: {
    gap: 12,
  },
  sheetBodyText: {
    fontSize: 17,
    lineHeight: 25,
    color: "#1d1d1f",
    textAlign: "center",
  },
  sheetActions: {
    marginTop: 28,
    gap: 12,
  },
  sheetPrimaryButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: BrandColors.secondary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: BrandColors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  sheetPrimaryButtonText: {
    fontSize: 17,
  },
  sheetPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  noVehicleContent: {
    paddingBottom: 24,
  },
  noVehicleIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#5299FE1A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  noVehicleSecondaryAction: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  noVehicleSecondaryText: {
    fontSize: 15,
    color: '#8A97A8',
  },
});
