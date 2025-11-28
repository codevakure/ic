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
  getToolContextPrompts,
} from './query-intent';
