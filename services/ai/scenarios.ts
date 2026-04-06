/**
 * AI Scenarios Data
 *
 * PURPOSE: Defines all conversation scenarios with stage-specific messages, suggestions, and shops
 *
 * USED IN: services/ai/scenarioEngine.ts (getScenarioByType, findScenarioByTrigger)
 *
 * SCENARIOS:
 *   - brake_noise - Brake squeal/grinding diagnosis
 *   - check_engine - Check engine light code lookup
 *   - oil_change - Service scheduling with service picker
 *   - tire_pressure - TPMS/tire issue diagnosis
 *   - vague_issue - General vehicle inspection
 *   - new_vehicle - New vehicle registration
 *   - direct_booking - Direct mechanic booking
 *
 * EXPORTS:
 *   - SCENARIOS - Array of all scenario definitions
 *   - WELCOME_SUGGESTIONS - Initial greeting suggestions
 *   - getScenarioByType, findScenarioByTrigger - Lookup helpers
 *
 * OWNER: Waleed Mansour
 */

import type { Scenario, ScenarioType, ScenarioResponse, ConversationState, AIMechanic, TimeSlot } from "./types";
import type { ReasoningStep } from "@/components/ai-chat/AIReasoning";
import type { Source } from "@/components/ai-chat/AISources";
import { SOURCE_DEFINITIONS } from "@/components/ai-chat/AISources";
import { PRIORITY_REPLIES, CONFIRMATION_REPLIES } from "@/components/ai-chat/AIQuickReplies";
import { MOCK_SHOPS } from "@/stores/data/mockShops";
import { MOCK_MECHANICS } from "@/stores/data/mockMechanics";

// ============================================================================
// HELPER: CONVERT STORE DATA TO AI CHAT FORMAT
// ============================================================================

function getMechanicsForPriority(priority: string | null): AIMechanic[] {
  // Get available mechanics
  const availableMechanics = MOCK_MECHANICS.filter((m) => m.isAvailable || m.availability > 0);

  // Sort based on priority
  let sorted = [...availableMechanics];

  switch (priority) {
    case "closest":
      // Sort by distance
      sorted = sorted.sort((a, b) => a.distanceMi - b.distanceMi).slice(0, 5);
      break;
    case "best_rated":
      sorted = sorted.sort((a, b) => b.rating - a.rating).slice(0, 5);
      break;
    case "best_price":
      // Sort by availability as proxy for price competitiveness
      sorted = sorted.sort((a, b) => b.availability - a.availability).slice(0, 5);
      break;
    default:
      sorted = sorted.slice(0, 5);
  }

  // Find shop addresses for each mechanic
  return sorted.map((mechanic, index) => {
    const shop = MOCK_SHOPS.find((s) => s.id === mechanic.shopId);
    return {
      id: mechanic.id,
      name: mechanic.name,
      shopName: mechanic.shopName,
      address: shop?.address || "Manhattan, NY",
      rating: mechanic.rating,
      isVerified: mechanic.isVerified,
      photoUrl: mechanic.photoUrl,
      distanceMi: mechanic.distanceMi,
      services: mechanic.services,
      yearsExperience: mechanic.yearsExperience,
      isAvailable: mechanic.isAvailable,
      responseTime: mechanic.responseTime,
      availability: mechanic.availability,
      nextAvailability: mechanic.nextAvailability,
      price: `$${45 + index * 10}`, // Mock prices
    };
  });
}

// Legacy alias for backward compatibility
const getShopsForPriority = getMechanicsForPriority;

function getTimeSlotsForShop(shopId: number): TimeSlot[] {
  // Find mechanics for this shop
  const mechanic = MOCK_MECHANICS.find((m) => m.shopId === shopId);

  if (mechanic && mechanic.nextAvailability) {
    return mechanic.nextAvailability.slice(0, 4).map((slot, index) => ({
      id: `time_${index}`,
      day: slot.dayOfWeek,
      time: slot.time,
      displayText: `${slot.dayOfWeek} ${slot.day} at ${slot.time}`,
      dayOfWeek: slot.dayOfWeek,
    }));
  }

  // Default time slots
  return [
    { id: "time_1", day: "Tomorrow", time: "9:00 AM", displayText: "Tomorrow 9:00 AM" },
    { id: "time_2", day: "Tomorrow", time: "2:00 PM", displayText: "Tomorrow 2:00 PM" },
    { id: "time_3", day: "Thursday", time: "10:00 AM", displayText: "Thursday 10:00 AM" },
  ];
}

