/**
 * Intent Analyzer Service - Unified Tool Selection + Model Routing
 * 
 * Uses @librechat/intent-analyzer for:
 * 1. autoToolSelection - Smart tool selection based on query intent
 * 2. modelRouting - 5-Tier automatic model routing based on complexity
 * 
 * Model Tiers (when modelRouting is enabled):
 *   TRIVIAL  (0.00-0.15): Nova Lite   - Greetings, yes/no, acknowledgments (multimodal)
 *   SIMPLE   (0.15-0.35): Nova Pro    - Basic Q&A, simple tools
 *   MODERATE (0.35-0.60): Haiku 4.5   - Explanations, standard coding
 *   COMPLEX  (0.60-0.80): Sonnet 4.5  - Debugging, detailed analysis
 *   EXPERT   (0.80-1.00): Opus 4.5    - System design, complex algorithms
 * 
 * Note: Nova Micro is only used for classifierModel (internal routing) - NOT for user-facing responses.
 * 
 * LLM Fallback:
 *   When regex patterns don't match confidently, the system falls back to
 *   using Nova Micro ($0.035/$0.14 per 1M tokens) as a classifier to understand
 *   user intent. This ensures accurate tool/model selection for ambiguous queries.
 * 
 * Configuration is loaded from librechat.yaml under the `intentAnalyzer` key.
 */

const { logger } = require('@librechat/data-schemas');
const { EModelEndpoint } = require('librechat-data-provider');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

// Lazy-loaded intent analyzer module
let intentAnalyzer = null;

// Lazy-loaded Bedrock client for LLM classification
let bedrockClient = null;

/**
 * Get or create Bedrock client for LLM classification
 */
function getBedrockClient() {
  if (!bedrockClient) {
    bedrockClient = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }
  return bedrockClient;
}

/**
 * LLM Fallback function - calls Nova Micro for classification
 * This is used when regex patterns don't match confidently
 * 
 * @param {string} prompt - The classification prompt
 * @returns {Promise<string>} The LLM response
 */
async function llmClassifierFallback(prompt) {
  const client = getBedrockClient();
  const classifierModel = 'us.amazon.nova-micro-v1:0';
  
  try {
    logger.info('[IntentAnalyzer] Using LLM classifier (Nova Micro) for ambiguous query');
    
    const command = new InvokeModelCommand({
      modelId: classifierModel,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: [{ text: prompt }],
          },
        ],
        inferenceConfig: {
          maxTokens: 500,
          temperature: 0.1, // Low temperature for consistent classification
        },
      }),
    });
    
    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    // Extract text from Nova response format
    const text = responseBody.output?.message?.content?.[0]?.text || '';
    
    logger.info(`[IntentAnalyzer] LLM classifier response: ${text.substring(0, 200)}...`);
    
    return text;
  } catch (error) {
    logger.error('[IntentAnalyzer] LLM classifier fallback failed:', error.message);
    return ''; // Return empty string on failure, will fall back to regex result
  }
}

// 5-Tier Model pricing (per 1M tokens) - matches intent-analyzer bedrock.ts
const MODEL_PRICING = {
  // EXPERT tier - System design, complex algorithms
  'global.anthropic.claude-opus-4-5-20251101-v1:0': { input: 5.00, output: 25.00, tier: 'expert' },
  // COMPLEX tier - Debugging, detailed analysis
  'us.anthropic.claude-sonnet-4-5-20250929-v1:0': { input: 3.00, output: 15.00, tier: 'complex' },
  // MODERATE tier - Explanations, standard coding
  'us.anthropic.claude-haiku-4-5-20251001-v1:0': { input: 1.00, output: 5.00, tier: 'moderate' },
  // SIMPLE tier - Basic Q&A, simple tools
  'us.amazon.nova-pro-v1:0': { input: 0.80, output: 3.20, tier: 'simple' },
  // TRIVIAL tier - Greetings, yes/no, acknowledgments (multimodal)
  'us.amazon.nova-lite-v1:0': { input: 0.06, output: 0.24, tier: 'trivial' },
  // CLASSIFIER - Used for LLM classification fallback only (NOT for routing)
  'us.amazon.nova-micro-v1:0': { input: 0.035, output: 0.14, tier: 'classifier' },
};

/**
 * Default intent analyzer configuration
 */
