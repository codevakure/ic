/**
 * LLM Routing Module
 * 
 * Provides model routing based on query complexity using regex patterns.
 * Defaults to Haiku 4.5 (moderate) when no pattern matches.
 * 
 * 4-tier system:
 * - simple:   Nova Micro (~1%)   - Greetings only
 * - moderate: Haiku 4.5  (~80%)  - DEFAULT, most tasks
 * - complex:  Sonnet 4.5 (~15%)  - Debugging, analysis
 * - expert:   Opus 4.5   (~4%)   - Deep research
 */

// Types
export type {
  ModelTier,
  ModelConfig,
  ModelPair,
  TokenCost,
  ModelCapability,
  BedrockPresetTier,
  OpenAIPresetTier,
} from './types';

// Models - Bedrock
export {
  BedrockModels,
  BedrockRoutingPairs,
  getBedrockModel,
  getBedrockModelsByTier,
  getBedrockRoutingPair,
  getModelForTier,
  calculateBedrockCost,
  estimateCostSavings,
} from './models/bedrock';

// Models - OpenAI
export {
  OpenAIModels,
  OpenAIRoutingPairs,
  getOpenAIModel,
  getOpenAIModelsByTier,
  getOpenAIRoutingPair,
  getOpenAIModelForTier,
  calculateOpenAICost,
} from './models/openai';

// Model Router (MAIN ENTRY POINT)
export {
  routeToModel,
  type RouteToModelConfig,
  type ModelRoutingResponse,
} from './router';
