/**
 * Scenario Engine
 * Pattern matching and conversation state management
 * Uses existing mock data from stores/data
 */

import type {
  ConversationState,
  ConversationStage,
  ScenarioType,
  ChatMessage,
  ScenarioResponse,
  AIShop,
  TimeSlot,
} from "./types";
import { SCENARIOS, getScenarioByType, findScenarioByTrigger, WELCOME_SUGGESTIONS } from "./scenarios";
import { MOCK_SHOPS } from "@/stores/data/mockShops";
import { MOCK_MECHANICS } from "@/stores/data/mockMechanics";

// ============================================================================
// INITIAL STATE
// ============================================================================

export function createInitialState(): ConversationState {
  return {
    currentStage: "welcome",
    currentScenario: null,
    messages: [],
    selectedPriority: null,
    selectedShop: null,
    selectedTime: null,
    selectedServices: [],
    serviceName: null,
    servicePrice: null,
    isProcessing: false,
    suggestions: WELCOME_SUGGESTIONS,
  };
}

// ============================================================================
// PATTERN MATCHING
// ============================================================================

export function detectScenario(input: string): ScenarioType | null {
  const scenario = findScenarioByTrigger(input);
  return scenario?.type || null;
}

export function detectPriority(input: string): string | null {
  const lowerInput = input.toLowerCase();

  if (lowerInput.includes("closest") || lowerInput.includes("near")) {
    return "closest";
  }
  if (lowerInput.includes("best rated") || lowerInput.includes("rating") || lowerInput.includes("rated")) {
    return "best_rated";
  }
  if (lowerInput.includes("best price") || lowerInput.includes("cheap") || lowerInput.includes("price")) {
    return "best_price";
  }

  return null;
}

export function detectConfirmation(input: string): "confirm" | "change" | "cancel" | null {
  const lowerInput = input.toLowerCase();

  if (lowerInput.includes("yes") || lowerInput.includes("book") || lowerInput.includes("confirm")) {
    return "confirm";
  }
  if (lowerInput.includes("change") || lowerInput.includes("different")) {
    return "change";
  }
  if (lowerInput.includes("cancel") || lowerInput.includes("no")) {
    return "cancel";
  }

  return null;
}

// ============================================================================
// SHOP AND TIME MATCHING
// ============================================================================

export function findShopByInput(input: string): AIShop | null {
  const lowerInput = input.toLowerCase();

  // Try to find matching shop from mock data
  const matchedShop = MOCK_SHOPS.find(
    (shop) =>
      lowerInput.includes(shop.name.toLowerCase()) ||
      shop.name
        .toLowerCase()
        .split(" ")
        .some((word) => word.length > 3 && lowerInput.includes(word.toLowerCase()))
  );

  if (matchedShop) {
    return {
      id: matchedShop.id,
      name: matchedShop.name,
      address: matchedShop.address,
      rating: matchedShop.rating,
      availability: matchedShop.availability,
      distanceMi: 1.5,
      price: "$65",
    };
  }

  // Default to first available shop
  const defaultShop = MOCK_SHOPS.find((s) => s.hasAvailableSlots);
  if (defaultShop) {
    return {
      id: defaultShop.id,
      name: defaultShop.name,
      address: defaultShop.address,
      rating: defaultShop.rating,
      availability: defaultShop.availability,
      distanceMi: 0.8,
      price: "$55",
    };
  }

  return null;
}

