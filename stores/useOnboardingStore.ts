/**
 * useOnboardingStore
 *
 * PURPOSE: Tracks progress through onboarding and setup flows and stores all collected user data.
 *
 * USED IN: OnboardingFlow, TellUsAboutFlow, and various step components.
 *          Temporarily used in app/(main-tabs)/home/index.tsx for testing purposes. This will be removed after testing.
 *
 * STATE:
 *   - data (OnboardingData): All collected user data (profile, vehicle, questionnaire).
 *   - currentStep (OnboardingStep): Active step in the onboarding flow.
 *   - currentSetupStep (SetupStep): Active step in the setup flow.
 *
 * EXAMPLE:
 *   const { updateData, completeSetupStep } = useOnboardingStore();
 *   updateData({ carKnowledgeLevel: 3 });
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
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

export const SETUP_STEPS = [
  'create_account',
  'tell_us_about_yourself',
  'add_your_car',
  'set_up_payment_method',
] as const;

export type OnboardingStep = typeof ONBOARDING_STEPS[number];
export type SetupStep = typeof SETUP_STEPS[number];

// ─────────────────────────────────────────────────────────────
// COLLECTED DATA SCHEMA
// ─────────────────────────────────────────────────────────────
interface OnboardingData {
  // Profile Step
  firstName: string | null;
  lastName: string | null;
  alias: string | null;
  username: string | null;
  profilePhotoUri: string | null;
  dateOfBirth: string | null;     // ISO format
  phoneNumber: string | null;
  phoneCountryCode: string | null;

  // User intentions for using app
  userIntentions: string[] | null;

  // Permissions Step
  pushNotificationsGranted: boolean;
  pushNotificationStatus: 'granted' | 'provisional' | 'denied' | 'undetermined' | null;
  locationGranted: boolean;
  locationPermissionStatus: 'granted' | 'denied' | 'undetermined' | null;

  // Car Knowledge Step
  carKnowledgeLevel: 1 | 2 | 3 | null;

  // Setup questionnaire (home bottom-sheet)
  carUsage: string | null;
  servicePriorities: string[] | null;
  decisionHelper: string | null;
  isTellUsAboutYourselfComplete: boolean;
  carStressNote: string | null;
  maintenanceTracking: string | null;
  monthlyMileage: string | null;
  shopType: string | null;
  whyNewOption: string[] | null;
  carTerminologyComfort: string | null;
  repairQuoteNeeds: string[] | null;
  diyTasks: string[] | null;
  maintenanceApproach: string | null;
  primaryReason: string | null;
  shopPriorities: string[] | null;
  communicationPreference: string | null;
  additionalPreferences: string | null;

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
  // TODO: Remove this Progress Tracking — used for old onboarding flow that is being replaced
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];

  // Setup Progress Tracking
  currentSetupStep: SetupStep;
  completedSetupSteps: SetupStep[];

  // Collected Data
  data: OnboardingData;

  // Actions
  // TODO: Remove setStep and completeStep - for old onboarding flow that is being replaced
  setStep: (step: OnboardingStep) => void;
  completeStep: (step: OnboardingStep) => void;
  setSetupStep: (step: SetupStep) => void;
  completeSetupStep: (step: SetupStep) => void
  updateData: (updates: Partial<OnboardingData>) => void;
  canProceed: () => boolean;
  reset: () => void;

  // Computed
  getProgress: () => number;  // 0-100
  isStepCompleted: (step: OnboardingStep) => boolean;
  isSetupStepCompleted: (step: SetupStep) => boolean;
}

const INITIAL_DATA: OnboardingData = {
  firstName: null,
  lastName: null,
  alias: null,
  username: null,
  profilePhotoUri: null,
  dateOfBirth: null,
  phoneNumber: null,
  phoneCountryCode: null,
  userIntentions: null,
  pushNotificationsGranted: false,
  pushNotificationStatus: null,
  locationGranted: false,
  locationPermissionStatus: null,
  carKnowledgeLevel: null,
  carUsage: null,
  servicePriorities: null,
  decisionHelper: null,
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
  isTellUsAboutYourselfComplete: false,
  carStressNote: null,
  maintenanceTracking: null,
  monthlyMileage: null,
  shopType: null,
  whyNewOption: null,
  carTerminologyComfort: null,
  repairQuoteNeeds: null,
  diyTasks: null,
  maintenanceApproach: null,
  primaryReason: null,
  shopPriorities: null,
  communicationPreference: null,
  additionalPreferences: null,
};

export const useOnboardingStore = create<OnboardingState>()((set, get) => ({
  // Onboarding (Old flow, TODO: remove after migration)
  currentStep: 'welcome',
  completedSteps: [],
  setStep: (step) => set({ currentStep: step }),
  completeStep: (step) => {
    set((state) => ({
      completedSteps: state.completedSteps.includes(step)
        ? state.completedSteps
        : [...state.completedSteps, step],
    }));
  },

  // Setup (New flow)
  currentSetupStep: 'create_account',
  completedSetupSteps: [],
  setSetupStep: (step: SetupStep) => set({ currentSetupStep: step }),
  completeSetupStep: (step: SetupStep) => {
    set((state) => ({
      completedSetupSteps: state.completedSetupSteps.includes(step)
        ? state.completedSetupSteps
        : [...state.completedSetupSteps, step],
    }));
  },

  // Data and actions
  data: INITIAL_DATA,
  updateData: (updates) => {
    set((state) => ({
      data: { ...state.data, ...updates },
    }));
  },

  canProceed: () => {
    const { currentStep, data, currentSetupStep } = get();

    // Validation for onboarding step (legacy)
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
        break;
    }

    // Validation for setup step (new flow)
    switch (currentSetupStep) {
      case 'create_account':
        return Boolean(data.phoneNumber && data.firstName && data.lastName && data.username);
      case 'tell_us_about_yourself':
        return Boolean(data.firstName && data.lastName);
      case 'add_your_car':
        return Boolean(data.vehicleMake && data.vehicleModel && data.vehicleYear);
      case 'set_up_payment_method':
        return true; // Payment method can be optional
      default:
        return false;
    }
  },

  getProgress: () => {
    const { completedSteps, completedSetupSteps } = get();
    // Prefer new setup steps if any used, else fallback to old
    if (completedSetupSteps.length > 0) {
      // You may need to define SETUP_STEPS somewhere
      return Math.round((completedSetupSteps.length / (typeof SETUP_STEPS !== 'undefined' ? SETUP_STEPS.length : 1)) * 100);
    }
    return Math.round((completedSteps.length / (typeof ONBOARDING_STEPS !== 'undefined' ? ONBOARDING_STEPS.length : 1)) * 100);
  },

  isStepCompleted: (step) => get().completedSteps.includes(step),
  isSetupStepCompleted: (step) => get().completedSetupSteps.includes(step),

  reset: () => {
    set({
      currentStep: 'welcome',
      completedSteps: [],
      currentSetupStep: 'create_account',
      completedSetupSteps: [],
      data: INITIAL_DATA,
    });
  },
}));
