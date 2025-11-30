/**
 * Intent Analyzer Package
 * 
 * UNIVERSAL QUERY ROUTING - One package to rule them all!
 * 
 * Routes every query to:
 * 1. The right TOOLS (web_search, execute_code, file_search, artifacts)
 * 2. The right MODEL (5-tier system: trivial → expert)
 *
 * ## 5-TIER MODEL SYSTEM (by cost):
 * - trivial:  Nova Micro      ($0.035/$0.14)  - Greetings only, no tools
 * - simple:   Llama 3.3 70B   ($0.72/$0.72)   - Basic tool calling
 * - moderate: Nova Pro        ($0.80/$3.20)   - Multi-step reasoning
 * - complex:  Haiku 4.5       ($1.00/$5.00)   - Artifacts, UI, code
 * - advanced: Sonnet 4.5      ($3.00/$15.00)  - Debugging, analysis
 * - expert:   Opus 4.5        ($15.00/$75.00) - Architecture, research
 * 
 * ## Quick Start
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
 * console.log(result.model);  // 'us.meta.llama3-3-70b-instruct-v1:0'
 * console.log(result.tier);   // 'simple'
 * ```
 * 
 * ## Modules
 * - Core: Upload intent, query intent, model routing
 * - LLM Routing: Model configs, presets, cost calculation
 * - Legacy: Detailed attachment/tool routing
 */

// ============================================================================
// CORE MODULE - Intent Analysis
// ============================================================================
export {
  // Types
  UploadIntent,
  Tool,
  type FileInfo,
  type UploadIntentResult,
  type BatchUploadIntentResult,
  type AttachedFileContext,
  type QueryContext,
  type QueryIntentResult,
  // Model Routing Types (from core)
  type ModelRoutingResult,
  type UnifiedQueryResult,
  type UnifiedAnalysisOptions,
  type LlmFallbackFunction,
  // Upload Intent
  analyzeUploadIntent,
  analyzeUploadIntents,
  getUploadEndpoint,
  getToolResource,
  // Query Intent
  analyzeQueryIntent,
  shouldUseTool,
  capabilityToTool,
  toolToCapability,
  getToolContextPrompts,
  // Model Routing
  scoreQueryComplexity,
  getTierFromScore,
  // Unified Analysis
  analyzeQuery,
  analyzeTools,
  analyzeModelTier,
  getTierThreshold,
} from './core';

// ============================================================================
// LLM ROUTING MODULE - Model Selection & Configs
// ============================================================================
export {
  // Types
  type ModelTier,
  type ModelConfig,
  type ModelPair,
  type TokenCost,
  type ModelCapability,
  type BedrockPresetTier,
  type OpenAIPresetTier,
  type UserPreference,
  type RoutingResult,
  type RoutingReasonCategory,
  type QueryFeatures,
  type RoutingStats,
  // Bedrock Models
  BedrockModels,
  BedrockRoutingPairs,
  CLASSIFIER_MODEL,
  getBedrockModel,
  getBedrockModelsByTier,
  getBedrockRoutingPair,
  getModelForTier,
  calculateBedrockCost,
  estimateCostSavings,
  // OpenAI Models
  OpenAIModels,
  OpenAIRoutingPairs,
  getOpenAIModel,
  getOpenAIModelsByTier,
  getOpenAIRoutingPair,
  getOpenAIModelForTier,
  calculateOpenAICost,
  // Universal Router (MAIN ENTRY POINT)
  routeQuery,
  routeToModel,
  getClassifierModel,
  type RouterConfig,
  type UniversalRoutingResult,
} from './llm-routing';

// ============================================================================
// LEGACY MODULES - Full-featured (for advanced use cases)
// ============================================================================

// Attachment routing (detailed)
export {
  routeAttachment,
  routeAttachments,
  categorizeFile,
  shouldEmbedFile,
  needsOCR,
  needsSTT,
  isStrategySupported,
  DEFAULT_ROUTING_CONFIG,
} from './attachments';

export {
  UploadStrategy,
  FileCategory,
  FileProcessingStatus,
  type AttachmentFile,
  type AttachmentRouteResult,
  type AttachmentRoutingConfig,
  type BatchRouteResult,
  type FileMatrixEntry,
} from './attachments/types';

export {
  MIME_PATTERNS as LEGACY_MIME_PATTERNS,
  EXTENSION_PATTERNS as LEGACY_EXTENSION_PATTERNS,
  STRATEGY_MATRIX,
  EMBEDDING_EXCLUSIONS,
  OCR_CANDIDATES,
  STT_CANDIDATES,
} from './attachments/matrix';

// Tools selection (detailed)
export {
  selectTools,
  shouldEnableTool,
  ToolType,
  type ToolDefinition,
  type ToolSelectionContext,
  type ToolSelectionResult,
} from './tools';
