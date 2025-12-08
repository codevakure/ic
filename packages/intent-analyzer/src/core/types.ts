/**
 * Core Types for Intent Analyzer
 * 
 * Simplified intent analysis for:
 * 1. Upload routing - Where to send uploaded files
 * 2. Model routing - Which model tier to use based on query complexity
 * 
 * Tool selection is now config-driven (toolsAutoEnabled in ranger.yaml)
 */

/**
 * Upload intent - Where the file should be uploaded
 */
export enum UploadIntent {
  /** Image files - for vision/image analysis */
  IMAGE = 'image',
  /** Documents - for file search/RAG */
  FILE_SEARCH = 'file_search',
  /** Spreadsheets/Code - for code interpreter */
  CODE_INTERPRETER = 'code_interpreter',
}

/**
 * File info for upload intent analysis
 */
export interface FileInfo {
  /** Original filename */
  filename: string;
  /** MIME type */
  mimetype: string;
  /** File size in bytes (optional) */
  size?: number;
}

/**
 * Result of upload intent analysis
 */
export interface UploadIntentResult {
  /** The upload intent/endpoint to use */
  intent: UploadIntent;
  /** Confidence score 0-1 */
  confidence: number;
}

/**
 * Result of batch upload intent analysis
 */
export interface BatchUploadIntentResult {
  /** Results grouped by upload intent */
  groups: Map<UploadIntent, FileInfo[]>;
  /** Individual file results */
  files: Array<{ file: FileInfo; result: UploadIntentResult }>;
}

// ============================================================================
// Model Routing Types
// ============================================================================

/**
 * Model tier for routing queries to appropriate LLM
 * 
 * 4-TIER SYSTEM (target distribution):
 * - simple   (~1%)  : Nova Micro  ($0.035/$0.14)  - Greetings, text-only simple responses
 * - moderate (~80%) : Haiku 4.5   ($1/$5)         - DEFAULT, most tasks, tool usage
 * - complex  (~15%) : Sonnet 4.5  ($3/$15)        - Debugging, detailed analysis
 * - expert   (~4%)  : Opus 4.5    ($15/$75)       - Deep analysis, architecture, research
 * 
 * Routing Rules:
 * - Tool usage → Haiku 4.5 minimum (Claude handles tools better)
 * - Deep/comprehensive analysis → Opus 4.5
 * - Text-only simple queries → Nova Micro
 * - If no pattern matches → Default to Haiku 4.5 (moderate)
 */
export type ModelTier = 'expert' | 'complex' | 'moderate' | 'simple';

/**
 * Result of model routing analysis
 */
export interface ModelRoutingResult {
  /** Recommended model tier */
  tier: ModelTier;
  /** Complexity score 0-1 */
  score: number;
  /** Detected categories (code, reasoning, etc.) */
  categories: string[];
  /** Brief reasoning for tier selection */
  reasoning: string;
}
