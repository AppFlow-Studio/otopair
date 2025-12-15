/**
 * useOnboardingStore
 *
 * PURPOSE: Tracks progress through onboarding flow and stores collected user data.
 *
 * NOTE: This is a "session" store - data lives only during app session.
 *       Persistence will be added once we move to a dev build.
 *
 * USED IN:
 *   - components/onboarding/WelcomeSlide.tsx
 *   - components/onboarding/CarExperienceSlide.tsx
 *   - components/onboarding/BeginnerOilChange.tsx
 *   - components/onboarding/BeginnerBrakes.tsx
 *   - components/onboarding/BeginnerInspection.tsx
 *
 * STATE:
 *   - currentStep (OnboardingStep): The current step in the onboarding flow
 *   - completedSteps (OnboardingStep[]): Array of completed step names
 *   - data (OnboardingData): All collected user data (profile, permissions, car info)
 *
 * ACTIONS:
 *   - setStep(step): Set the current onboarding step
 *   - completeStep(step): Mark a step as completed
 *   - updateData(updates): Update collected data (merges with existing)
 *   - canProceed(): Check if user can proceed to next step (validation)
 *   - reset(): Reset store to initial state
 *   - getProgress(): Get completion percentage (0-100)
 *   - isStepCompleted(step): Check if a specific step is completed
 *
 * EXAMPLE:
 *   const { updateData, completeStep } = useOnboardingStore();
 *   updateData({ carKnowledgeLevel: 3 });
 *   completeStep('car_knowledge');
 *
 * OWNER: Daniel Chelala
 */

import { create } from 'zustand';

// ─────────────────────────────────────────────────────────────
// STEP DEFINITIONS (like an enum table)
// ─────────────────────────────────────────────────────────────
export const ONBOARDING_STEPS = [
  'welcome',
  'permissions',
  'profile',
  'car_knowledge',
  'add_vehicle',
  'success',
] as const;

export type OnboardingStep = typeof ONBOARDING_STEPS[number];

// ─────────────────────────────────────────────────────────────
// COLLECTED DATA SCHEMA
// ─────────────────────────────────────────────────────────────
interface OnboardingData {
  // Profile Step
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;     // ISO format
  phoneNumber: string | null;

  // User intentions for using app
  userIntentions: string[] | null;

  // Permissions Step
  pushNotificationsGranted: boolean;
  pushNotificationStatus: 'granted' | 'provisional' | 'denied' | 'undetermined' | null;
  locationGranted: boolean;
  locationPermissionStatus: 'granted' | 'denied' | 'undetermined' | null;

  // Car Knowledge Step
  carKnowledgeLevel: 1 | 2 | 3 | 4 | 5 | null;

  // Beginner Oil Change Step
  lastOilChange: 'last_3_months' | '3_6_months' | '6_plus_months' | 'dont_remember' | string | null;

  // Tire Service Step
  lastTireService: 'lt_1_year' | '1_2_years' | '2_plus_years' | 'dont_remember' | null;

  // Brakes Step
  brakesReplaced: 'recently' | 'not_recently' | 'lt_1_year' | '1_2_years' | '2_plus_years' | 'dont_remember' | string | null; //ISO string when known

  // Battery Replacement Step
  lastBatteryReplacement: 'within_last_year' | 'more_than_year_ago' | 'dont_remember' | null;

  // Beginner Inspection Step
  lastInspection: string | 'dont_remember' | null; // ISO string when known

  // Pro Mileage Step
  lastOilMileage: string | 'dont_remember' | null;

  // Services 12 Months Step
  services12months: string[] | null;

  

  // Vehicle Step
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleYear: number | null;
  vehiclePlate: string | null;
  vehicleVin: string | null;
  vehicleMileage: number | null;
}

// ─────────────────────────────────────────────────────────────
// STORE STATE
// ─────────────────────────────────────────────────────────────
interface OnboardingState {
  // Progress Tracking
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];

  // Collected Data
  data: OnboardingData;

  // Actions
  setStep: (step: OnboardingStep) => void;
  completeStep: (step: OnboardingStep) => void;
  updateData: (updates: Partial<OnboardingData>) => void;
  canProceed: () => boolean;
  reset: () => void;

  // Computed
  getProgress: () => number;  // 0-100
  isStepCompleted: (step: OnboardingStep) => boolean;
}

const INITIAL_DATA: OnboardingData = {
  firstName: null,
  lastName: null,
  dateOfBirth: null,
  phoneNumber: null,
  userIntentions: null,
  pushNotificationsGranted: false,
  pushNotificationStatus: null,
  locationGranted: false,
  locationPermissionStatus: null,
  carKnowledgeLevel: null,
  lastOilChange: null,
  lastTireService: null,
  brakesReplaced: null,
  lastBatteryReplacement: null,
  lastInspection: null,
  lastOilMileage: null,
  services12months: null,
  vehicleMake: null,
  vehicleModel: null,
  vehicleYear: null,
  vehiclePlate: null,
  vehicleVin: null,
  vehicleMileage: null,
};

export const useOnboardingStore = create<OnboardingState>()((set, get) => ({
  currentStep: 'welcome',
  completedSteps: [],
  data: INITIAL_DATA,

  setStep: (step) => set({ currentStep: step }),

  completeStep: (step) => {
    set((state) => ({
      completedSteps: state.completedSteps.includes(step)
        ? state.completedSteps
        : [...state.completedSteps, step],
    }));
  },

  updateData: (updates) => {
    set((state) => ({
      data: { ...state.data, ...updates },
    }));
  },

  canProceed: () => {
    const { currentStep, data } = get();

    // Validation rules per step
    switch (currentStep) {
      case 'welcome':
        return true;
      case 'permissions':
        return true;  // Can skip, but we ask
      case 'profile':
        return Boolean(data.firstName && data.lastName);
      case 'car_knowledge':
        return data.carKnowledgeLevel !== null;
      case 'add_vehicle':
        return Boolean(data.vehicleMake && data.vehicleModel && data.vehicleYear);
      case 'success':
        return true;
      default:
        return false;
    }
  },

  getProgress: () => {
    const { completedSteps } = get();
    return Math.round((completedSteps.length / ONBOARDING_STEPS.length) * 100);
  },

  isStepCompleted: (step) => get().completedSteps.includes(step),

  reset: () => {
    set({
      currentStep: 'welcome',
      completedSteps: [],
      data: INITIAL_DATA,
    });
  },
}));
