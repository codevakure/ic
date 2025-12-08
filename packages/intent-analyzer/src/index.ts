/**
 * Intent Analyzer Package
 * 
 * Simplified routing for LibreChat/Ranger:
 * 
 * 1. UPLOAD INTENT - Where to send uploaded files
 *    - IMAGE → Vision/image analysis
 *    - FILE_SEARCH → RAG/document search
 *    - CODE_INTERPRETER → Code executor
 * 
 * 2. MODEL ROUTING - 4-tier system based on query complexity (regex only)
 *    - simple   (~1%)  - Nova Micro  - Greetings only
 *    - moderate (~80%) - Haiku 4.5   - DEFAULT, most tasks
 *    - complex  (~15%) - Sonnet 4.5  - Debugging, analysis
 *    - expert   (~4%)  - Opus 4.5    - Deep research
 * 
 * Tool selection is now config-driven (toolsAutoEnabled in ranger.yaml)
 * No LLM classifier - uses regex patterns, defaults to Haiku 4.5
 * 
 * ## Quick Start
 * ```typescript
 * import { routeToModel, analyzeUploadIntent, UploadIntent } from '@librechat/intent-analyzer';
 * 
 * // Model routing
 * const result = routeToModel('Explain quantum computing', {
 *   provider: 'bedrock',
 *   preset: 'costOptimized',
 *   hasTools: true,
 * });
 * console.log(result.model);  // 'us.anthropic.claude-haiku-4-5-20251001-v1:0'
 * console.log(result.tier);   // 'moderate'
 * 
 * // Upload intent
 * const uploadResult = analyzeUploadIntent({ filename: 'data.xlsx', mimetype: 'application/vnd.ms-excel' });
 * console.log(uploadResult.intent);  // UploadIntent.CODE_INTERPRETER
 * ```
 */

// ============================================================================
// CORE MODULE - Upload Intent & Model Routing
// ============================================================================
export {
  // Types
  UploadIntent,
  type FileInfo,
  type UploadIntentResult,
  type BatchUploadIntentResult,
  type ModelTier,
  type ModelRoutingResult,
  // Upload Intent
  analyzeUploadIntent,
  analyzeUploadIntents,
  getUploadEndpoint,
  getToolResource,
  // Model Routing (regex-based)
  scoreQueryComplexity,
  getTierFromScore,
} from './core';

// ============================================================================
// LLM ROUTING MODULE - Model Selection & Configs
// ============================================================================
export {
  // Types
  type ModelConfig,
  type ModelPair,
  type TokenCost,
  type ModelCapability,
  type BedrockPresetTier,
  type OpenAIPresetTier,
  type RouteToModelConfig,
  type ModelRoutingResponse,
  // Bedrock Models
  BedrockModels,
  BedrockRoutingPairs,
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
  // Model Router (MAIN ENTRY POINT)
  routeToModel,
} from './llm-routing';

// ============================================================================
// ATTACHMENT MODULE - Detailed file routing
// ============================================================================
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
