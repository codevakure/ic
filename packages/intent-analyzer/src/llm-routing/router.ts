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
  
  // CRITICAL: Elevate tier if artifacts is detected
  // Artifacts requires a model that can reliably follow complex formatting instructions
  // Nova Lite/Pro struggle with :::artifact{...} format, need at least Haiku 4.5
  const hasArtifacts = tools.some(t => t === 'artifacts');
  if (hasArtifacts && (tier === 'trivial' || tier === 'simple')) {
    tier = 'moderate'; // Haiku 4.5 can handle artifact generation
  }
  
  const model = modelPairs[tier];

  return {
    tools,
    toolsResult,
    model,
    tier,
    confidence: Math.max(toolsResult.confidence, 0.5),
    reason: hasArtifacts && tier === 'moderate' 
      ? `${tierReasoning} (elevated for artifacts)` 
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
