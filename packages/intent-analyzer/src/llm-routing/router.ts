/**
 * Model Router
 * 
 * Routes queries to the appropriate model tier based on complexity.
 * Uses regex patterns only - no LLM classifier.
 * 
 * 3-TIER SYSTEM (target distribution):
 * - Simple   (~1%)  - Nova Micro  - Greetings, text-only simple responses
 * - Moderate (~80%) - Haiku 4.5   - DEFAULT, most tasks, tool usage
 * - Complex/Expert (~19%) - Sonnet 4.5  - Debugging, detailed analysis, architecture
 * 
 * If no pattern matches → Default to Haiku 4.5 (moderate)
 */

import type { 
  ModelTier, 
  ModelPair, 
  BedrockPresetTier,
  OpenAIPresetTier,
} from './types';
import { scoreQueryComplexity } from '../core/model-routing';
import { getBedrockRoutingPair } from './models/bedrock';
import { getOpenAIRoutingPair } from './models/openai';

/**
 * Configuration for model routing
 */
export interface RouteToModelConfig {
  /** Provider: 'bedrock' or 'openai' */
  provider: 'bedrock' | 'openai';
  /** Preset tier for model selection */
  preset?: BedrockPresetTier | OpenAIPresetTier;
  /** Whether tools are being used (forces minimum Haiku 4.5) */
  hasTools?: boolean;
  /** Whether MCP tools are being used (forces minimum Haiku 4.5) */
  hasMcpTools?: boolean;
}

/**
 * Result of model routing
 */
export interface ModelRoutingResponse {
  /** Selected model ID */
  model: string;
  /** Model tier */
  tier: ModelTier;
  /** Complexity score 0-1 */
  score: number;
  /** Reason for routing decision */
  reason: string;
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
 * Route a query to the appropriate model based on complexity.
 * Uses regex patterns only - defaults to Haiku 4.5 (moderate) if no pattern matches.
 * 
 * @example
 * ```typescript
 * import { routeToModel } from '@librechat/intent-analyzer';
 * 
 * const result = await routeToModel('Explain quantum computing', {
 *   provider: 'bedrock',
 *   preset: 'costOptimized',
 *   hasTools: true,
 * });
 * 
 * console.log(result.model);  // 'us.anthropic.claude-haiku-4-5-20251001-v1:0'
 * console.log(result.tier);   // 'moderate'
 * ```
 */
export function routeToModel(
  query: string,
  config: RouteToModelConfig
): ModelRoutingResponse {
  const {
    provider,
    preset = 'costOptimized',
    hasTools = false,
    hasMcpTools = false,
  } = config;

  // Get model pairs for this provider/preset
  const modelPairs = getModelPairs(provider, preset);

  // Analyze query complexity using regex patterns
  const complexityResult = scoreQueryComplexity(query);
  
  let tier = complexityResult.tier;
  const score = complexityResult.score;
  let reason = complexityResult.reasoning;

  // ROUTING RULE: Any tool usage → Haiku 4.5 minimum
  // Nova Micro cannot handle tool calls properly - Claude models required
  const hasAnyTools = hasTools || hasMcpTools;
  
  if (hasAnyTools && tier === 'simple') {
    tier = 'moderate';
    reason = 'Elevated to Haiku 4.5 for tool usage';
  }

  // Get the model for the tier
  const model = modelPairs[tier];

  return {
    model,
    tier,
    score,
    reason,
  };
}

// Re-export types
export type { ModelTier, ModelPair, BedrockPresetTier, OpenAIPresetTier };
