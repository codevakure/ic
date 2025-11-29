/**
 * Intent Analyzer Package
 * 
 * A lightweight wrapper to understand intent and route to appropriate tools or logic.
 * 
 * ## Core Module (Recommended - Lightweight)
 * - Upload Intent: Analyze files → IMAGE | FILE_SEARCH | CODE_INTERPRETER
 * - Query Intent: Analyze query + attachments → Tools to use with context prompts
 * 
 * ## Legacy Modules (Full-featured)
 * - Attachments: Detailed file routing with OCR, STT, embedding support
 * - Tools: Comprehensive tool selection with MCP support
 * 
 * ## LLM Routing
 * For LLM routing/model selection, use the separate @librechat/llm-router package.
 */

// ============================================================================
// CORE MODULE - Lightweight Intent Analysis (Recommended)
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
} from './core';

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