// ============================================================================
// REASONING STEPS BY SCENARIO
// ============================================================================

const BRAKE_REASONING: ReasoningStep[] = [
  { id: "brake_1", text: "Checking Smartcar API for brake system warnings...", completed: true },
  { id: "brake_2", text: "Checking Service History - last brake service: 18 months ago", completed: true },
  { id: "brake_3", text: 'Analyzing symptom: "high-pitched squeal"', completed: true },
  { id: "brake_4", text: "Matching pattern in Common Scenarios DB...", completed: true },
];

const CHECK_ENGINE_REASONING: ReasoningStep[] = [
  { id: "cel_1", text: "Scanning Smartcar API for error codes...", completed: true },
  { id: "cel_2", text: "Found code P0171 - looking up in Error Code Dictionary...", completed: true },
  { id: "cel_3", text: 'P0171 = "System Too Lean - Bank 1"', completed: true },
  { id: "cel_4", text: "Common causes: vacuum leak, MAF sensor, air filter", completed: true },
];

const OIL_CHANGE_REASONING: ReasoningStep[] = [
  { id: "oil_1", text: "Checking Smartcar API for oil life percentage...", completed: true },
  { id: "oil_2", text: "Oil life at 12% - approximately 500 miles remaining", completed: true },
  { id: "oil_3", text: "Checking Service History for preferred shops...", completed: true },
];

const TIRE_PRESSURE_REASONING: ReasoningStep[] = [
  { id: "tire_1", text: "Reading Smartcar API tire pressure data...", completed: true },
  { id: "tire_2", text: "Front left tire at 24 PSI (8 below recommended)", completed: true },
  { id: "tire_3", text: "Checking for recent temperature changes...", completed: true },
];

const VAGUE_ISSUE_REASONING: ReasoningStep[] = [
  { id: "vague_1", text: "Running full vehicle diagnostic scan...", completed: true },
  { id: "vague_2", text: "Checking Service History for recent work...", completed: true },
  { id: "vague_3", text: "Analyzing symptom patterns...", completed: true },
];

const NEW_VEHICLE_REASONING: ReasoningStep[] = [
  { id: "new_vehicle_1", text: "Checking VIN database...", completed: true },
  { id: "new_vehicle_2", text: "Retrieving vehicle specifications...", completed: true },
  { id: "new_vehicle_3", text: "Setting up maintenance schedule...", completed: true },
];

// ============================================================================
// SOURCES BY SCENARIO
// ============================================================================

const BRAKE_SOURCES: Source[] = [
  { ...SOURCE_DEFINITIONS.smartcar_api, details: "Brake system sensor data" },
  { ...SOURCE_DEFINITIONS.service_history, details: "Last brake service: 18 months ago" },
  { ...SOURCE_DEFINITIONS.common_scenarios, details: "Squeal pattern analysis" },
];

const CHECK_ENGINE_SOURCES: Source[] = [
  { ...SOURCE_DEFINITIONS.smartcar_api, details: "Error code P0171 detected" },
  { ...SOURCE_DEFINITIONS.error_codes, details: "System Too Lean - Bank 1" },
  { ...SOURCE_DEFINITIONS.common_scenarios, details: "Known causes database" },
];

const OIL_CHANGE_SOURCES: Source[] = [
  { ...SOURCE_DEFINITIONS.smartcar_api, details: "Oil life: 12%" },
  { ...SOURCE_DEFINITIONS.service_history, details: "Preferred shops" },
];

const TIRE_PRESSURE_SOURCES: Source[] = [
  { ...SOURCE_DEFINITIONS.smartcar_api, details: "TPMS sensor readings" },
  { ...SOURCE_DEFINITIONS.service_history, details: "Recent tire work" },
];

// ============================================================================
// STAGE SUGGESTIONS
// ============================================================================

export const WELCOME_SUGGESTIONS = [
  { id: "oil", text: "Schedule Services for my Vehicle", value: "Schedule Services for my Vehicle" },
  { id: "vague", text: "Something Feels Off", value: "Something Feels Off" },
  { id: "check_engine", text: "Warning Light is On", value: "Warning Light is On" },
];

