/**
 * AI Configuration
 * 
 * RepairConnect AI uses FREE and OPEN-SOURCE models
 * No expensive API keys required!
 * 
 * Options:
 * 1. Hugging Face Inference API (Free tier - 30k requests/month)
 * 2. Rule-based fallback system (100% free, works offline)
 * 3. Self-hosted models (requires your own server)
 */

export const AI_CONFIG = {
  // ============================================================================
  // PROVIDER SELECTION
  // ============================================================================
  
  /**
   * Primary AI provider
   * Options: 'huggingface' | 'rule-based' | 'custom-backend'
   */
  provider: 'huggingface' as const,

  /**
   * Fallback when primary is unavailable
   * Always falls back to rule-based system (100% free)
   */
  fallback: 'rule-based' as const,

  // ============================================================================
  // HUGGING FACE CONFIGURATION (FREE)
  // ============================================================================
  
  huggingface: {
    /**
     * Model to use (all free and open-source)
     * 
     * Recommended:
     * - 'mistralai/Mistral-7B-Instruct-v0.2' - Best quality
     * - 'HuggingFaceH4/zephyr-7b-beta' - Good alternative
     * - 'microsoft/phi-2' - Faster, smaller
     * - 'google/flan-t5-large' - Lightweight fallback
     */
    model: 'mistralai/Mistral-7B-Instruct-v0.2',

    /**
     * Optional: Hugging Face token for higher rate limits
     * Get free token at: https://huggingface.co/settings/tokens
     * Without token: ~100 requests/hour
     * With token: ~30,000 requests/month
     */
    token: process.env.EXPO_PUBLIC_HF_TOKEN || '',

    /**
     * Model parameters
     */
    parameters: {
      maxTokens: 500,
      temperature: 0.7,
      topP: 0.9,
    },
  },

  // ============================================================================
  // RULE-BASED SYSTEM (100% FREE, WORKS OFFLINE)
  // ============================================================================
  
  ruleBased: {
    /**
     * Enable rule-based responses as fallback
     * This ensures the app ALWAYS works, even without internet
     */
    enabled: true,

    /**
     * Confidence threshold for rule-based responses
     */
    confidenceThreshold: 0.7,
  },

  // ============================================================================
  // FUTURE: SELF-HOSTED OPTIONS
  // ============================================================================
  
  // If you want to self-host (more control, 100% free after setup):
  // 
  // Option 1: Ollama (local)
  // - Install: brew install ollama
  // - Run: ollama run mistral
  // - Endpoint: http://localhost:11434/api/generate
  //
  // Option 2: vLLM (server)
  // - Deploy on your server
  // - Use open models like LLaMA, Mistral, etc.
  //
  // Option 3: text-generation-inference (Docker)
  // - docker run ghcr.io/huggingface/text-generation-inference
  
} as const;

// ============================================================================
// COST COMPARISON
// ============================================================================

/**
 * COST COMPARISON (per 10,000 requests):
 * 
 * | Provider          | Cost      | Notes                    |
 * |-------------------|-----------|--------------------------|
 * | OpenAI GPT-4      | ~$300     | Best quality, expensive  |
 * | OpenAI GPT-3.5    | ~$20      | Good, still costs money  |
 * | Anthropic Claude  | ~$80      | Good, still costs money  |
 * | Hugging Face Free | $0        | Free tier, rate limited  |
 * | Rule-based        | $0        | Always free, offline     |
 * | Self-hosted       | $0*       | Free after server setup  |
 * 
 * * Self-hosted requires server costs (~$20-50/month for a small VPS)
 */

export type AIProvider = 'huggingface' | 'rule-based' | 'custom-backend';