export function findTimeSlotByInput(input: string): TimeSlot | null {
  const lowerInput = input.toLowerCase();

  // Common time patterns
  const timePatterns = [
    { pattern: /tomorrow\s*9/i, slot: { id: "t1", day: "Tomorrow", time: "9:00 AM", displayText: "Tomorrow 9:00 AM" } },
    {
      pattern: /tomorrow\s*11/i,
      slot: { id: "t2", day: "Tomorrow", time: "11:30 AM", displayText: "Tomorrow 11:30 AM" },
    },
    {
      pattern: /tomorrow\s*2|tomorrow\s*14/i,
      slot: { id: "t3", day: "Tomorrow", time: "2:00 PM", displayText: "Tomorrow 2:00 PM" },
    },
    {
      pattern: /thursday\s*10/i,
      slot: { id: "t4", day: "Thursday", time: "10:00 AM", displayText: "Thursday 10:00 AM" },
    },
    { pattern: /9.*am/i, slot: { id: "t1", day: "Tomorrow", time: "9:00 AM", displayText: "Tomorrow 9:00 AM" } },
    { pattern: /10.*am/i, slot: { id: "t5", day: "Tomorrow", time: "10:00 AM", displayText: "Tomorrow 10:00 AM" } },
  ];

  for (const { pattern, slot } of timePatterns) {
    if (pattern.test(lowerInput)) {
      return slot;
    }
  }

  // Default to first time slot
  return { id: "t1", day: "Tomorrow", time: "9:00 AM", displayText: "Tomorrow 9:00 AM" };
}

// ============================================================================
// MESSAGE PROCESSING
// ============================================================================