export const PRIORITY_SUGGESTIONS = [
  { id: "closest", text: "Closest", value: "closest" },
  { id: "best_rated", text: "Best rated", value: "best_rated" },
  { id: "best_price", text: "Best price", value: "best_price" },
];

export const CONFIRMATION_SUGGESTIONS = [
  { id: "confirm", text: "Yes, book it" },
  { id: "change", text: "Change time" },
  { id: "cancel", text: "Cancel" },
];

export const YES_NO_SUGGESTIONS = [
  { id: "yes", text: "Yes", value: "yes" },
  { id: "no", text: "No", value: "no" },
];

// ============================================================================
// SCENARIO: BRAKE NOISE
// ============================================================================

const BRAKE_NOISE_SCENARIO: Scenario = {
  type: "brake_noise",
  triggers: ["brake", "squeak", "squeaking", "grinding", "squeal", "screech", "hearing", "noise", "sound"],
  steps: [
    {
      stage: "diagnosis",
      getMessage: (state, userInput) => ({
        message:
          "I can hear you're having brake issues. Based on my scan, your brake pads are showing significant wear - the wear indicator is likely what's causing that squeal. This is a safety item that should be addressed soon.\n\nWould you like me to find a nearby mechanic that can inspect and replace your brake pads?",
        reasoning: BRAKE_REASONING,
        sources: BRAKE_SOURCES,
        nextStage: "question",
        suggestions: YES_NO_SUGGESTIONS,
      }),
    },
    {
      stage: "question",
      getMessage: (state, userInput) => ({
        message: "How would you like me to find mechanics for you?",
        nextStage: "priority_selection",
        suggestions: PRIORITY_SUGGESTIONS,
      }),
    },
    {
      stage: "priority_selection",
      getMessage: (state, userInput) => {
        const shops = getShopsForPriority(state.selectedPriority);
        return {
          message: `Great choice! Here are the ${
            state.selectedPriority === "closest"
              ? "nearest"
              : state.selectedPriority === "best_rated"
              ? "top-rated"
              : "most affordable"
          } mechanics that can help with your brakes:`,
          shops,
          nextStage: "shop_selection",
          suggestions: [],
        };
      },
    },
    {
      stage: "shop_selection",
      getMessage: (state, userInput) => {
        const timeSlots = getTimeSlotsForShop(state.selectedShop?.id || 1);
        return {
          message: `${state.selectedShop?.name || "This mechanic"} has these times available for brake service:`,
          nextStage: "time_selection",
          suggestions: timeSlots.map((t) => ({ id: t.id, text: t.displayText })),
        };
      },
    },
    {
      stage: "time_selection",
      getMessage: (state, userInput) => ({
        message: `Perfect! Here's your booking summary:\n\n🔧 **Service:** Brake Inspection & Pad Replacement\n📍 **Location:** ${
          state.selectedShop?.name || "Selected Location"
        }\n📅 **Time:** ${state.selectedTime?.displayText || "Selected Time"}\n💰 **Estimate:** ${
          state.selectedShop?.price || "$79"
        } + $4.99 platform fee\n\nWould you like me to confirm this booking?`,
        quickReplies: CONFIRMATION_REPLIES,
        nextStage: "confirmation",
        suggestions: CONFIRMATION_SUGGESTIONS,
      }),
    },
    {
      stage: "success",
      getMessage: (state) => ({
        message: `✅ **Booking Confirmed!**\n\nYour brake service is scheduled for ${state.selectedTime?.displayText} at ${state.selectedShop?.name}.\n\nI'll send you a reminder 1 hour before your appointment. Drive safe until then! 🚗`,
        nextStage: "success",
        suggestions: [],
      }),
    },
  ],
};

// ============================================================================
// SCENARIO: CHECK ENGINE LIGHT
// ============================================================================

