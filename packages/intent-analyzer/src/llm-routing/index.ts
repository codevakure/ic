/**
 * LLM Routing Module
 * 
 * Provides model routing capabilities integrated with intent analysis.
 * 
 * This module combines:
 * - Model configurations (Bedrock, OpenAI)
 * - 5-tier routing (trivial → expert)
 * - Universal router that returns both tools AND model
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
  UserPreference,
  RoutingResult,
  RoutingReasonCategory,
  QueryFeatures,
  RoutingStats,
} from './types';

// Models - Bedrock
export {
  BedrockModels,
  BedrockRoutingPairs,
  CLASSIFIER_MODEL,
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

// Universal Router
export {
  routeQuery,
  routeToModel,
  getClassifierModel,
  type RouterConfig,
  type UniversalRoutingResult,
} from './router';
