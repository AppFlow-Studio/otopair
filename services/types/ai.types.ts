/**
 * AI Chat Types and Interfaces
 * Based on OtoPair AI OpenAPI specification
 */

// ============================================================================
// MESSAGE TYPES
// ============================================================================

export type MessageRole = 'user' | 'assistant' | 'system';

export type Urgency = 'immediate' | 'soon' | 'routine';

export type SectionType = 'text' | 'list' | 'action';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  sections?: MessageSection[];
  functionCall?: FunctionCall;
}

export interface MessageSection {
  title: string;
  content: string;
  type: SectionType;
  items?: string[];
}

// ============================================================================
// FUNCTION CALL TYPES
// ============================================================================

export interface FunctionCallArguments {
  diagnosis?: string;
  confidence?: number;
  urgency?: Urgency;
  estimated_cost_min?: number;
  estimated_cost_max?: number;
  recommended_services?: string[];
  service_type?: string;
}

export interface FunctionCall {
  name: string;
  arguments: FunctionCallArguments;
  result?: Record<string, unknown>;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface ChatRequest {
  message: string;
  conversation_history: ChatMessage[];
  user_id?: string;
}

export interface ChatResponse {
  message: string;
  sections?: MessageSection[];
  function_call?: FunctionCall;
  conversation_id?: string;
}

export interface SuggestionTile {
  id: string;
  text: string;
  category?: string;
}

export interface SuggestionsResponse {
  suggestions: SuggestionTile[];
  greeting: string;
}

// ============================================================================
// CONVERSATION TYPES
// ============================================================================

export interface Conversation {
  id: string;
  title: string;
  preview: string;
  timestamp: string;
  messages: ChatMessage[];
}

export interface ConversationsResponse {
  conversations: Conversation[];
}

// ============================================================================
// USER & VEHICLE TYPES
// ============================================================================

export interface Location {
  city: string;
  state: string;
  zip_code: string;
}

export interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  location: Location;
}

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  mileage: number;
  vin: string;
  engine_type: string;
  transmission: string;
  license_plate?: string;
}

export interface ServiceRecord {
  id: string;
  date: string;
  mileage: number;
  service_type: string;
  description: string;
  shop: string;
  cost: number;
}

export interface UserResponse {
  user: User;
  vehicle: Vehicle;
  service_history: ServiceRecord[];
}

// ============================================================================
// MECHANIC TYPES
// ============================================================================

export interface Mechanic {
  id: string;
  name: string;
  address: string;
  rating: number;
  review_count: number;
  distance: number;
  availability: string;
  specialties: string[];
  price_range: string;
}

export interface SearchMechanicsRequest {
  service_type: string;
  urgency?: Urgency;
  latitude?: number;
  longitude?: number;
  radius_miles?: number;
}

export interface MechanicsResponse {
  mechanics: Mechanic[];
  total_count: number;
}

export interface BookAppointmentRequest {
  mechanic_id: string;
  service_type: string;
  diagnosis: string;
  urgency: Urgency;
  preferred_date?: string;
  notes?: string;
}

export interface BookingResponse {
  booking_id: string;
  status: string;
  mechanic: Mechanic;
  scheduled_date?: string;
  estimated_cost?: {
    min: number;
    max: number;
  };
}

// ============================================================================
// CHAT STORE STATE
// ============================================================================

export interface AIChatState {
  // Messages
  messages: ChatMessage[];
  currentConversationId: string | null;
  
  // Conversations history
  conversations: Conversation[];
  
  // Loading states
  isLoading: boolean;
  isLoadingHistory: boolean;
  
  // User context
  user: User | null;
  vehicle: Vehicle | null;
  suggestions: SuggestionTile[];
  greeting: string;
  
  // Recording state
  isRecording: boolean;
  selectedImage: string | null;
}

export interface AIChatActions {
  // Message actions
  sendMessage: (message: string) => Promise<void>;
  clearMessages: () => void;
  
  // Conversation actions
  loadConversation: (conversationId: string) => Promise<void>;
  loadConversations: () => Promise<void>;
  startNewChat: () => void;
  
  // User context
  loadUserContext: () => Promise<void>;
  loadSuggestions: () => Promise<void>;
  
  // Media actions
  setRecording: (isRecording: boolean) => void;
  setSelectedImage: (imageUri: string | null) => void;
  
  // Reset
  reset: () => void;
}

export type AIChatStore = AIChatState & AIChatActions;