const CHECK_ENGINE_SCENARIO: Scenario = {
  type: "check_engine",
  triggers: ["check engine", "engine light", "cel", "warning light", "dashboard light"],
  steps: [
    {
      stage: "diagnosis",
      getMessage: (state, userInput) => ({
        message:
          "I've scanned your vehicle and found **Error Code P0171** - this means your engine is running lean (too much air, not enough fuel). Common causes include:\n\n• Vacuum leak\n• Faulty MAF sensor\n• Dirty air filter\n\nThis should be diagnosed professionally to pinpoint the exact cause. Would you like me to find a mechanic?",
        reasoning: CHECK_ENGINE_REASONING,
        sources: CHECK_ENGINE_SOURCES,
        nextStage: "question",
        suggestions: YES_NO_SUGGESTIONS,
      }),
    },
    {
      stage: "question",
      getMessage: (state, userInput) => ({
        message: "How would you like me to find mechanics for you?",
        nextStage: "priority_selection",
        suggestions: PRIORITY_SUGGESTIONS,
      }),
    },
    {
      stage: "priority_selection",
      getMessage: (state, userInput) => {
        const shops = getShopsForPriority(state.selectedPriority);
        return {
          message: `Here are mechanics with diagnostic equipment that can help:`,
          shops,
          nextStage: "shop_selection",
          suggestions: [],
        };
      },
    },
    {
      stage: "shop_selection",
      getMessage: (state, userInput) => {
        const timeSlots = getTimeSlotsForShop(state.selectedShop?.id || 1);
        return {
          message: `${
            state.selectedShop?.name || "This mechanic"
          } can run a full diagnostic. Here are available times:`,
          nextStage: "time_selection",
          suggestions: timeSlots.map((t) => ({ id: t.id, text: t.displayText })),
        };
      },
    },
    {
      stage: "time_selection",
      getMessage: (state, userInput) => ({
        message: `Here's your diagnostic appointment:\n\n🔧 **Service:** Engine Diagnostic Scan\n📍 **Location:** ${
          state.selectedShop?.name || "Selected Location"
        }\n📅 **Time:** ${
          state.selectedTime?.displayText || "Selected Time"
        }\n💰 **Estimate:** $89 diagnostic + $4.99 platform fee\n\nConfirm booking?`,
        quickReplies: CONFIRMATION_REPLIES,
        nextStage: "confirmation",
        suggestions: CONFIRMATION_SUGGESTIONS,
      }),
    },
    {
      stage: "success",
      getMessage: (state) => ({
        message: `✅ **Diagnostic Booked!**\n\n${state.selectedTime?.displayText} at ${state.selectedShop?.name}.\n\nThey'll identify the exact cause of code P0171 and give you repair options. Reminder coming 1 hour before! 🔧`,
        nextStage: "success",
        suggestions: [],
      }),
    },
  ],
};

// ============================================================================
// SCENARIO: SCHEDULE / OIL CHANGE (now with service picker)
// ============================================================================

const OIL_CHANGE_SCENARIO: Scenario = {
  type: "oil_change",
  triggers: ["oil change", "oil", "oil life", "change oil", "need oil", "schedule", "maintenance", "service"],
  steps: [
    {
      stage: "service_selection",
      getMessage: (state, userInput) => ({
        message: "I'd be happy to help you schedule service! What would you like to get done today?",
        showServicePicker: true,
        nextStage: "service_selection",
        suggestions: [],
      }),
    },
    {
      stage: "priority_selection",
      getMessage: (state, userInput) => {
        const serviceNames = state.selectedServices.map((s) => s.name).join(", ");
        return {
          message: `Great choices! You selected **${serviceNames}**.\n\nHow would you like me to find mechanics?`,
          quickReplies: PRIORITY_REPLIES,
          nextStage: "priority_selection",
          suggestions: PRIORITY_SUGGESTIONS,
        };
      },
    },
    {
      stage: "shop_selection",
      getMessage: (state, userInput) => {
        const shops = getShopsForPriority(state.selectedPriority);
        const serviceCount = state.selectedServices.length;
        return {
          message: `Here are the ${
            state.selectedPriority === "closest"
              ? "nearest"
              : state.selectedPriority === "best_rated"
              ? "top-rated"
              : "most affordable"
          } mechanics that can handle ${serviceCount > 1 ? "all your services" : "this service"}:`,
          shops,
          nextStage: "shop_selection",
          suggestions: [],
        };
      },
    },
    {
      stage: "time_selection",
      getMessage: (state, userInput) => {
        const timeSlots = getTimeSlotsForShop(state.selectedShop?.id || 1);
        return {
          message: `${state.selectedShop?.name || "This mechanic"} can get you in at these times:`,
          nextStage: "time_selection",
          suggestions: timeSlots.map((t) => ({ id: t.id, text: t.displayText })),
        };
      },
    },
    {
      stage: "confirmation",
      getMessage: (state, userInput) => {
        const serviceNames = state.selectedServices.map((s) => s.name).join(", ");
        const totalPrice = state.selectedServices.reduce((acc, s) => {
          const match = s.estimatedPrice.match(/\$(\d+)/);
          return acc + (match ? parseInt(match[1]) : 50);
        }, 0);

        return {
          message: `Your appointment is ready to book:\n\n🔧 **Services:** ${serviceNames}\n📍 **Location:** ${
            state.selectedShop?.name || "Selected Location"
          }\n📅 **Time:** ${state.selectedTime?.displayText || "Selected Time"}\n💰 **Estimate:** $${totalPrice}-${
            totalPrice + 50
          } + $4.99 platform fee\n\nConfirm?`,
          quickReplies: CONFIRMATION_REPLIES,
          nextStage: "confirmation",
          suggestions: CONFIRMATION_SUGGESTIONS,
        };
      },
    },
    {
      stage: "success",
      getMessage: (state) => {
        const serviceNames = state.selectedServices.map((s) => s.name).join(", ");
        return {
          message: `✅ **Booking Confirmed!**\n\nYour ${serviceNames} appointment is scheduled for ${state.selectedTime?.displayText} at ${state.selectedShop?.name}.\n\nI'll send you a reminder 1 hour before! 🚗`,
          nextStage: "success",
          suggestions: [],
        };
      },
    },
  ],
};

