/**
 * AI Chat API Service
 * Handles communication with the RepairConnect AI
 * 
 * Uses FREE and OPEN-SOURCE models via Hugging Face
 * No paid API keys required!
 */

import type {
  ChatRequest,
  ChatResponse,
  Conversation,
  ConversationsResponse,
  SuggestionsResponse,
  UserResponse,
  MechanicsResponse,
  SearchMechanicsRequest,
  BookAppointmentRequest,
  BookingResponse,
  User,
  Vehicle,
  SuggestionTile,
  MessageSection,
  FunctionCall,
} from '../types/ai.types';
import { sendToHuggingFace, getFallbackResponse } from './huggingface';

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';
const DEMO_USER_ID = 'user_demo';

// Use Hugging Face (free) instead of OpenAI/Anthropic (paid)
const USE_HUGGING_FACE = true;

// ============================================================================
// DEMO DATA (for development without backend)
// ============================================================================

const demoUser: User = {
  id: 'user_demo',
  first_name: 'Alex',
  last_name: 'Johnson',
  email: 'alex.johnson@email.com',
  location: { city: 'San Francisco', state: 'CA', zip_code: '94102' },
};

const demoVehicle: Vehicle = {
  id: 'vehicle_001',
  make: 'Honda',
  model: 'Civic',
  year: 2019,
  mileage: 67500,
  vin: '2HGFC2F59KH123456',
  engine_type: '2.0L 4-Cylinder',
  transmission: 'CVT Automatic',
};

const demoSuggestions: SuggestionTile[] = [
  { id: '1', text: 'Why is my car making noise?', category: 'diagnostics' },
  { id: '2', text: 'When should I get an oil change?', category: 'maintenance' },
  { id: '3', text: 'How do I check my brake pads?', category: 'diagnostics' },
  { id: '4', text: 'What maintenance is due at 67,500 miles?', category: 'maintenance' },
];

