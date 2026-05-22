// 1. React & React Native
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';

// 2. Expo & Third-party
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { BlurBackdrop } from "@/components/shared-ui/BlurBackdrop";
import { Bell, MoveRight, Star, Trophy } from 'lucide-react-native';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useMutationWithToast } from '@/hooks/useMutationWithToast';

// 3. Shared UI
import { Button, BrandColors, ScrollDrivenGradientBackground, Text } from "@/components/shared-ui";

// 4. Stores & Hooks
import { useAuthStore } from '@/stores/useAuthStore';
import { useBookingStore } from '@/stores/useBookingStore';
import { usePendingNavigationStore } from "@/stores/usePendingNavigationStore";
import { useVehicleStore } from "@/stores/useVehicleStore";
import { useNotificationsSheetStore } from "@/stores/useNotificationsSheetStore";
import { useNotificationsFromConvex } from "@/hooks/useNotificationsFromConvex";
import { useShallow } from 'zustand/react/shallow';
import { useVehicleOwnershipFromConvex } from '@/hooks/useVehicleOwnershipFromConvex';
import { fetchVehicleImageUrl } from '@/utils/vehicleImage';
import { adaptConvexBookingWithDetailsToCard } from '@/utils/bookingAdapter';
import { BookingDetailsSheet, type BookingDetailsSheetRef } from '@/components/bookings/BookingDetailsSheet';
import { CustomerLateBanner } from '@/components/bookings/CustomerLateBanner';
import { LeaveReviewSheet, type LeaveReviewSheetRef } from '@/components/bookings/LeaveReviewSheet';
import { useMyBookingsWithDetails } from '@/hooks/useMyBookingsWithDetails';
import { useUserFromConvex } from '@/hooks/useUserFromConvex';
import * as SecureStore from 'expo-secure-store';

// Persists the set of booking IDs that have already triggered the
// review-prompt sheet on home, so each completed booking only auto-prompts
// once across app restarts.
const REVIEW_PROMPT_SEEN_KEY = 'otopair.reviewPromptSeenBookingIds.v1';
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
import type { Id } from '@/convex/_generated/dataModel';

// Native iOS 26 liquid glass (optional)
let LiquidGlassView: React.ComponentType<any> | null = null;
let isLiquidGlassEnabled = false;
try {
  const lg = require("@callstack/liquid-glass");
  LiquidGlassView = lg.LiquidGlassView;
  isLiquidGlassEnabled = !!lg.isLiquidGlassSupported;
} catch {
  // Not available — fall back to BlurView style
}