// ============================================================================
// SCENARIO: TIRE PRESSURE
// ============================================================================

const TIRE_PRESSURE_SCENARIO: Scenario = {
  type: "tire_pressure",
  triggers: ["tire", "pressure", "tpms", "flat", "low tire"],
  steps: [
    {
      stage: "diagnosis",
      getMessage: (state, userInput) => ({
        message:
          "I've checked your tire sensors. Your **front left tire** is at 24 PSI - that's 8 below the recommended 32 PSI. This could be:\n\n• A slow leak\n• Temperature change\n• Valve stem issue\n\nI'd recommend getting it inspected. Want me to find a tire mechanic?",
        reasoning: TIRE_PRESSURE_REASONING,
        sources: TIRE_PRESSURE_SOURCES,
        nextStage: "question",
        suggestions: YES_NO_SUGGESTIONS,
      }),
    },
    {
      stage: "question",
      getMessage: (state, userInput) => ({
        message: "How would you like me to find mechanics for you?",
        nextStage: "priority_selection",
        suggestions: PRIORITY_SUGGESTIONS,
      }),
    },
    {
      stage: "priority_selection",
      getMessage: (state, userInput) => {
        const shops = getShopsForPriority(state.selectedPriority);
        return {
          message: `Here are tire service mechanics nearby:`,
          shops,
          nextStage: "shop_selection",
          suggestions: [],
        };
      },
    },
    {
      stage: "shop_selection",
      getMessage: (state, userInput) => {
        const timeSlots = getTimeSlotsForShop(state.selectedShop?.id || 1);
        return {
          message: `${state.selectedShop?.name || "This mechanic"} can inspect your tire at:`,
          nextStage: "time_selection",
          suggestions: timeSlots.map((t) => ({ id: t.id, text: t.displayText })),
        };
      },
    },
    {
      stage: "time_selection",
      getMessage: (state, userInput) => ({
        message: `Tire inspection booking:\n\n🔧 **Service:** Tire Inspection & Repair\n📍 **Location:** ${
          state.selectedShop?.name || "Selected Location"
        }\n📅 **Time:** ${
          state.selectedTime?.displayText || "Selected Time"
        }\n💰 **Estimate:** $25-$45 + $4.99 platform fee\n\nBook it?`,
        quickReplies: CONFIRMATION_REPLIES,
        nextStage: "confirmation",
        suggestions: CONFIRMATION_SUGGESTIONS,
      }),
    },
    {
      stage: "success",
      getMessage: (state) => ({
        message: `✅ **Tire Service Booked!**\n\n${state.selectedTime?.displayText} at ${state.selectedShop?.name}.\n\nThey'll check for leaks and get your pressure right. See you there! 🚗`,
        nextStage: "success",
        suggestions: [],
      }),
    },
  ],
};

// ============================================================================
// SCENARIO: VAGUE ISSUE
// ============================================================================