export function processUserMessage(
  state: ConversationState,
  userInput: string
): { newState: ConversationState; response: ScenarioResponse } {
  const userMessage: ChatMessage = {
    id: `user_${Date.now()}`,
    role: "user",
    content: userInput,
    timestamp: new Date().toISOString(),
    stage: state.currentStage,
  };

  let newState: ConversationState = {
    ...state,
    messages: [...state.messages, userMessage],
    isProcessing: true,
  };

  let response: ScenarioResponse;

  // Handle based on current stage
  switch (state.currentStage) {
    case "welcome": {
      // Detect scenario from user input
      const scenarioType = detectScenario(userInput);
      if (scenarioType) {
        newState.currentScenario = scenarioType;
        const scenario = getScenarioByType(scenarioType);
        if (scenario) {
          // Find the first step (usually diagnosis or priority_selection)
          const step = scenario.steps[0];
          if (step) {
            response = step.getMessage(newState, userInput);
            newState.currentStage = response.nextStage;
            newState.suggestions = response.suggestions;
          } else {
            response = getDefaultResponse(newState);
          }
        } else {
          response = getDefaultResponse(newState);
        }
      } else {
        response = getDefaultResponse(newState);
      }
      break;
    }

    case "diagnosis":
    case "question": {
      // Continue with current scenario to priority selection
      if (newState.currentScenario) {
        const scenario = getScenarioByType(newState.currentScenario);
        if (scenario) {
          const step = scenario.steps.find((s) => s.stage === "priority_selection");
          if (step) {
            response = step.getMessage(newState, userInput);
            newState.currentStage = response.nextStage;
            newState.suggestions = response.suggestions;
          } else {
            response = getDefaultResponse(newState);
          }
        } else {
          response = getDefaultResponse(newState);
        }
      } else {
        response = getDefaultResponse(newState);
      }
      break;
    }

    case "service_selection": {
      // User has selected services, move to priority selection
      if (newState.currentScenario) {
        const scenario = getScenarioByType(newState.currentScenario);
        if (scenario) {
          const step = scenario.steps.find((s) => s.stage === "priority_selection");
          if (step) {
            response = step.getMessage(newState, userInput);
            newState.currentStage = "priority_selection";
            newState.suggestions = response.suggestions;
          } else {
            response = getDefaultResponse(newState);
          }
        } else {
          response = getDefaultResponse(newState);
        }
      } else {
        response = getDefaultResponse(newState);
      }
      break;
    }

    case "priority_selection": {
      // Detect and store priority
      const priority = detectPriority(userInput) || userInput.toLowerCase();
      newState.selectedPriority = priority;

      if (newState.currentScenario) {
        const scenario = getScenarioByType(newState.currentScenario);
        if (scenario) {
          const step =
            scenario.steps.find((s) => s.stage === "shop_selection") ||
            scenario.steps.find((s) => s.stage === "priority_selection");
          if (step) {
            response = step.getMessage(newState, userInput);
            newState.currentStage = "shop_selection";
            newState.suggestions = response.suggestions;
          } else {
            response = getDefaultResponse(newState);
          }
        } else {
          response = getDefaultResponse(newState);
        }
      } else {
        response = getDefaultResponse(newState);
      }
      break;
    }

    case "shop_selection": {
      // Find and store selected shop
      const shop = findShopByInput(userInput);
      if (shop) {
        newState.selectedShop = shop;
      }

      if (newState.currentScenario) {
        const scenario = getScenarioByType(newState.currentScenario);
        if (scenario) {
          const step =
            scenario.steps.find((s) => s.stage === "time_selection") ||
            scenario.steps.find((s) => s.stage === "shop_selection");
          if (step) {
            response = step.getMessage(newState, userInput);
            newState.currentStage = "time_selection";
            newState.suggestions = response.suggestions;
          } else {
            response = getDefaultResponse(newState);
          }
        } else {
          response = getDefaultResponse(newState);
        }
      } else {
        response = getDefaultResponse(newState);
      }
      break;
    }

    case "time_selection": {
      // Find and store selected time
      const time = findTimeSlotByInput(userInput);
      if (time) {
        newState.selectedTime = time;
      }

      if (newState.currentScenario) {
        const scenario = getScenarioByType(newState.currentScenario);
        if (scenario) {
          const step =
            scenario.steps.find((s) => s.stage === "confirmation") ||
            scenario.steps.find((s) => s.stage === "time_selection");
          if (step) {
            response = step.getMessage(newState, userInput);
            newState.currentStage = "confirmation";
            newState.suggestions = response.suggestions;
          } else {
            response = getDefaultResponse(newState);
          }
        } else {
          response = getDefaultResponse(newState);
        }
      } else {
        response = getDefaultResponse(newState);
      }
      break;
    }

    case "confirmation": {
      const confirmation = detectConfirmation(userInput);

      if (confirmation === "confirm") {
        if (newState.currentScenario) {
          const scenario = getScenarioByType(newState.currentScenario);
          if (scenario) {
            const step = scenario.steps.find((s) => s.stage === "success");
            if (step) {
              response = step.getMessage(newState, userInput);
              newState.currentStage = "success";
              newState.suggestions = response.suggestions;
            } else {
              response = getSuccessResponse(newState);
            }
          } else {
            response = getSuccessResponse(newState);
          }
        } else {
          response = getSuccessResponse(newState);
        }
      } else if (confirmation === "change") {
        newState.currentStage = "time_selection";
        newState.selectedTime = null;
        response = {
          message: "No problem! Here are other available times:",
          nextStage: "time_selection",
          suggestions: [
            { id: "t1", text: "Tomorrow 9:00 AM" },
            { id: "t2", text: "Tomorrow 2:00 PM" },
            { id: "t3", text: "Thursday 10:00 AM" },
          ],
        };
      } else {
        // Cancel - reset to welcome
        newState = createInitialState();
        response = {
          message: "No problem! Let me know whenever you need help with your vehicle.",
          nextStage: "welcome",
          suggestions: WELCOME_SUGGESTIONS,
        };
      }
      break;
    }

    case "success": {
      // Start a new conversation
      newState = createInitialState();
      response = {
        message: "Is there anything else I can help you with?",
        nextStage: "welcome",
        suggestions: WELCOME_SUGGESTIONS,
      };
      break;
    }

    default:
      response = getDefaultResponse(newState);
  }

  newState.isProcessing = false;

  return { newState, response };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getDefaultResponse(state: ConversationState): ScenarioResponse {
  return {
    message:
      "I'd be happy to help! Tell me about what's going on with your vehicle, or choose one of the common issues below.",
    nextStage: "welcome",
    suggestions: WELCOME_SUGGESTIONS,
  };
}

function getSuccessResponse(state: ConversationState): ScenarioResponse {
  const shopName = state.selectedShop?.name || "the shop";
  const time = state.selectedTime?.displayText || "your appointment";

  return {
    message: `✅ **Booked!** ${time} at ${shopName}. I'll remind you an hour before.`,
    nextStage: "success",
    suggestions: [],
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export { WELCOME_SUGGESTIONS } from "./scenarios";
