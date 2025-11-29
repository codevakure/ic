/**
 * LLM Router Service - 5-Tier Automatic Model Routing
 * 
 * Routes requests to optimal model tier based on complexity:
 *   TRIVIAL  (0.00-0.15): Nova Micro  - Greetings, acknowledgments
 *   SIMPLE   (0.15-0.35): Nova Lite   - Basic Q&A, definitions
 *   MODERATE (0.35-0.60): Haiku 4.5   - Explanations, standard coding
 *   COMPLEX  (0.60-0.80): Sonnet 4.5  - Debugging, detailed analysis
 *   EXPERT   (0.80-1.00): Opus 4.5    - System design, complex algorithms
 * 
 * Configuration is loaded from librechat.yaml under the `llmRouter` key.
 */

const { logger } = require('@librechat/data-schemas');
const { EModelEndpoint } = require('librechat-data-provider');

// Lazy-loaded router instances per endpoint
const routers = new Map();

// 5-Tier Model pricing (per 1M tokens) - matches llm-router bedrock.ts
const MODEL_PRICING = {
  // EXPERT tier - Complex algorithms, system design
  'global.anthropic.claude-opus-4-5-20251101-v1:0': { input: 5.00, output: 25.00, tier: 'expert' },
  // COMPLEX tier - Debugging, detailed analysis
  'us.anthropic.claude-sonnet-4-5-20250929-v1:0': { input: 3.00, output: 15.00, tier: 'complex' },
  // MODERATE tier - Explanations, standard coding
  'us.anthropic.claude-haiku-4-5-20251001-v1:0': { input: 1.00, output: 5.00, tier: 'moderate' },
  // SIMPLE tier - Basic Q&A
  'us.amazon.nova-lite-v1:0': { input: 0.06, output: 0.24, tier: 'simple' },
  // TRIVIAL tier - Greetings, acknowledgments
  'us.amazon.nova-micro-v1:0': { input: 0.035, output: 0.14, tier: 'trivial' },
  // Legacy models (for reference)
  'us.amazon.nova-pro-v1:0': { input: 0.80, output: 3.20, tier: 'moderate' },
};

/**
 * Default router configuration for 5-tier routing
 */
const DEFAULT_CONFIG = {
  enabled: false,
  preset: 'premium', // Use full 5-tier routing with all models
  debug: false,      // Enable detailed pattern/cost logging
  endpoints: {
    [EModelEndpoint.bedrock]: {
      enabled: true,
      preset: 'premium',
    },
    [EModelEndpoint.openAI]: {
      enabled: false,
    },
    [EModelEndpoint.anthropic]: {
      enabled: false,
    },
  },
};

/**
 * Get or create a router instance for the given endpoint
 * @param {string} endpoint - The endpoint type (bedrock, openAI, etc.)
 * @param {object} config - Router configuration
 * @returns {Promise<object|null>} Router instance or null if routing is disabled
 */
async function getRouter(endpoint, config) {
  if (!config?.enabled) {
    return null;
  }

  const cacheKey = `${endpoint}-${config.preset || 'premium'}`;
  
  if (routers.has(cacheKey)) {
    return routers.get(cacheKey);
  }

  try {
    // Dynamic import to avoid loading if not needed
    const llmRouter = await import('@librechat/llm-router');
    
    let router;
    const preset = config.preset ?? 'premium';
    
    switch (endpoint) {
      case EModelEndpoint.bedrock:
        // createBedrockRouter(preset) - 5-tier routing
        router = llmRouter.createBedrockRouter(preset);
        break;
        
      case EModelEndpoint.openAI:
        // createOpenAIRouter(preset) - 5-tier routing
        router = llmRouter.createOpenAIRouter(preset);
        break;
        
      default:
        // For custom endpoints, try to use custom router if models are provided
        if (config.models) {
          // createCustomRouter(endpoint, models, options)
          router = llmRouter.createCustomRouter(endpoint, config.models);
        } else {
          return null;
        }
    }
    
    routers.set(cacheKey, router);
    logger.info(`[LLMRouter] Created 5-tier router for ${endpoint} with preset '${preset}'`);
    return router;
  } catch (error) {
    logger.warn('[LLMRouter] Failed to load @librechat/llm-router package:', error.message);
    logger.warn('[LLMRouter] Error details:', error.stack);
    return null;
  }
}

/**
 * Get router configuration from app config
 * @param {object} appConfig - Application configuration
 * @param {string} endpoint - The endpoint type
 * @returns {object} Router configuration for the endpoint
 */