const VAGUE_ISSUE_SCENARIO: Scenario = {
  type: "vague_issue",
  triggers: ["something wrong", "feels off", "weird", "strange", "not right", "acting up"],
  steps: [
    {
      stage: "diagnosis",
      getMessage: (state, userInput) => ({
        message:
          "I understand - sometimes cars just don't feel right. I ran a quick scan and didn't find any active error codes, but that doesn't mean nothing's wrong.\n\nA professional inspection can catch issues that sensors miss. Would you like me to book a full vehicle inspection?",
        reasoning: VAGUE_ISSUE_REASONING,
        sources: [
          { ...SOURCE_DEFINITIONS.smartcar_api, details: "No active error codes" },
          { ...SOURCE_DEFINITIONS.service_history, details: "Checking recent work" },
          { ...SOURCE_DEFINITIONS.common_scenarios, details: "Symptom analysis" },
        ],
        nextStage: "question",
        suggestions: YES_NO_SUGGESTIONS,
      }),
    },
    {
      stage: "question",
      getMessage: (state, userInput) => ({
        message: "How would you like me to find mechanics for you?",
        nextStage: "priority_selection",
        suggestions: PRIORITY_SUGGESTIONS,
      }),
    },
    {
      stage: "priority_selection",
      getMessage: (state, userInput) => {
        const shops = getShopsForPriority(state.selectedPriority);
        return {
          message: `These mechanics offer comprehensive inspections:`,
          shops,
          nextStage: "shop_selection",
          suggestions: [],
        };
      },
    },
    {
      stage: "shop_selection",
      getMessage: (state, userInput) => {
        const timeSlots = getTimeSlotsForShop(state.selectedShop?.id || 1);
        return {
          message: `${state.selectedShop?.name || "This mechanic"} can do a full inspection at:`,
          nextStage: "time_selection",
          suggestions: timeSlots.map((t) => ({ id: t.id, text: t.displayText })),
        };
      },
    },
    {
      stage: "time_selection",
      getMessage: (state, userInput) => ({
        message: `Full inspection booking:\n\n🔍 **Service:** Multi-Point Vehicle Inspection\n📍 **Location:** ${
          state.selectedShop?.name || "Selected Location"
        }\n📅 **Time:** ${
          state.selectedTime?.displayText || "Selected Time"
        }\n💰 **Estimate:** $49-$99 + $4.99 platform fee\n\nConfirm?`,
        quickReplies: CONFIRMATION_REPLIES,
        nextStage: "confirmation",
        suggestions: CONFIRMATION_SUGGESTIONS,
      }),
    },
    {
      stage: "success",
      getMessage: (state) => ({
        message: `✅ **Inspection Booked!**\n\n${state.selectedTime?.displayText} at ${state.selectedShop?.name}.\n\nThey'll do a thorough check and let you know if anything needs attention. Peace of mind incoming! 🔍`,
        nextStage: "success",
        suggestions: [],
      }),
    },
  ],
};

// ============================================================================
// SCENARIO: NEW VEHICLE
// ============================================================================

