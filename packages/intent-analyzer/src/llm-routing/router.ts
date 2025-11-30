/**
 * Universal Query Router
 * 
 * Single entry point that routes a query to:
 * 1. The right TOOLS (web_search, execute_code, file_search, artifacts)
 * 2. The right MODEL (4-tier: simple → moderate → complex → expert)
 * 
 * 4-TIER SYSTEM (target distribution):
 * - Simple   (~1%)  - Nova Micro  - Greetings, text-only simple responses
 * - Moderate (~80%) - Haiku 4.5   - Most tasks, tool usage, standard code
 * - Complex  (~15%) - Sonnet 4.5  - Debugging, detailed analysis
 * - Expert   (~4%)  - Opus 4.5    - Deep analysis, architecture, research
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
  AttachedFileContext,
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
  /** Whether MCP servers are configured (MCP tools require Claude models) */
  hasMcpServers?: boolean;
  /** LLM function for fallback classification (optional but recommended) */
  llmFallback?: LlmFallbackFunction;
  /** Confidence threshold for LLM fallback (default: 0.4) */
  fallbackThreshold?: number;
  /** Conversation history for context-aware classification */
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Attached files context */
  attachedFiles?: AttachedFileContext;
  /** Tools that are auto-enabled */
  autoEnabledTools?: Tool[];
  /** Tools explicitly selected by user */
  userSelectedTools?: Tool[];
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
 *   preset: 'premium',
 *   availableTools: [Tool.WEB_SEARCH, Tool.CODE_INTERPRETER],
 *   llmFallback: async (prompt) => callNovaMicro(prompt),
 * });
 * 
 * console.log(result.tools);  // ['web_search']
 * console.log(result.model);  // 'us.anthropic.claude-haiku-4-5-20251001-v1:0'
 * console.log(result.tier);   // 'moderate'
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
    hasMcpServers = false,
    llmFallback,
    fallbackThreshold = 0.4,
    conversationHistory,
    attachedFiles,
    autoEnabledTools,
    userSelectedTools,
  } = config;

  // Get model pairs for this provider/preset
  const modelPairs = getModelPairs(provider, preset);

  // Run unified analysis (tools + model tier together in ONE call)
  // This includes the LLM classifier fallback for low-confidence cases
  const analysisResult = await analyzeQuery({
    query,
    availableTools,
    llmFallback,
    fallbackThreshold,
    conversationHistory,
    attachedFiles,
    autoEnabledTools,
    userSelectedTools,
  });
  
  const tools = analysisResult.tools.tools;
  const toolsResult = analysisResult.tools;
  let tier = analysisResult.model.tier;
  const tierReasoning = analysisResult.model.reasoning;
  const usedLlmFallback = analysisResult.usedLlmFallback;
  
  // Check if user explicitly requests deep/comprehensive analysis (should use Opus 4.5)
  const deepAnalysisPatterns = [
    /\bdeep\s*(analysis|dive|look|exploration|investigation|review|research)\b/i,
    /\b(detailed|complete|full)\s*(analysis|view|breakdown|examination|assessment)\b/i,
    /\bdig\s*(deep|deeper|into)\b/i,
    /\b(analyze|examine|review)\s*(in\s*detail|thoroughly|comprehensively|deeply)\b/i,
    /\b(comprehensive|thorough|exhaustive|complete)\s*(analysis|overview|review|assessment|evaluation)\b/i,
    /\bdetailed\s*view\b/i,
    /\b(full|complete)\s*(picture|understanding|breakdown)\b/i,
    /\bin-?depth\b/i,
  ];
  const requestsDeepAnalysis = deepAnalysisPatterns.some(p => p.test(query));
  
  // ROUTING RULE: Any tool usage → Haiku 4.5 minimum
  // This includes: built-in tools (web_search, execute_code, file_search, artifacts) AND MCP tools
  // Nova Micro cannot handle tool calls properly - Claude models required
  const hasBuiltInTools = tools.length > 0;
  const hasAnyTools = hasBuiltInTools || hasMcpServers;
  
  // Elevate to moderate (Haiku) if we have any tools and tier is simple
  if (hasAnyTools && tier === 'simple') {
    tier = 'moderate';
  }
  
  // Keep expert tier only for deep analysis requests (otherwise cap at complex/Sonnet)
  const hasArtifacts = tools.some(t => t === 'artifacts');
  if (hasArtifacts && tier === 'expert' && !requestsDeepAnalysis) {
    tier = 'complex';
  }
  
  const model = modelPairs[tier];

  return {
    tools,
    toolsResult,
    model,
    tier,
    confidence: Math.max(toolsResult.confidence, 0.5),
    reason: tierReasoning,
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