function getRouterConfig(appConfig, endpoint) {
  const globalConfig = appConfig?.llmRouter || DEFAULT_CONFIG;
  
  if (!globalConfig.enabled) {
    return { enabled: false };
  }
  
  const endpointConfig = globalConfig.endpoints?.[endpoint] || {};
  
  return {
    enabled: endpointConfig.enabled ?? globalConfig.enabled ?? false,
    preset: endpointConfig.preset ?? globalConfig.preset ?? 'premium',
    debug: endpointConfig.debug ?? globalConfig.debug ?? false,
    models: endpointConfig.models,
  };
}

/**
 * Route a request to the optimal model based on prompt complexity (5-tier)
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
  // Get configuration
  const config = getRouterConfig(appConfig || global.appConfig, endpoint);
  const debug = config.debug;
  
  if (debug) {
    logger.info('[LLMRouter] ========== 5-TIER ROUTING REQUEST ==========');
    logger.info('[LLMRouter] Configuration:', {
      enabled: config.enabled,
      preset: config.preset,
      endpoint,
    });
  }
  
  if (!config.enabled) {
    if (debug) logger.info('[LLMRouter] Routing DISABLED - using default model selection');
    return null;
  }
  
  // Skip routing if no prompt
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    if (debug) logger.info('[LLMRouter] No prompt provided - skipping routing');
    return null;
  }
  
  try {
    const router = await getRouter(endpoint, config);
    
    if (!router) {
      logger.warn('[LLMRouter] No router available for endpoint:', endpoint);
      return null;
    }
    
    // Estimate input tokens (rough: ~4 chars per token)
    const estimatedInputTokens = Math.ceil(prompt.length / 4);
    
    // Route the prompt (async for 5-tier routing)
    const startTime = Date.now();
    const result = await router.route(prompt);
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
      logger.info('[LLMRouter] ═══════════════════════════════════════════════════════════');
      logger.info('[LLMRouter] 5-TIER ROUTING DECISION');
      logger.info('[LLMRouter] ───────────────────────────────────────────────────────────');
      logger.info(`[LLMRouter] Prompt: "${prompt.substring(0, 80)}${prompt.length > 80 ? '...' : ''}"`);
      logger.info(`[LLMRouter] Score: ${result.strongWinRate?.toFixed(4) || 'N/A'}`);
      logger.info(`[LLMRouter] Tier: ${result.tier?.toUpperCase()} | Reason: ${result.reason}`);
      logger.info('[LLMRouter] ───────────────────────────────────────────────────────────');
      logger.info(`[LLMRouter] Model: ${getShortName(currentModel)} → ${getShortName(result.model)}`);
      logger.info(`[LLMRouter] Changed: ${result.model !== currentModel ? 'YES' : 'NO (same model)'}`);
      logger.info('[LLMRouter] ───────────────────────────────────────────────────────────');
      logger.info(`[LLMRouter] Est. Tokens: ~${estimatedInputTokens} input, ~${estimatedOutputTokens} output`);
      logger.info(`[LLMRouter] Cost: $${routedTotalCost.toFixed(6)} (was $${currentTotalCost.toFixed(6)})`);
      logger.info(`[LLMRouter] Savings: $${costSavings.toFixed(6)} (${costSavingsPercent}%)`);
      logger.info(`[LLMRouter] Routing: ${routingTimeMs}ms`);
      logger.info('[LLMRouter] ═══════════════════════════════════════════════════════════');
    } else {
      // Compact logging when debug is off
      logger.info(`[LLMRouter] ${result.tier?.toUpperCase()} | Score: ${result.strongWinRate?.toFixed(2)} | ${getShortName(result.model)} | Saved: ${costSavingsPercent}%`);
    }
    
    return result.model;
  } catch (error) {
    logger.error('[LLMRouter] Error routing model:', error);
    return null;
  }
}

/**
 * Clear all cached router instances
 * Useful for testing or when configuration changes
 */
function clearRouterCache() {
  routers.clear();
}

/**
 * Get routing statistics for monitoring
 * @returns {object} Statistics about router usage
 */
function getRouterStats() {
  return {
    cachedRouters: routers.size,
    endpoints: Array.from(routers.keys()),
  };
}

module.exports = {
  routeModel,
  clearRouterCache,
  getRouterStats,
  getRouterConfig,
  DEFAULT_CONFIG,
};