const NEW_VEHICLE_SCENARIO: Scenario = {
  type: "new_vehicle",
  triggers: ["new vehicle", "new car", "register vehicle", "add vehicle", "register car", "add car"],
  steps: [
    {
      stage: "diagnosis",
      getMessage: (state, userInput) => ({
        message:
          "Welcome! Let's get your new vehicle registered. I'll help you set up:\n\n✓ **Vehicle Profile** - Save make, model, and VIN\n✓ **Maintenance Schedule** - Set up service reminders\n✓ **Preferred Mechanics** - Find trusted shops near you\n\nTo get started, you can either:\n• Enter your VIN manually\n• Connect via Smartcar API for automatic setup\n\nWould you like me to help you find a mechanic for your initial setup and inspection?",
        reasoning: NEW_VEHICLE_REASONING,
        sources: [
          { ...SOURCE_DEFINITIONS.smartcar_api, details: "Ready to connect" },
          { ...SOURCE_DEFINITIONS.manufacturer_data, details: "VIN database access" },
        ],
        nextStage: "question",
        suggestions: YES_NO_SUGGESTIONS,
      }),
    },
    {
      stage: "question",
      getMessage: (state, userInput) => ({
        message: "How would you like me to find mechanics for your new vehicle setup?",
        nextStage: "priority_selection",
        suggestions: PRIORITY_SUGGESTIONS,
      }),
    },
    {
      stage: "priority_selection",
      getMessage: (state, userInput) => {
        const shops = getShopsForPriority(state.selectedPriority);
        return {
          message: `These mechanics can help with your new vehicle setup and first inspection:`,
          shops,
          nextStage: "shop_selection",
          suggestions: [],
        };
      },
    },
    {
      stage: "shop_selection",
      getMessage: (state, userInput) => {
        const timeSlots = getTimeSlotsForShop(state.selectedShop?.id || 1);
        return {
          message: `${state.selectedShop?.name || "This mechanic"} is available for your new vehicle setup at:`,
          nextStage: "time_selection",
          suggestions: timeSlots.map((t) => ({ id: t.id, text: t.displayText })),
        };
      },
    },
    {
      stage: "time_selection",
      getMessage: (state, userInput) => ({
        message: `New vehicle setup appointment:\n\n🚗 **Service:** Vehicle Registration & Initial Inspection\n📍 **Location:** ${
          state.selectedShop?.name || "Selected Location"
        }\n📅 **Time:** ${
          state.selectedTime?.displayText || "Selected Time"
        }\n💰 **Estimate:** $75-$125 + $4.99 platform fee\n\nConfirm?`,
        quickReplies: CONFIRMATION_REPLIES,
        nextStage: "confirmation",
        suggestions: CONFIRMATION_SUGGESTIONS,
      }),
    },
    {
      stage: "success",
      getMessage: (state) => ({
        message: `✅ **New Vehicle Setup Booked!**\n\n${state.selectedTime?.displayText} at ${state.selectedShop?.name}.\n\nThey'll help register your vehicle, perform an initial inspection, and set up your maintenance schedule. Welcome to Otopair! 🚗`,
        nextStage: "success",
        suggestions: [],
      }),
    },
  ],
};

// ============================================================================
// SCENARIO: DIRECT BOOKING
// ============================================================================

const DIRECT_BOOKING_SCENARIO: Scenario = {
  type: "direct_booking",
  triggers: ["book", "schedule", "appointment", "service"],
  steps: [
    {
      stage: "priority_selection",
      getMessage: (state, userInput) => {
        const shops = getShopsForPriority(state.selectedPriority);
        return {
          message: `Sure! Here are available mechanics:`,
          shops,
          nextStage: "shop_selection",
          suggestions: [],
        };
      },
    },
    {
      stage: "shop_selection",
      getMessage: (state, userInput) => {
        const timeSlots = getTimeSlotsForShop(state.selectedShop?.id || 1);
        return {
          message: `Here are available times at ${state.selectedShop?.name || "this mechanic"}:`,
          nextStage: "time_selection",
          suggestions: timeSlots.map((t) => ({ id: t.id, text: t.displayText })),
        };
      },
    },
    {
      stage: "time_selection",
      getMessage: (state, userInput) => ({
        message: `Ready to book:\n\n📍 **Location:** ${state.selectedShop?.name || "Selected Location"}\n📅 **Time:** ${
          state.selectedTime?.displayText || "Selected Time"
        }\n💰 **Platform fee:** $4.99\n\nConfirm booking?`,
        quickReplies: CONFIRMATION_REPLIES,
        nextStage: "confirmation",
        suggestions: CONFIRMATION_SUGGESTIONS,
      }),
    },
    {
      stage: "success",
      getMessage: (state) => ({
        message: `✅ **Booked!**\n\n${state.selectedTime?.displayText} at ${state.selectedShop?.name}.\n\nReminder coming 1 hour before! 📅`,
        nextStage: "success",
        suggestions: [],
      }),
    },
  ],
};

// ============================================================================
// EXPORT ALL SCENARIOS
// ============================================================================

export const SCENARIOS: Scenario[] = [
  BRAKE_NOISE_SCENARIO,
  CHECK_ENGINE_SCENARIO,
  OIL_CHANGE_SCENARIO,
  TIRE_PRESSURE_SCENARIO,
  VAGUE_ISSUE_SCENARIO,
  NEW_VEHICLE_SCENARIO,
  DIRECT_BOOKING_SCENARIO,
];

export function getScenarioByType(type: ScenarioType): Scenario | undefined {
  return SCENARIOS.find((s) => s.type === type);
}

export function findScenarioByTrigger(input: string): Scenario | undefined {
  const lowerInput = input.toLowerCase();
  return SCENARIOS.find((scenario) => scenario.triggers.some((trigger) => lowerInput.includes(trigger)));
}
