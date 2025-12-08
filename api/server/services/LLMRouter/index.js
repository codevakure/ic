/**
 * Intent Analyzer Service - Model Routing Only
 * 
 * SIMPLIFIED ARCHITECTURE (v2.0):
 * - Tool selection is now config-driven (handled in Agent.js)
 * - This service only handles model routing for non-agents endpoints
 * 
 * Uses @librechat/intent-analyzer for:
 * - modelRouting - 4-Tier automatic model routing based on complexity
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
 * Configuration is loaded from ranger.yaml under the `intentAnalyzer` key.
 */

const { logger } = require('@librechat/data-schemas');
const { EModelEndpoint } = require('librechat-data-provider');

// Lazy-loaded intent analyzer module
let intentAnalyzer = null;

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
};

/**
 * Default intent analyzer configuration
 * 
 * Tool selection is config-driven via toolsAutoEnabled in ranger.yaml + UI-selected MCP
 * Model routing selects appropriate model tier based on query complexity
 */
const DEFAULT_CONFIG = {
  modelRouting: false,
  preset: 'costOptimized',
  debug: false,
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
 * 
 * NOTE: Only modelRouting is supported. Tool selection is config-driven.
 * 
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
      modelRouting: false,
      enabled: false,
    };
  }
  
  return {
    enabled: true,
    modelRouting: globalConfig.modelRouting ?? false,
    preset: globalConfig.preset ?? 'costOptimized',
    debug: globalConfig.debug ?? false,
  };
}

/**
 * Route a request to the optimal model based on prompt complexity (4-tier)
 * 
 * NOTE: This is for NON-AGENTS endpoints only. Agents endpoint does routing
 * in loadEphemeralAgent using routeToModel from intent-analyzer.
 * 
 * @param {object} params - Routing parameters
 * @param {string} params.endpoint - The endpoint type (bedrock, openAI, etc.)
 * @param {string} params.prompt - The user's prompt/message
 * @param {string} params.currentModel - The currently selected model
 * @param {string} [params.userId] - Optional user ID for logging
 * @param {object} [params.appConfig] - Application configuration (from req.config)
 * @returns {Promise<string|null>} The routed model ID, or null if no routing needed
 */
async function routeModel({ endpoint, prompt, currentModel, userId, appConfig }) {
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
    
    // Route the prompt using simplified analyzer (regex only, defaults to Haiku 4.5)
    const result = analyzer.routeToModel(prompt, {
      provider,
      preset: config.preset,
      hasTools: false, // Non-agents endpoints don't have tool context here
    });
    
    // Get pricing for both models
    const routedPricing = MODEL_PRICING[result.model] || { input: 0, output: 0, tier: 'unknown' };
    const currentPricing = MODEL_PRICING[currentModel] || { input: 0, output: 0, tier: 'unknown' };
    
    // Calculate estimated costs (assuming 500 output tokens for estimation)
    const estimatedOutputTokens = 500;
    const routedInputCost = (estimatedInputTokens / 1_000_000) * routedPricing.input;
    const routedOutputCost = (estimatedOutputTokens / 1_000_000) * routedPricing.output;
    const routedTotalCost = routedInputCost + routedOutputCost;
    
    // Get model short names for logging
    const getShortName = (model) => {
      if (!model) return 'unknown';
      if (model.includes('opus')) return 'Opus';
      if (model.includes('sonnet')) return 'Sonnet';
      if (model.includes('haiku')) return 'Haiku';
      if (model.includes('nova-micro')) return 'Nova-Micro';
      return model.split('.').pop()?.replace('-v1:0', '')?.substring(0, 15) || model;
    };
    
    // Simplified logging
    logger.info(
      `[Router] Model: ${getShortName(result.model)} | ` +
      `Tier: ${result.tier} | ` +
      `Score: ${result.score?.toFixed(2) || 'N/A'} | ` +
      `Est.In: ${estimatedInputTokens} | Est.Out: ${estimatedOutputTokens} | ` +
      `Cost: $${routedTotalCost.toFixed(4)}`
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
  clearIntentAnalyzerCache,
  getIntentAnalyzerStats,
  getIntentAnalyzerConfig,
  DEFAULT_CONFIG,
};
