/**
 * Universal Query Router
 * 
 * Single entry point that routes a query to:
 * 1. The right TOOLS (web_search, execute_code, file_search, artifacts)
 * 2. The right MODEL (based on tier: trivial → expert)
 * 
 * Uses regex patterns first (free, fast), then LLM fallback if needed.
 */

import type { 
  ModelTier, 
  ModelPair, 
  RoutingResult, 
  BedrockPresetTier,
  OpenAIPresetTier,
} from './types';
import type { 
  Tool, 
  QueryIntentResult,
  LlmFallbackFunction,
} from '../core/types';
import { analyzeQuery } from '../core/unified-analyzer';
import { getBedrockRoutingPair, CLASSIFIER_MODEL } from './models/bedrock';
import { getOpenAIRoutingPair } from './models/openai';

/**
 * Router configuration
 */
export interface RouterConfig {
  /** Provider: 'bedrock' or 'openai' */
  provider: 'bedrock' | 'openai';
  /** Preset tier for model selection */
  preset: BedrockPresetTier | OpenAIPresetTier;
  /** Available tools for this request */
  availableTools: Tool[];
  /** LLM function for fallback classification (optional but recommended) */
  llmFallback?: LlmFallbackFunction;
  /** Confidence threshold for LLM fallback (default: 0.4) */
  fallbackThreshold?: number;
  /** Conversation history for context-aware classification */
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

/**
 * Complete routing result with tools and model
 */
export interface UniversalRoutingResult {
  /** Selected tools */
  tools: Tool[];
  /** Tool selection details */
  toolsResult: QueryIntentResult;
  /** Selected model ID */
  model: string;
  /** Model tier */
  tier: ModelTier;
  /** Routing confidence */
  confidence: number;
  /** Reason for routing decision */
  reason: string;
  /** Whether LLM fallback was used */
  usedLlmFallback: boolean;
}

/**
 * Get model pairs based on provider and preset
 */
function getModelPairs(
  provider: 'bedrock' | 'openai',
  preset: BedrockPresetTier | OpenAIPresetTier
): ModelPair {
  if (provider === 'bedrock') {
    return getBedrockRoutingPair(preset as BedrockPresetTier);
  }
  return getOpenAIRoutingPair(preset as OpenAIPresetTier);
}

/**
 * Route a query to get both tools and model
 * 
 * @example
 * ```typescript
 * import { routeQuery, Tool } from '@librechat/intent-analyzer';
 * 
 * const result = await routeQuery('What are booming stocks today?', {
 *   provider: 'bedrock',
 *   preset: 'costOptimized',
 *   availableTools: [Tool.WEB_SEARCH, Tool.CODE_INTERPRETER],
 *   llmFallback: async (prompt) => callNovaMicro(prompt),
 * });
 * 
 * console.log(result.tools);  // ['web_search']
 * console.log(result.model);  // 'us.amazon.nova-pro-v1:0'
 * console.log(result.tier);   // 'simple'
 * ```
 */
export async function routeQuery(
  query: string,
  config: RouterConfig
): Promise<UniversalRoutingResult> {
  const {
    provider,
    preset,
    availableTools,
    llmFallback,
    fallbackThreshold = 0.4,
    conversationHistory,
  } = config;

  // Get model pairs for this provider/preset
  const modelPairs = getModelPairs(provider, preset);

  // Run unified analysis (tools + model tier together in ONE call)
  const analysisResult = await analyzeQuery({
    query,
    availableTools,
    llmFallback,
    fallbackThreshold,
    conversationHistory,
  });
  
  const tools = analysisResult.tools.tools;
  const toolsResult = analysisResult.tools;
  let tier = analysisResult.model.tier;
  const tierReasoning = analysisResult.model.reasoning;
  const usedLlmFallback = analysisResult.usedLlmFallback;
  
  // CRITICAL: Special routing for artifacts
  // Artifacts requires Claude models (Haiku 4.5 or Sonnet 4.5), NEVER Opus
  // - Nova models struggle with :::artifact{...} format
  // - Opus is overkill for artifact generation
  // - Use 80% Haiku 4.5 (moderate), 20% Sonnet 4.5 (complex) for cost optimization
  const hasArtifacts = tools.some(t => t === 'artifacts');
  let artifactRouted = false;
  
  if (hasArtifacts) {
    // Cap at complex (Sonnet 4.5) - NEVER use expert (Opus) for artifacts
    if (tier === 'expert') {
      tier = 'complex';
      artifactRouted = true;
    }
    // Elevate trivial/simple to Claude models (Haiku/Sonnet)
    else if (tier === 'trivial' || tier === 'simple') {
      // 80% chance Haiku 4.5 (moderate), 20% chance Sonnet 4.5 (complex)
      tier = Math.random() < 0.8 ? 'moderate' : 'complex';
      artifactRouted = true;
    }
    // For moderate tier, keep as-is (Haiku 4.5) - good balance
    // For complex tier, keep as-is (Sonnet 4.5) - when query genuinely needs it
  }
  
  const model = modelPairs[tier];

  return {
    tools,
    toolsResult,
    model,
    tier,
    confidence: Math.max(toolsResult.confidence, 0.5),
    reason: artifactRouted 
      ? `${tierReasoning} (artifact routing: ${tier === 'moderate' ? 'Haiku 4.5' : 'Sonnet 4.5'})` 
      : tierReasoning,
    usedLlmFallback,
  };
}

/**
 * Quick route - just get the model for a query (no tools)
 */
export async function routeToModel(
  query: string,
  provider: 'bedrock' | 'openai',
  preset: BedrockPresetTier | OpenAIPresetTier = 'costOptimized'
): Promise<{ model: string; tier: ModelTier; reason: string }> {
  const modelPairs = getModelPairs(provider, preset);
  
  const analysisResult = await analyzeQuery({
    query,
    availableTools: [],
  });

  const tier = analysisResult.model.tier;
  
  return {
    model: modelPairs[tier],
    tier,
    reason: analysisResult.model.reasoning,
  };
}

/**
 * Get the classifier model ID (for LLM fallback)
 */
export function getClassifierModel(): string {
  return CLASSIFIER_MODEL;
}

// Re-export types
export type { ModelTier, ModelPair, RoutingResult, BedrockPresetTier, OpenAIPresetTier };