const DEFAULT_CONFIG = {
  autoToolSelection: false,
  modelRouting: false,
  preset: 'costOptimized',
  debug: false,
  classifierModel: 'us.amazon.nova-micro-v1:0',
  endpoints: {
    [EModelEndpoint.bedrock]: {
      enabled: false,
    },
  },
};

/**
 * Lazy load the intent-analyzer module
 */
async function getIntentAnalyzer() {
  if (!intentAnalyzer) {
    try {
      intentAnalyzer = await import('@librechat/intent-analyzer');
      logger.info('[IntentAnalyzer] Loaded @librechat/intent-analyzer module');
    } catch (error) {
      logger.error('[IntentAnalyzer] Failed to load @librechat/intent-analyzer:', error.message);
      throw error;
    }
  }
  return intentAnalyzer;
}

/**
 * Get intent analyzer configuration from app config
 * @param {object} appConfig - Application configuration
 * @param {string} endpoint - The endpoint type
 * @returns {object} Intent analyzer configuration for the endpoint
 */
function getIntentAnalyzerConfig(appConfig, endpoint) {
  const globalConfig = appConfig?.intentAnalyzer || DEFAULT_CONFIG;
  const endpointConfig = globalConfig.endpoints?.[endpoint] || {};
  
  // Check if endpoint is enabled
  if (!endpointConfig.enabled) {
    return { 
      autoToolSelection: false, 
      modelRouting: false,
      enabled: false,
    };
  }
  
  return {
    enabled: true,
    autoToolSelection: globalConfig.autoToolSelection ?? false,
    modelRouting: globalConfig.modelRouting ?? false,
    preset: globalConfig.preset ?? 'costOptimized',
    debug: globalConfig.debug ?? false,
    classifierModel: endpointConfig.classifierModel ?? globalConfig.classifierModel ?? 'us.amazon.nova-micro-v1:0',
  };
}

/**
 * Route a request to the optimal model based on prompt complexity (5-tier)
 * 
 * NOTE: This is for NON-AGENTS endpoints only. Agents endpoint does routing
 * in loadEphemeralAgent AFTER tool selection (so artifacts can elevate tier).
 * 
 * @param {object} params - Routing parameters
 * @param {string} params.endpoint - The endpoint type (bedrock, openAI, etc.)
 * @param {string} params.prompt - The user's prompt/message
 * @param {string} params.currentModel - The currently selected model
 * @param {string} [params.userId] - Optional user ID for logging
 * @param {object} [params.appConfig] - Application configuration (from req.config)
 * @param {Array<{role: string, content: string}>} [params.conversationHistory] - Recent conversation messages for context
 * @returns {Promise<string|null>} The routed model ID, or null if no routing needed
 */
