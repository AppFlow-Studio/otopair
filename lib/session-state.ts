import { clearOnboardingResumeState } from "@/lib/onboarding-resume";
import { purgeOfflineSessionCache } from "@/lib/offlineSessionCache";
import { useAuthStore } from "@/stores/useAuthStore";
import { useBookingStore } from "@/stores/useBookingStore";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import { usePaymentStore } from "@/stores/usePaymentStore";
import { useSettingsOverlayStore } from "@/stores/useSettingsOverlayStore";
import { useVehicleStore } from "@/stores/useVehicleStore";

export function clearUserScopedStores() {
  useBookingStore.getState().resetBookingFlow();
  useBookingStore.getState().clearBookingState();
  useVehicleStore.getState().clearVehicles();
  usePaymentStore.getState().clearPaymentMethods();
  useSettingsOverlayStore.getState().reset();
  useOnboardingStore.getState().reset();
  useAuthStore.getState().reset();
}

export async function clearUserSessionState(clerkUserId?: string | null) {
  clearUserScopedStores();
  await clearOnboardingResumeState(clerkUserId);
  // Session-scoped offline cache (bookings / vehicles / maintenance) is
  // only valid for the signed-in session — drop it with the session.
  await purgeOfflineSessionCache();
}
