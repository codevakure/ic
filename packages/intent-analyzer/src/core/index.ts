/**
 * Core Intent Analyzer Module
 * 
 * Simplified intent analysis for LibreChat:
 * 
 * 1. Upload Intent - Determine where to upload files
 *    - IMAGE → Image upload endpoint
 *    - FILE_SEARCH → RAG/file search endpoint
 *    - CODE_INTERPRETER → Code executor endpoint
 * 
 * 2. Model Routing - 4-tier system based on query complexity (regex only):
 *    - simple   → Nova Micro   - Greetings only
 *    - moderate → Haiku 4.5    - DEFAULT, most tasks
 *    - complex  → Sonnet 4.5   - Debugging, analysis
 *    - expert   → Opus 4.5     - Deep research
 * 
 * Tool selection is now config-driven (toolsAutoEnabled in ranger.yaml)
 */

// Types
export {
  UploadIntent,
} from './types';

export type {
  FileInfo,
  UploadIntentResult,
  BatchUploadIntentResult,
  // Model Routing Types
  ModelTier,
  ModelRoutingResult,
} from './types';

// Upload Intent
export {
  analyzeUploadIntent,
  analyzeUploadIntents,
  getUploadEndpoint,
  getToolResource,
} from './upload-intent';

// Model Routing
export {
  scoreQueryComplexity,
  getTierFromScore,
} from './model-routing';