const demoConversations: Conversation[] = [
  {
    id: 'conv_1',
    title: 'Brake noise diagnosis',
    preview: 'My brakes are squeaking...',
    timestamp: new Date().toISOString(),
    messages: [
      {
        id: 'msg_1',
        role: 'user',
        content: 'My brakes are making a squeaking noise',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'msg_2',
        role: 'assistant',
        content: "I understand you're experiencing issues with your brakes. Let me help diagnose this.",
        timestamp: new Date().toISOString(),
        sections: [
          {
            title: 'Initial Assessment',
            content: 'Based on your 2019 Honda Civic with 67,500 miles, brake squeaking is commonly caused by worn pads.',
            type: 'text',
          },
          {
            title: 'Possible Causes',
            content: '',
            type: 'list',
            items: [
              'Worn brake pads (most common at this mileage)',
              'Glazed brake rotors',
              'Dust or debris between pad and rotor',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'conv_2',
    title: 'Oil change schedule',
    preview: 'When should I get an oil change?',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    messages: [],
  },
  {
    id: 'conv_3',
    title: 'Check engine light',
    preview: 'My check engine light is on',
    timestamp: new Date(Date.now() - 604800000).toISOString(),
    messages: [],
  },
];

// AI Response Templates
const aiResponses: Record<string, ChatResponse> = {
  brakes: {
    message: "I understand you're experiencing issues with your brakes. Let me help diagnose this.",
    sections: [
      {
        title: 'Initial Assessment',
        content: 'Based on your description of brake issues on your 2019 Honda Civic with 67,500 miles, this is a common concern that typically indicates worn brake pads.',
        type: 'text',
      },
      {
        title: 'Possible Causes',
        content: '',
        type: 'list',
        items: [
          'Worn brake pads (most common at this mileage)',
          'Glazed brake rotors',
          'Dust or debris between pad and rotor',
          'Moisture on brake components',
        ],
      },
    ],
    function_call: {
      name: 'provide_diagnosis',
      arguments: {
        diagnosis: 'Worn brake pads',
        confidence: 0.85,
        urgency: 'soon',
        estimated_cost_min: 150,
        estimated_cost_max: 300,
        recommended_services: ['Brake pad replacement', 'Rotor inspection'],
      },
    },
  },
  noise: {
    message: "Car noises can indicate various issues. Let me ask a few questions to help narrow it down.",
    sections: [
      {
        title: 'Diagnostic Questions',
        content: 'To better diagnose the noise:',
        type: 'list',
        items: [
          'When does the noise occur? (starting, braking, turning, accelerating)',
          'What type of noise is it? (squeaking, grinding, clicking, humming)',
          'Where does the noise seem to come from?',
          'Is it constant or intermittent?',
        ],
      },
    ],
  },
  oil: {
    message: "Based on your 2019 Honda Civic with 67,500 miles, here's my recommendation for oil changes.",
    sections: [
      {
        title: 'Oil Change Schedule',
        content: 'Honda recommends oil changes every 5,000-7,500 miles for your Civic with synthetic oil.',
        type: 'text',
      },
      {
        title: 'Your Vehicle Status',
        content: '',
        type: 'list',
        items: [
          'Current mileage: 67,500 miles',
          'Recommended next oil change: Around 70,000-72,500 miles',
          'Use 0W-20 full synthetic oil',
          'Oil filter should be replaced with each change',
        ],
      },
    ],
  },
  maintenance: {
    message: "At 67,500 miles, your 2019 Honda Civic has several maintenance items that may be due.",
    sections: [
      {
        title: 'Recommended Maintenance',
        content: '',
        type: 'list',
        items: [
          'Brake fluid flush (every 3 years/45,000 miles)',
          'Transmission fluid change (if not done at 60,000)',
          'Spark plug inspection',
          'Air filter replacement',
          'Cabin air filter replacement',
          'Tire rotation and alignment check',
        ],
      },
      {
        title: 'Priority Items',
        content: 'Based on typical wear patterns, I recommend prioritizing brake inspection and fluid services.',
        type: 'text',
      },
    ],
  },
  default: {
    message: "I'd be happy to help diagnose your vehicle issue. Could you provide more details about what you're experiencing?",
    sections: [
      {
        title: 'Helpful Information',
        content: 'To give you the best diagnosis, please describe:',
        type: 'list',
        items: [
          'What symptoms are you noticing?',
          'When does the issue occur?',
          'How long has this been happening?',
          'Any warning lights on your dashboard?',
        ],
      },
    ],
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateDemoResponse(message: string): ChatResponse {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('brake') || lowerMessage.includes('squeak')) {
    return aiResponses.brakes;
  } else if (lowerMessage.includes('noise') || lowerMessage.includes('sound')) {
    return aiResponses.noise;
  } else if (lowerMessage.includes('oil') || lowerMessage.includes('change')) {
    return aiResponses.oil;
  } else if (lowerMessage.includes('maintenance') || lowerMessage.includes('miles') || lowerMessage.includes('due')) {
    return aiResponses.maintenance;
  } else {
    return aiResponses.default;
  }
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Send a message to the AI and get a response
 * Uses FREE Hugging Face models instead of paid APIs
 */
export async function sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
  // Build vehicle info string for context
  const vehicleInfo = demoVehicle
    ? `${demoVehicle.year} ${demoVehicle.make} ${demoVehicle.model}, ${demoVehicle.mileage.toLocaleString()} miles`
    : undefined;

  // Option 1: Use Hugging Face (FREE, open-source)
  if (USE_HUGGING_FACE) {
    try {
      console.log('Using Hugging Face (free, open-source)...');
      const response = await sendToHuggingFace(
        request.message,
        request.conversation_history,
        vehicleInfo
      );
      return response;
    } catch (error) {
      console.log('Hugging Face unavailable, using rule-based fallback...');
      return getFallbackResponse(request.message);
    }
  }

  // Option 2: Use backend API (if deployed)
  try {
    const response = await fetch(`${API_BASE_URL}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.log('Using rule-based fallback (backend not available)');
    return getFallbackResponse(request.message);
  }
}

/**
 * Get user data including vehicle and service history
 */
export async function getUserData(userId: string = DEMO_USER_ID): Promise<UserResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/users/${userId}`);

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.log('Using demo user data (backend not available)');
    return {
      user: demoUser,
      vehicle: demoVehicle,
      service_history: [],
    };
  }
}

/**
 * Get personalized suggestions for the user
 */
export async function getSuggestions(userId: string = DEMO_USER_ID): Promise<SuggestionsResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/users/${userId}/suggestions`);

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.log('Using demo suggestions (backend not available)');
    return {
      suggestions: demoSuggestions,
      greeting: `Hello, ${demoUser.first_name}`,
    };
  }
}

/**
 * Get conversation history
 */
export async function getConversations(userId: string = DEMO_USER_ID): Promise<ConversationsResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/ai/conversations?user_id=${userId}`);

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.log('Using demo conversations (backend not available)');
    return {
      conversations: demoConversations,
    };
  }
}

/**
 * Get a specific conversation by ID
 */
export async function getConversation(conversationId: string): Promise<Conversation | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/ai/conversations/${conversationId}`);

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.log('Using demo conversation (backend not available)');
    return demoConversations.find((c) => c.id === conversationId) || null;
  }
}

/**
 * Search for mechanics
 */
export async function searchMechanics(request: SearchMechanicsRequest): Promise<MechanicsResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/mechanics/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.log('Using demo mechanics (backend not available)');
    return {
      mechanics: [
        {
          id: 'mech_001',
          name: 'AutoCare Pro',
          address: '123 Main St, San Francisco, CA',
          rating: 4.8,
          review_count: 234,
          distance: 1.2,
          availability: 'Today',
          specialties: ['Brakes', 'Engine', 'Transmission'],
          price_range: '$$',
        },
        {
          id: 'mech_002',
          name: 'Honda Specialist',
          address: '456 Oak Ave, San Francisco, CA',
          rating: 4.9,
          review_count: 189,
          distance: 2.5,
          availability: 'Tomorrow',
          specialties: ['Honda', 'Toyota', 'Asian Vehicles'],
          price_range: '$$$',
        },
      ],
      total_count: 2,
    };
  }
}

/**
 * Book an appointment with a mechanic
 */
export async function bookAppointment(request: BookAppointmentRequest): Promise<BookingResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/mechanics/book`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.log('Using demo booking response (backend not available)');
    return {
      booking_id: `booking_${Date.now()}`,
      status: 'confirmed',
      mechanic: {
        id: request.mechanic_id,
        name: 'AutoCare Pro',
        address: '123 Main St, San Francisco, CA',
        rating: 4.8,
        review_count: 234,
        distance: 1.2,
        availability: 'Today',
        specialties: ['Brakes', 'Engine'],
        price_range: '$$',
      },
      scheduled_date: new Date(Date.now() + 86400000).toISOString(),
      estimated_cost: {
        min: 150,
        max: 300,
      },
    };
  }
}

// Export demo data for testing
export { demoUser, demoVehicle, demoSuggestions, demoConversations };

