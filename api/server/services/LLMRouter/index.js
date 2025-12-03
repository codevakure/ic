/**
 * Intent Analyzer Service - Unified Tool Selection + Model Routing
 * 
 * Uses @librechat/intent-analyzer for:
 * 1. autoToolSelection - Smart tool selection based on query intent
 * 2. modelRouting - 4-Tier automatic model routing based on complexity
 * 
 * 4-TIER MODEL SYSTEM (target distribution):
 *   SIMPLE   (~1%)  : Nova Micro  - Greetings, text-only simple responses
 *   MODERATE (~80%) : Haiku 4.5   - Most tasks, tool usage, standard code
 *   COMPLEX  (~15%) : Sonnet 4.5  - Debugging, detailed analysis
 *   EXPERT   (~4%)  : Opus 4.5    - Deep analysis, architecture, research
 * 
 * Routing Rules:
 * - Tool usage → Haiku 4.5 minimum (Claude models handle tools better)
 * - Deep analysis requests → Opus 4.5
 * - Text-only simple queries → Nova Micro allowed
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
 * @returns {Promise<{text: string, usage?: {inputTokens: number, outputTokens: number}}>} The LLM response with usage data
 */
async function llmClassifierFallback(prompt) {
  const client = getBedrockClient();
  const classifierModel = 'us.amazon.nova-micro-v1:0';
  
  try {
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
    
    // Extract usage data for cost tracking
    const usage = responseBody.usage ? {
      inputTokens: responseBody.usage.inputTokens || 0,
      outputTokens: responseBody.usage.outputTokens || 0,
    } : undefined;
    
    return { text, usage };
  } catch (error) {
    logger.error('[IntentAnalyzer] LLM classifier failed:', error.message);
    return { text: '' }; // Return empty response on failure, will fall back to regex result
  }
}

// 4-Tier Model pricing (per 1K tokens) - matches AWS Bedrock official pricing
const MODEL_PRICING = {
  // EXPERT tier (~4%) - Deep analysis, architecture, research
  'global.anthropic.claude-opus-4-5-20251101-v1:0': { input: 0.005, output: 0.025, tier: 'expert' },
  // COMPLEX tier (~15%) - Debugging, detailed analysis
  'us.anthropic.claude-sonnet-4-5-20250929-v1:0': { input: 0.003, output: 0.015, tier: 'complex' },
  // MODERATE tier (~80%) - Most tasks, tool usage, standard code
  'us.anthropic.claude-haiku-4-5-20251001-v1:0': { input: 0.001, output: 0.005, tier: 'moderate' },
  // Nova Pro - Multimodal capable
  'us.amazon.nova-pro-v1:0': { input: 0.0008, output: 0.0032, tier: 'moderate' },
  // Nova Lite - Multimodal capable
  'us.amazon.nova-lite-v1:0': { input: 0.00006, output: 0.00024, tier: 'simple' },
  // SIMPLE tier (~1%) - Greetings, text-only simple responses
  'us.amazon.nova-micro-v1:0': { input: 0.000035, output: 0.00014, tier: 'simple' },
  // CLASSIFIER - Used for LLM classification fallback only (same as Nova Micro)
  'classifier': { input: 0.000035, output: 0.00014, tier: 'classifier' },
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
    } catch (error) {
      logger.error('[IntentAnalyzer] Failed to load module:', error.message);
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
  
  // Check if model routing is enabled
  if (!config.enabled || !config.modelRouting) {
    return null;
  }
  
  // Skip routing if no prompt
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
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
    const getShortName = (model) => {
      if (!model) return 'unknown';
      if (model.includes('opus')) return 'Opus';
      if (model.includes('sonnet')) return 'Sonnet';
      if (model.includes('haiku')) return 'Haiku';
      if (model.includes('nova-micro')) return 'Nova-Micro';
      return model.split('.').pop()?.replace('-v1:0', '')?.substring(0, 15) || model;
    };
    
    // Build classifier cost string if LLM was used
    let classifierCostStr = '';
    if (result.usedLlmFallback && result.classifierUsage) {
      const { inputTokens, outputTokens, cost } = result.classifierUsage;
      classifierCostStr = ` | Classifier: ${inputTokens}in/${outputTokens}out=$${cost.toFixed(6)}`;
    }
    
    // Simplified single-line logging
    // Format: [Router] Tools: [...] | Model: X | Method: regex/LLM | In: X | Out: X | Cached: X | Cost: $X
    logger.info(
      `[Router] Tools: [${result.tools?.join(', ') || 'none'}] | ` +
      `Model: ${getShortName(result.model)} | ` +
      `Method: ${result.usedLlmFallback ? 'LLM' : 'regex'} | ` +
      `Est.In: ${estimatedInputTokens} | Est.Out: ${estimatedOutputTokens} | ` +
      `Cost: $${routedTotalCost.toFixed(4)}${classifierCostStr}`
    );
    
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
