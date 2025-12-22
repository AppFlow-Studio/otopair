/**
 * Hugging Face Inference API Service
 * Free and open-source AI model integration
 * 
 * Uses Hugging Face's free inference API with open-source models:
 * - Mistral-7B-Instruct (recommended)
 * - Zephyr-7B
 * - Falcon-7B
 * 
 * Free tier: ~30,000 requests/month
 * No API key required for public models (rate limited)
 * Optional: Add HF_TOKEN for higher limits
 */

import type { ChatMessage, ChatResponse, MessageSection, FunctionCall } from '../types/ai.types';

// ============================================================================
// CONFIGURATION
// ============================================================================

// Hugging Face API endpoint
const HF_API_URL = 'https://api-inference.huggingface.co/models';

// Open-source models (free to use)
const MODELS = {
  // Best for instruction following
  mistral: 'mistralai/Mistral-7B-Instruct-v0.2',
  // Good alternative
  zephyr: 'HuggingFaceH4/zephyr-7b-beta',
  // Smaller, faster
  phi: 'microsoft/phi-2',
  // Fallback
  flan: 'google/flan-t5-large',
} as const;

// Default model
const DEFAULT_MODEL = MODELS.mistral;

// Optional: Hugging Face token for higher rate limits (can be empty for free tier)
const HF_TOKEN = process.env.EXPO_PUBLIC_HF_TOKEN || '';

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

const SYSTEM_PROMPT = `You are RepairConnect AI, an automotive diagnostic assistant. Your role is to help vehicle owners diagnose car issues and guide them to book mechanic appointments.

RULES:
1. Ask 2-3 clarifying questions before providing a diagnosis
2. Reference the user's vehicle information when provided
3. Classify urgency as: IMMEDIATE (safety), SOON (this week), or ROUTINE (can wait)
4. Provide estimated cost ranges when possible
5. Always recommend booking a professional mechanic - never suggest DIY repairs
6. Be concise but helpful

RESPONSE FORMAT:
- Start with a brief acknowledgment
- Ask diagnostic questions OR provide diagnosis
- Include sections like "Possible Causes", "Recommendation", "Estimated Cost" when relevant
- End with a call to action (book mechanic or answer questions)

Current vehicle: {vehicle_info}`;

// ============================================================================
// TYPES
// ============================================================================

interface HFResponse {
  generated_text?: string;
  error?: string;
}

