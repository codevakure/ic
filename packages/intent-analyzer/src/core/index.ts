/**
 * Core Intent Analyzer Module
 * 
 * Lightweight intent analysis for LibreChat:
 * 
 * 1. Upload Intent - Determine where to upload files
 *    - IMAGE → Image upload endpoint
 *    - FILE_SEARCH → RAG/file search endpoint
 *    - CODE_INTERPRETER → Code executor endpoint
 * 
 * 2. Query Intent - Determine which tools to use
 *    - Based on attached files
 *    - Based on query patterns
 *    - Returns tools in priority order with context prompts
 * 
 * 3. Model Routing - 5-tier system (by cost):
 *    - trivial  → Nova Micro   ($0.035/$0.14)  - Greetings only
 *    - simple   → Nova Pro     ($0.80/$3.20)   - Basic Q&A, simple tools
 *    - moderate → Haiku 4.5    ($1.00/$5.00)   - Explanations, standard code
 *    - complex  → Sonnet 4.5   ($3.00/$15.00)  - Debugging, analysis
 *    - expert   → Opus 4.5     ($15.00/$75.00) - Architecture, research
 * 
 * 4. Unified Analysis - Combined tool + model with LLM fallback
 *    - Use analyzeQuery() as the MAIN ENTRY POINT
 */

// Types
export {
  UploadIntent,
  Tool,
} from './types';

export type {
  FileInfo,
  UploadIntentResult,
  BatchUploadIntentResult,
  AttachedFileContext,
  QueryContext,
  QueryIntentResult,
  // New types for weighted scoring
  PreviousToolContext,
  IntentSignal,
  SignalSource,
  // Model Routing Types
  ModelTier,
  ModelRoutingResult,
  UnifiedQueryResult,
  UnifiedAnalysisOptions,
  LlmFallbackFunction,
  LlmFallbackResponse,
} from './types';

// Upload Intent
export {
  analyzeUploadIntent,
  analyzeUploadIntents,
  getUploadEndpoint,
  getToolResource,
} from './upload-intent';

// Query Intent
export {
  analyzeQueryIntent,
  shouldUseTool,
  capabilityToTool,
  toolToCapability,
} from './query-intent';

// Model Routing
export {
  scoreQueryComplexity,
  getTierFromScore,
} from './model-routing';

// Unified Analysis (MAIN ENTRY POINT)
export {
  analyzeQuery,
  analyzeTools,
  analyzeModelTier,
  getTierThreshold,
} from './unified-analyzer';