async function routeModel({ endpoint, prompt, currentModel, userId, appConfig, conversationHistory = [] }) {
  // Get configuration from intentAnalyzer
  const config = getIntentAnalyzerConfig(appConfig || global.appConfig, endpoint);
  const debug = config.debug;
  
  if (debug) {
    logger.info('[IntentAnalyzer] ========== ROUTING REQUEST ==========');
    logger.info('[IntentAnalyzer] Configuration:', {
      enabled: config.enabled,
      autoToolSelection: config.autoToolSelection,
      modelRouting: config.modelRouting,
      preset: config.preset,
      classifierModel: config.classifierModel,
      endpoint,
    });
  }
  
  // Check if model routing is enabled
  if (!config.enabled || !config.modelRouting) {
    if (debug) logger.info('[IntentAnalyzer] Model routing DISABLED - using default model');
    return null;
  }
  
  // Skip routing if no prompt
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    if (debug) logger.info('[IntentAnalyzer] No prompt provided - skipping routing');
    return null;
  }
  
  try {
    const analyzer = await getIntentAnalyzer();
    
    // Map endpoint to provider
    const providerMap = {
      [EModelEndpoint.bedrock]: 'bedrock',
      [EModelEndpoint.openAI]: 'openai',
      [EModelEndpoint.anthropic]: 'anthropic',
    };
    const provider = providerMap[endpoint] || 'bedrock';
    
    // Estimate input tokens (rough: ~4 chars per token)
    const estimatedInputTokens = Math.ceil(prompt.length / 4);
    
    // Route the prompt using unified analyzer
    // For non-agents endpoints: no tool selection, just model tier routing
    const startTime = Date.now();
    const result = await analyzer.routeQuery(prompt, {
      provider,
      preset: config.preset,
      availableTools: [], // No tools for non-agents endpoints
      conversationHistory: conversationHistory.slice(-5), // Last 5 messages for context
      fallbackThreshold: 0.4,
    });
    const routingTimeMs = Date.now() - startTime;
    
    // Get pricing for both models
    const routedPricing = MODEL_PRICING[result.model] || { input: 0, output: 0, tier: 'unknown' };
    const currentPricing = MODEL_PRICING[currentModel] || { input: 0, output: 0, tier: 'unknown' };
    
    // Calculate estimated costs (assuming 500 output tokens for estimation)
    const estimatedOutputTokens = 500;
    const routedInputCost = (estimatedInputTokens / 1_000_000) * routedPricing.input;
    const routedOutputCost = (estimatedOutputTokens / 1_000_000) * routedPricing.output;
    const routedTotalCost = routedInputCost + routedOutputCost;
    
    const currentInputCost = (estimatedInputTokens / 1_000_000) * currentPricing.input;
    const currentOutputCost = (estimatedOutputTokens / 1_000_000) * currentPricing.output;
    const currentTotalCost = currentInputCost + currentOutputCost;
    
    const costSavings = currentTotalCost - routedTotalCost;
    const costSavingsPercent = currentTotalCost > 0 ? ((costSavings / currentTotalCost) * 100).toFixed(1) : 0;
    
    // Get model short names for logging
    const getShortName = (model) => model?.split('.').pop()?.replace('-v1:0', '')?.substring(0, 20) || model;
    
    // 5-Tier logging
    if (debug) {
      logger.info('[IntentAnalyzer] ═══════════════════════════════════════════════════════════');
      logger.info('[IntentAnalyzer] 5-TIER ROUTING DECISION');
      logger.info('[IntentAnalyzer] ───────────────────────────────────────────────────────────');
      logger.info(`[IntentAnalyzer] Prompt: "${prompt.substring(0, 80)}${prompt.length > 80 ? '...' : ''}"`);
      logger.info(`[IntentAnalyzer] Tier: ${result.tier?.toUpperCase()} | Reason: ${result.reason}`);
      logger.info(`[IntentAnalyzer] Tools: ${result.tools?.length > 0 ? result.tools.join(', ') : 'none'}`);
      logger.info(`[IntentAnalyzer] Used LLM Fallback: ${result.usedLlmFallback ? 'YES' : 'NO'}`);
      logger.info('[IntentAnalyzer] ───────────────────────────────────────────────────────────');
      logger.info(`[IntentAnalyzer] Model: ${getShortName(currentModel)} → ${getShortName(result.model)}`);
      logger.info(`[IntentAnalyzer] Changed: ${result.model !== currentModel ? 'YES' : 'NO (same model)'}`);
      logger.info('[IntentAnalyzer] ───────────────────────────────────────────────────────────');
      logger.info(`[IntentAnalyzer] Est. Tokens: ~${estimatedInputTokens} input, ~${estimatedOutputTokens} output`);
      logger.info(`[IntentAnalyzer] Cost: $${routedTotalCost.toFixed(6)} (was $${currentTotalCost.toFixed(6)})`);
      logger.info(`[IntentAnalyzer] Savings: $${costSavings.toFixed(6)} (${costSavingsPercent}%)`);
      logger.info(`[IntentAnalyzer] Routing: ${routingTimeMs}ms`);
      logger.info('[IntentAnalyzer] ═══════════════════════════════════════════════════════════');
    } else {
      // Compact logging when debug is off
      logger.info(`[IntentAnalyzer] ${result.tier?.toUpperCase()} | ${getShortName(result.model)} | Tools: ${result.tools?.length || 0} | LLM: ${result.usedLlmFallback ? 'Y' : 'N'} | Saved: ${costSavingsPercent}%`);
    }
    
    return result.model;
  } catch (error) {
    logger.error('[IntentAnalyzer] Error routing model:', error);
    return null;
  }
}

/**
 * Clear cached modules (for testing)
 */
function clearIntentAnalyzerCache() {
  intentAnalyzer = null;
}

/**
 * Get intent analyzer statistics for monitoring
 * @returns {object} Statistics about intent analyzer usage
 */
function getIntentAnalyzerStats() {
  return {
    moduleLoaded: intentAnalyzer !== null,
  };
}

module.exports = {
  routeModel,
  llmClassifierFallback, // Export for use in Agent.js tool selection
  clearIntentAnalyzerCache,
  getIntentAnalyzerStats,
  getIntentAnalyzerConfig,
  DEFAULT_CONFIG,
};