interface DiagnosisResult {
  diagnosis: string;
  confidence: number;
  urgency: 'immediate' | 'soon' | 'routine';
  estimatedCostMin?: number;
  estimatedCostMax?: number;
  recommendedServices: string[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build the prompt for the model
 */
function buildPrompt(
  message: string,
  conversationHistory: ChatMessage[],
  vehicleInfo?: string
): string {
  const systemPrompt = SYSTEM_PROMPT.replace(
    '{vehicle_info}',
    vehicleInfo || 'Not provided'
  );

  // Build conversation context (last 6 messages to stay within token limits)
  const recentHistory = conversationHistory.slice(-6);
  const historyText = recentHistory
    .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
    .join('\n');

  // Format for Mistral-style instruction
  return `<s>[INST] ${systemPrompt}

${historyText ? `Previous conversation:\n${historyText}\n\n` : ''}User: ${message} [/INST]`;
}

/**
 * Parse AI response to extract structured sections
 */
function parseResponse(text: string): { message: string; sections: MessageSection[] } {
  const sections: MessageSection[] = [];
  let cleanMessage = text.trim();

  // Extract sections marked with headers (e.g., "**Possible Causes:**")
  const sectionPatterns = [
    { pattern: /\*\*Possible Causes?\*\*:?\s*([\s\S]*?)(?=\*\*|$)/gi, title: 'Possible Causes' },
    { pattern: /\*\*Recommendation\*\*:?\s*([\s\S]*?)(?=\*\*|$)/gi, title: 'Recommendation' },
    { pattern: /\*\*Estimated Cost\*\*:?\s*([\s\S]*?)(?=\*\*|$)/gi, title: 'Estimated Cost' },
    { pattern: /\*\*Urgency\*\*:?\s*([\s\S]*?)(?=\*\*|$)/gi, title: 'Urgency' },
    { pattern: /\*\*Next Steps?\*\*:?\s*([\s\S]*?)(?=\*\*|$)/gi, title: 'Next Steps' },
  ];

  for (const { pattern, title } of sectionPatterns) {
    const match = pattern.exec(text);
    if (match && match[1]) {
      const content = match[1].trim();
      
      // Check if content is a list
      const listItems = content
        .split(/[\n•\-\*]/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

      if (listItems.length > 1) {
        sections.push({
          title,
          content: '',
          type: 'list',
          items: listItems,
        });
      } else {
        sections.push({
          title,
          content,
          type: 'text',
        });
      }

      // Remove section from main message
      cleanMessage = cleanMessage.replace(match[0], '').trim();
    }
  }

  // Clean up the message
  cleanMessage = cleanMessage
    .replace(/\*\*/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // If no clean message, use original
  if (!cleanMessage) {
    cleanMessage = text.replace(/\*\*/g, '').trim();
  }

  return { message: cleanMessage, sections };
}

/**
 * Analyze response for diagnosis patterns
 */
function extractDiagnosis(text: string): DiagnosisResult | null {
  const lowerText = text.toLowerCase();

  // Check for diagnosis indicators
  const hasDiagnosis =
    lowerText.includes('diagnosis') ||
    lowerText.includes('likely') ||
    lowerText.includes('appears to be') ||
    lowerText.includes('suggesting') ||
    lowerText.includes('indicates');

  if (!hasDiagnosis) return null;

  // Extract urgency
  let urgency: 'immediate' | 'soon' | 'routine' = 'routine';
  if (lowerText.includes('immediate') || lowerText.includes('safety') || lowerText.includes('dangerous')) {
    urgency = 'immediate';
  } else if (lowerText.includes('soon') || lowerText.includes('this week') || lowerText.includes('promptly')) {
    urgency = 'soon';
  }

  // Extract cost if mentioned
  let estimatedCostMin: number | undefined;
  let estimatedCostMax: number | undefined;
  const costMatch = text.match(/\$(\d+)\s*[-–to]+\s*\$?(\d+)/);
  if (costMatch) {
    estimatedCostMin = parseInt(costMatch[1], 10);
    estimatedCostMax = parseInt(costMatch[2], 10);
  }

  // Extract diagnosis name
  let diagnosis = 'Vehicle inspection recommended';
  const diagnosisPatterns = [
    /(?:diagnosis|likely|appears to be|suggesting|indicates)[:\s]+([^.]+)/i,
    /(?:worn|faulty|damaged|failing)\s+([^.]+)/i,
  ];
  for (const pattern of diagnosisPatterns) {
    const match = text.match(pattern);
    if (match) {
      diagnosis = match[1].trim().substring(0, 50);
      break;
    }
  }

  return {
    diagnosis,
    confidence: 0.75,
    urgency,
    estimatedCostMin,
    estimatedCostMax,
    recommendedServices: [diagnosis],
  };
}

// ============================================================================
// MAIN API FUNCTION
// ============================================================================

/**
 * Send a message to the Hugging Face model
 */
export async function sendToHuggingFace(
  message: string,
  conversationHistory: ChatMessage[],
  vehicleInfo?: string,
  model: string = DEFAULT_MODEL
): Promise<ChatResponse> {
  const prompt = buildPrompt(message, conversationHistory, vehicleInfo);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add token if available (for higher rate limits)
  if (HF_TOKEN) {
    headers['Authorization'] = `Bearer ${HF_TOKEN}`;
  }

  try {
    const response = await fetch(`${HF_API_URL}/${model}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 500,
          temperature: 0.7,
          top_p: 0.9,
          do_sample: true,
          return_full_text: false,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      
      // Handle model loading (common with free tier)
      if (error.error?.includes('loading')) {
        console.log('Model is loading, using fallback...');
        return getFallbackResponse(message);
      }
      
      throw new Error(error.error || `API error: ${response.status}`);
    }

    const data: HFResponse[] = await response.json();
    const generatedText = data[0]?.generated_text || '';

    if (!generatedText) {
      return getFallbackResponse(message);
    }

    // Parse the response
    const { message: cleanMessage, sections } = parseResponse(generatedText);

    // Check for diagnosis
    const diagnosis = extractDiagnosis(generatedText);
    let functionCall: FunctionCall | undefined;

    if (diagnosis) {
      functionCall = {
        name: 'provide_diagnosis',
        arguments: {
          diagnosis: diagnosis.diagnosis,
          confidence: diagnosis.confidence,
          urgency: diagnosis.urgency,
          estimated_cost_min: diagnosis.estimatedCostMin,
          estimated_cost_max: diagnosis.estimatedCostMax,
          recommended_services: diagnosis.recommendedServices,
        },
      };
    }

    return {
      message: cleanMessage,
      sections: sections.length > 0 ? sections : undefined,
      function_call: functionCall,
    };
  } catch (error) {
    console.error('Hugging Face API error:', error);
    return getFallbackResponse(message);
  }
}

// ============================================================================
// RULE-BASED FALLBACK SYSTEM
// ============================================================================

/**
 * Fallback responses when API is unavailable
 * Uses pattern matching for common automotive issues
 */
function getFallbackResponse(message: string): ChatResponse {
  const lowerMessage = message.toLowerCase();

  // Brake-related issues
  if (lowerMessage.includes('brake') || lowerMessage.includes('squeak') || lowerMessage.includes('grinding')) {
    return {
      message: "I understand you're experiencing brake-related symptoms. This is a common concern that should be addressed promptly.",
      sections: [
        {
          title: 'Possible Causes',
          content: '',
          type: 'list',
          items: [
            'Worn brake pads (most common)',
            'Glazed or damaged rotors',
            'Brake caliper issues',
            'Dust or debris buildup',
          ],
        },
        {
          title: 'Recommendation',
          content: 'Brake issues can affect your safety. I recommend having a professional mechanic inspect your brakes soon.',
          type: 'text',
        },
      ],
      function_call: {
        name: 'provide_diagnosis',
        arguments: {
          diagnosis: 'Brake system inspection needed',
          confidence: 0.8,
          urgency: 'soon',
          estimated_cost_min: 100,
          estimated_cost_max: 350,
          recommended_services: ['Brake inspection', 'Brake pad replacement'],
        },
      },
    };
  }

  // Oil change / maintenance
  if (lowerMessage.includes('oil') || lowerMessage.includes('change') || lowerMessage.includes('maintenance')) {
    return {
      message: "Oil changes are essential for your engine's health. Let me help you understand your maintenance schedule.",
      sections: [
        {
          title: 'Oil Change Guidelines',
          content: '',
          type: 'list',
          items: [
            'Synthetic oil: Every 7,500-10,000 miles',
            'Conventional oil: Every 3,000-5,000 miles',
            'Check your owner\'s manual for specific recommendations',
          ],
        },
        {
          title: 'Signs You Need an Oil Change',
          content: '',
          type: 'list',
          items: [
            'Oil change light illuminated',
            'Dark, dirty oil on dipstick',
            'Engine running louder than usual',
            'Decreased fuel efficiency',
          ],
        },
      ],
    };
  }

  // Engine noise
  if (lowerMessage.includes('noise') || lowerMessage.includes('sound') || lowerMessage.includes('knocking')) {
    return {
      message: "Engine noises can indicate various issues. To help diagnose this, I need a bit more information.",
      sections: [
        {
          title: 'Diagnostic Questions',
          content: '',
          type: 'list',
          items: [
            'When does the noise occur? (startup, acceleration, idling)',
            'What type of noise? (clicking, grinding, knocking, squealing)',
            'Where does it seem to come from? (front, rear, engine bay)',
            'Does it change with engine speed?',
          ],
        },
      ],
    };
  }

  // Check engine light
  if (lowerMessage.includes('check engine') || lowerMessage.includes('warning light') || lowerMessage.includes('dashboard')) {
    return {
      message: "A check engine light indicates your vehicle's computer has detected an issue. Here's what you should know:",
      sections: [
        {
          title: 'Common Causes',
          content: '',
          type: 'list',
          items: [
            'Loose gas cap (easy fix!)',
            'Oxygen sensor issue',
            'Catalytic converter problems',
            'Mass airflow sensor',
            'Spark plug/ignition issues',
          ],
        },
        {
          title: 'Recommendation',
          content: 'I recommend getting a diagnostic scan to read the error codes. Many auto parts stores offer free scans, or a mechanic can provide detailed analysis.',
          type: 'text',
        },
      ],
    };
  }

  // Battery / electrical
  if (lowerMessage.includes('battery') || lowerMessage.includes('start') || lowerMessage.includes('electrical')) {
    return {
      message: "Starting or electrical issues can stem from several causes. Let me help narrow it down.",
      sections: [
        {
          title: 'Possible Causes',
          content: '',
          type: 'list',
          items: [
            'Dead or weak battery',
            'Corroded battery terminals',
            'Faulty starter motor',
            'Alternator issues',
            'Ignition switch problems',
          ],
        },
        {
          title: 'Quick Checks',
          content: 'Try checking if interior lights work dimly (weak battery) or if you hear clicking when turning the key (starter issue).',
          type: 'text',
        },
      ],
    };
  }

  // Default response
  return {
    message: "I'd be happy to help diagnose your vehicle issue. To provide the best assistance, could you describe what you're experiencing in more detail?",
    sections: [
      {
        title: 'Helpful Details to Include',
        content: '',
        type: 'list',
        items: [
          'What symptoms are you noticing?',
          'When does the issue occur?',
          'How long has this been happening?',
          'Any warning lights on your dashboard?',
          'Any recent changes or repairs?',
        ],
      },
    ],
  };
}

// Export for testing
export { getFallbackResponse, MODELS };

