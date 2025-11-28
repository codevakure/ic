/**
 * Core Types for Intent Analyzer
 * 
 * Lightweight intent analysis for:
 * 1. Upload routing - Where to send uploaded files
 * 2. Query routing - Which tools to use for user queries
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
 * Tool types available for query execution
 * Maps to AgentCapabilities in librechat-data-provider
 */
export enum Tool {
  /** Search through documents using RAG */
  FILE_SEARCH = 'file_search',
  /** Execute code, analyze data, create charts */
  CODE_INTERPRETER = 'execute_code',
  /** Create UI components, visualizations */
  ARTIFACTS = 'artifacts',
  /** Search the web for information */
  WEB_SEARCH = 'web_search',
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

/**
 * Context for attached files during query
 */
export interface AttachedFileContext {
  /** Files attached to the current message */
  files: FileInfo[];
  /** What upload intents were used for these files */
  uploadIntents: UploadIntent[];
}

/**
 * Context for query intent analysis
 */
export interface QueryContext {
  /** The user's query text */
  query: string;
  /** Files attached to this message */
  attachedFiles?: AttachedFileContext;
  /** Available tools (enabled for this agent/conversation) */
  availableTools: Tool[];
  /** Tools that are auto-enabled (will always be added if applicable) */
  autoEnabledTools?: Tool[];
  /** Tools explicitly selected by user in UI */
  userSelectedTools?: Tool[];
  /** Previous messages for context (optional) */
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

/**
 * Result of query intent analysis
 */
export interface QueryIntentResult {
  /** Tools to use, in priority order */
  tools: Tool[];
  /** Confidence score 0-1 */
  confidence: number;
  /** Dynamic prompts to add to context */
  contextPrompts: string[];
  /** Brief reasoning for tool selection */
  reasoning: string;
}
