/**
 * @librechat/llm-router
 *
 * LLM routing framework for cost-optimized model selection.
 * Routes queries between strong and weak models based on complexity analysis.
 *
 * @example
 * ```typescript
 * import { createBedrockRouter } from '@librechat/llm-router';
 *
 * const router = createBedrockRouter('costOptimized', 0.5);
 *
 * const result = await router.route('Write a complex algorithm', {
 *   tools: [{ name: 'code_interpreter' }],
 * });
 *
 * console.log(result.model); // -> strong or weak model based on complexity
 * console.log(result.reason); // -> "Code-related query detected"
 * ```
 */

// Main controller
export {
  LLMRouterController,
  createBedrockRouter,
  createOpenAIRouter,
  createCustomRouter,
} from './controller';

// Router implementations
export {
  Router,
  RuleBasedRouter,
  RandomRouter,
  HybridRouter,
  createEqualWeightHybrid,
  createRouter,
  RouterRegistry,
} from './routers';
export type { RouterWeight } from './routers';

// Model configurations
export {
  // Bedrock
  BedrockModels,
  BedrockRoutingPairs,
  getBedrockModel,
  getBedrockModelsByTier,
  getBedrockRoutingPair,
  calculateBedrockCost,
  estimateCostSavings,
  // OpenAI
  OpenAIModels,
  OpenAIRoutingPairs,
  getOpenAIModel,
  getOpenAIModelsByTier,
  getOpenAIRoutingPair,
  calculateOpenAICost,
  // Generic
  AllModels,
  AllRoutingPairs,
  getModel,
  getModelTier,
  calculateCost,
} from './models';

// Calibration utilities
export {
  calibrateThreshold,
  calibrateIntentThresholds,
  generateCalibrationReport,
  SampleQueriesByIntent,
} from './calibration';

// Types
export type {
  // Model types
  ModelTier,
  TokenCost,
  ModelCapability,
  ModelConfig,
  ModelPair,
  // Router types
  RouterType,
  RouterConfig,
  UserPreference,
  // Routing types
  Attachment,
  Tool,
  RoutingContext,
  RoutingResult,
  RoutingReasonCategory,
  QueryFeatures,
  // Statistics types
  RoutingStats,
  RoutingEvent,
  CalibrationResult,
  // Configuration types
  BedrockPresetTier,
  OpenAIPresetTier,
  IntentThresholdConfig,
  EndpointRoutingConfig,
} from './types';