// 6. Flow-specific components
import { ActionCardsCarousel } from "@/components/home/ActionCardsCarousel";
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
import { ProfileInitialsButton } from "@/components/home/ProfileInitialsButton";
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
  const [locationName, setLocationName] = useState('Loading...');
  const [vehicleImageUrls, setVehicleImageUrls] = useState<Record<string, string>>({});
  const fetchedVinsRef = useRef<Set<string>>(new Set());
  const saveVehicleImageUrl = useMutation(api.vehicles.saveVehicleImageUrl);
  const dismissSetupCard = useMutation(api.vehicle_owners.dismissSetupCard);
  const [showLoyaltyCard, setShowLoyaltyCard] = useState(false);
  const [isCardSwiping, setIsCardSwiping] = useState(false);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [accountSetupDismissed, setAccountSetupDismissed] = useState(false);
  const [carSetupDismissed, setCarSetupDismissed] = useState(false);

  // Reactivation bottom sheet (from temur-dev)
  const sheetRef = useRef<BottomSheetModal>(null);
  const hasPresentedReactivationRef = useRef(false);
  const snapPoints = useMemo(() => ["42%"], []);

  useEffect(() => {
    if (shouldShowReactivationSheet && showWelcome) {
      setShowWelcome(false);
    }
  }, [shouldShowReactivationSheet, showWelcome]);

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

  // Upcoming appointment: next future booking that's pending or confirmed
  const upcomingBooking = useMemo(() => {
    if (!allBookings) return null;
    const today = new Date().toISOString().split('T')[0];
    return allBookings
      .filter((b: any) => (b.status === 'pending' || b.status === 'confirmed') && b.scheduled_date >= today)
      .sort((a: any, b: any) => a.scheduled_date.localeCompare(b.scheduled_date) || a.scheduled_time.localeCompare(b.scheduled_time))
      [0] ?? null;
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

  // Resume booking vehicle context — subscribed reads so the card refreshes
  // when the user switches vehicle or Convex re-syncs mid-booking.
  const resumeVehicle = useVehicleStore((s) =>
    s.selectedVehicleId ? s.vehicles[s.selectedVehicleId] : undefined,
  );
  const resumeVehicleName = resumeVehicle ? `${resumeVehicle.make} ${resumeVehicle.model}` : undefined;
  const resumeVehicleImage = resumeVehicle?.imageSource;

  // Account setup: hide when all checkable steps are done. Mirrors the
  // per-step logic inside FinishAccountSetupCard:
  //   - Create Account: signed-in user with name (covers OAuth signups
  //     that skip the full onboarding flow)
  //   - About You: tellUsAboutCompleted flag
  //   - Add Car: at least one registered vehicle
  //   - Payment Method: always considered complete
  const hasCreateAccount = !!(me?.first_name && me?.last_name) || me?.onboardingCompleted === true;
  const hasAboutYou = me?.tellUsAboutCompleted === true;
  const isAccountSetupComplete = hasCreateAccount && hasAboutYou && hasVehicles;
  // TEMP: force the Finish-setup card visible so the redesigned tiles
  // can be reviewed even after the user has completed setup. Revert
  // this to `!isAccountSetupComplete && !accountSetupDismissed` once
  // QA is done.
  const showAccountSetup = !accountSetupDismissed;

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
    (async () => {
      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationName("Location unavailable");
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({});

      // Get location name (reverse geocoding)
      try {
        const [address] = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        if (address) {
          setLocationName(`${address.city || address.subregion || "Unknown"}, ${address.region || ""}`);
        }
      } catch (error) {
        setLocationName("Unknown location");
      }
    })();
  }, []);

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

  // ── Vehicle data with maintenance (no image dep — avoids cascading recomputation) ──
  const vehicleBaseData = useMemo(() => {
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

        const urgentItems: { id: string; serviceName: string; dueText: string; isOverdue: boolean }[] = [];
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
            knownIssues
          );
          if (result.status === "overdue" || result.status === "due_soon" || result.status === "needs_attention") {
            urgentItems.push({
              id: `${rec.type}-${ownershipId}`,
              serviceName: MAINTENANCE_LABELS[rec.type as keyof typeof MAINTENANCE_LABELS] || rec.type,
              dueText: result.status === "overdue" ? "Overdue" : result.status === "due_soon" ? "Due soon" : "Needs attention",
              isOverdue: result.status === "overdue",
            });
          }
          if (urgentItems.length >= 3) break;
        }

        const items = urgentItems.length > 0
          ? urgentItems
          : [{ id: "healthy", serviceName: "All systems healthy", dueText: "No action needed", isOverdue: false }];
        return { id: r.vin, name: displayName, vin: r.vin, maintenanceItems: items };
      });
  }, [listVehicles, allMaintenanceRecords]);

  // Merge image URLs separately — cheap, only re-maps when images arrive
  const mappedVehicles = useMemo(
    () => vehicleBaseData.map((v) => ({ ...v, imageUrl: vehicleImageUrls[v.vin] ?? "" })),
    [vehicleBaseData, vehicleImageUrls]
  );

  const handleSearch = (query: string) => {
    console.log("Search submitted:", query);
    // TODO: Implement search functionality
  };

  const handleMapPress = () => {
    router.push("/booking/map");
  };

  // Notifications bell — opens the global NotificationsSheet and
  // surfaces an unread dot when the customer has pending outbox rows
  // (e.g., a shop has just proposed a reschedule).
  const openNotificationsSheet = useNotificationsSheetStore((s) => s.open);
  const { unreadCount: notificationsUnreadCount } = useNotificationsFromConvex();
  const hasUnreadNotifications = notificationsUnreadCount > 0;

  // Trophy dot — true when the user has earned any credit since the
  // last time they opened the loyalty surface. Cleared by the
  // `markCreditsSeen` mutation when the loyalty popover opens.
  const { userId } = useUserFromConvex();
  const hasUnseenCredits = useQuery(
    api.rewards.hasUnseenCredits,
    userId ? { userId } : "skip",
  );
  const markCreditsSeen = useMutation(api.rewards.markCreditsSeen);

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

  // Cancel handler — mirror the bookings tab's behavior. Convex bookings
  // get the cancelBooking mutation; tire-quote-prefixed local IDs are
  // out of scope here (those don't surface as upcoming on home).
  const cancelConvexBooking = useMutationWithToast(api.bookings.cancelBooking, {
    success: "Booking cancelled.",
    error: "Couldn't cancel this booking. Try again.",
  });
  const handleAppointmentCancel = useCallback(
    (bookingId: string) => {
      const isLocalId = bookingId.startsWith("tire_quote_") || bookingId.startsWith("booking_");
      if (!isLocalId) {
        void cancelConvexBooking({ bookingId: bookingId as Id<"bookings"> });
      }
    },
    [cancelConvexBooking],
  );

  // Reschedule from the late banner = confirm-then-cancel. We don't have
  // in-place reschedule yet; the spec is to drop the slot so the driver
  // can book fresh.
  const handleRescheduleConfirm = useCallback(
    (bookingId: string) => {
      Alert.alert(
        "Reschedule appointment?",
        "This will cancel your current booking. You'll need to book a new time slot.",
        [
          { text: "Keep booking", style: "cancel" },
          {
            text: "Cancel & reschedule",
            style: "destructive",
            onPress: () => {
              const isLocalId = bookingId.startsWith("tire_quote_") || bookingId.startsWith("booking_");
              if (!isLocalId) {
                void cancelConvexBooking({ bookingId: bookingId as Id<"bookings"> });
              }
            },
          },
        ],
      );
    },
    [cancelConvexBooking],
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
      reviewSheetRef.current?.open(target, String(userId));
      void addPromptedBookingId(target.id, seen).then((next) => {
        promptedIdsRef.current = next;
      });
    }, [pendingReviewBookings, userId]),
  );

  // Dynamic visible card IDs — matches the order in ActionCardsCarousel
  const visibleCardIds = useMemo(() => {
    return [
      showAccountSetup ? 'account' : null,
      upcomingBooking ? 'appointment' : null,
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
    <ScrollDrivenGradientBackground colors={["#5BA3D9", "#8FC4E8", "#d9e8f5"]}>
      {(scrollHandler) => (
        <View style={styles.container}>
          {/* Full Page Scroll */}
          <Animated.ScrollView
            style={styles.scrollView}
            contentContainerStyle={[styles.scrollContent, { paddingTop: stableInsetTop + 12 }]}
            showsVerticalScrollIndicator={false}
            scrollEnabled={!isCardSwiping}
            // Prevent iOS from re-adjusting the scroll content when a
            // transparent Modal (e.g. the settings overlay) mounts and
            // triggers a transient safe-area renegotiation — without
            // this, the home content shifts up then back down on press.
            contentInsetAdjustmentBehavior="never"
            automaticallyAdjustContentInsets={false}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
          >
            {/* Header */}
            <View style={styles.header}>
              {/* Location */}
              <View style={styles.locationSection}>
                <View style={{ marginLeft: 12, marginTop: -8 }}>
                  <ProfileInitialsButton />
                </View>
                <View style={styles.locationText}>
                  <Text size="xl" color="#FFFFFF" weight="bold">
                    Otopair
                  </Text>
                  <Text weight="semiBold" size="sm" color="#FFFFFF">
                    {locationName}
                  </Text>
                </View>
              </View>

              {/* Right Side - Gold Tier & Bell */}
              <View style={styles.headerRight}>
                {/* Gold Tier Badge - Clickable */}
                <Pressable
                  onPress={() => {
                    if (hasUnseenCredits && userId) {
                      void markCreditsSeen({ userId });
                    }
                    router.push("/membership");
                  }}
                  style={({ pressed }) => [styles.goldTierBadge, pressed && styles.goldTierBadgePressed]}
                >
                  {isLiquidGlassEnabled && LiquidGlassView ? (
                    <LiquidGlassView interactive effect="clear" style={styles.liquidGlassIcon}>
                      <View style={styles.bellIconContainer}>
                        <Trophy size={22} color="#6B7280" fill="none" strokeWidth={2} />
                        {hasUnseenCredits ? <View style={styles.trophyDot} /> : null}
                      </View>
                    </LiquidGlassView>
                  ) : (
                    <View style={styles.glassContainer}>
                      <BlurView intensity={10} tint="dark" style={styles.glassBlur}>
                        <View style={styles.glassOverlay} />
                        <LinearGradient
                          colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.05)']}
                          start={{ x: 0.5, y: 0 }}
                          end={{ x: 0.5, y: 0.5 }}
                          style={styles.glassGloss}
                        />
                        <View style={styles.bellIconContainer}>
                          <Trophy size={22} color="#6B7280" fill="none" strokeWidth={2} />
                          {hasUnseenCredits ? <View style={styles.trophyDot} /> : null}
                        </View>
                      </BlurView>
                    </View>
                  )}
                </Pressable>

                {/* Notification Bell */}
                <Pressable
                  onPress={openNotificationsSheet}
                  style={({ pressed }) => [styles.bellButton, pressed && styles.bellButtonPressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Notifications"
                >
                  {isLiquidGlassEnabled && LiquidGlassView ? (
                    <LiquidGlassView interactive effect="clear" style={styles.liquidGlassIcon}>
                      <View style={styles.bellIconContainer}>
                        <Bell size={22} color="#6B7280" fill="none" strokeWidth={2} />
                        {hasUnreadNotifications ? <View style={styles.bellDot} /> : null}
                      </View>
                    </LiquidGlassView>
                  ) : (
                    <View style={styles.glassContainer}>
                      <BlurView intensity={10} tint="dark" style={styles.glassBlur}>
                        <View style={styles.glassOverlay} />
                        <LinearGradient
                          colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.05)']}
                          start={{ x: 0.5, y: 0 }}
                          end={{ x: 0.5, y: 0.5 }}
                          style={styles.glassGloss}
                        />
                        <View style={styles.bellIconContainer}>
                          <Bell size={22} color="#6B7280" fill="none" strokeWidth={2} />
                          {hasUnreadNotifications ? <View style={styles.bellDot} /> : null}
                        </View>
                      </BlurView>
                    </View>
                  )}
                </Pressable>
              </View>
            </View>

            {/* Search Bar — tapping the search field opens the map flow
                (same as the Map button) since free-text search isn't
                wired yet and the map is the primary discovery surface. */}
            <View style={styles.searchContainer}>
              <MechanicSearchBar
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmit={handleSearch}
                onMapPress={handleMapPress}
                onPress={handleMapPress}
              />
            </View>

            {/* Content Area */}
            <View style={styles.content}>
              {/* Running-late / overrun banner — self-renders when the
                  shop has fired a customer_late_push_reminder or
                  overrun_customer_resolution notification. Reschedule
                  triggers a confirm-then-cancel flow. */}
              <CustomerLateBanner
                onReschedule={(bookingId) => handleRescheduleConfirm(String(bookingId))}
              />
              {/* Action Cards Carousel */}
              {visibleCardIds.length > 0 && <View style={styles.carouselContainer}>
                <ActionCardsCarousel
                  // Upcoming Appointment — now uses the same BookingCard
                  // the bookings tab renders, fed by the adapted booking
                  // row + view-details/cancel handlers below.
                  showAppointment={!!upcomingBooking}
                  appointmentBooking={upcomingBookingCard}
                  appointmentEtaMinutes={20}
                  appointmentDestinationLatitude={upcomingBooking?.shopLat ?? 0}
                  appointmentDestinationLongitude={upcomingBooking?.shopLng ?? 0}
                  appointmentDestinationName={upcomingBooking?.shopName}
                  onAppointmentViewDetails={handleAppointmentViewDetails}
                  onAppointmentCancel={handleAppointmentCancel}
                  // Resume Booking
                  showResumeBooking={hasResumeBooking}
                  resumeServicesPreview={resumeServicesPreview}
                  resumeVehicleName={resumeVehicleName}
                  resumeVehicleImage={resumeVehicleImage}
                  onResumePress={() => router.push('/booking/map?openServices=true')}
                  // Account Setup
                  showAccountSetup={showAccountSetup}
                  onAccountSetupDismiss={() => setAccountSetupDismissed(true)}
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

              {/* Vehicle Maintenance - with dynamic margin based on active card */}
              <View style={{ marginTop: (visibleCardIds.length > 0 ? getCardMargin(activeCardIndex) : 0) + 24 }}>
                {hasVehicles ? (
                  <VehicleMaintenanceCard
                    vehicles={mappedVehicles.length > 0 ? mappedVehicles : undefined}
                    onBookNow={(vehicleId, serviceId) => {
                      useVehicleStore.getState().selectVehicle(vehicleId);
                      router.push('/booking/map?openServices=true');
                    }}
                    onSwipeStart={() => setIsCardSwiping(true)}
                    onSwipeEnd={() => setIsCardSwiping(false)}
                  />
                ) : (
                  <AddFirstVehicleCard showAccountSetup={showAccountSetup} />
                )}
              </View>

              {/* More Services Section (6-card service-type grid) */}
              <MoreServicesSection />

              {/* Service Bundles Section */}
              <ServiceBundlesSection />

              {/* Provider Types Section ("More" — 3 provider cards) */}
              <ProviderTypesSection />
            </View>
          </Animated.ScrollView>

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

    {/* Booking details sheet — opened by the upcoming appointment card's
        View Details button. Mirrors the bookings tab's wiring. */}
    <BookingDetailsSheet ref={detailsSheetRef} />

    {/* Settings overlay now lives at the `/profile-overlay` route
        (app/profile-overlay.tsx) so it can open from any tab via router.push. */}

    {/* Auto-prompt: if the user has a completed-but-unreviewed booking,
        this sheet pops on focus / cold start until they submit a review. */}
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
    paddingBottom: 150,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: 16,
    paddingLeft: 0,
    marginBottom: 16,
  },
  locationSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    flex: 1,
    paddingLeft: 0,
  },
  locationText: {
    gap: 0,
    marginTop: -7,
    marginLeft: 12,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  goldTierBadge: {
    alignItems: "center",
    justifyContent: "center",
  },
  goldTierBadgePressed: {
    opacity: 0.7,
  },
  bellButton: {
    padding: 4,
  },
  bellButtonPressed: {
    opacity: 0.7,
  },
  liquidGlassIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glassContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
  },
  glassBlur: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  glassGloss: {
    ...StyleSheet.absoluteFillObject,
  },
  bellIconContainer: {
    position: "relative",
  },
  bellDot: {
    position: "absolute",
    top: 1,
    right: 1,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#FF3B30",
  },
  // Trophy icon's handles extend past its cup, so the bell offset
  // would land the dot on the handle. Pull it up-and-out so it sits
  // cleanly above the cup.
  trophyDot: {
    position: "absolute",
    top: -3,
    right: -3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF3B30",
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginTop: 34,
    marginBottom: 16,
  },
  content: {
    paddingHorizontal: 16,
  },
  carouselContainer: {
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
});
