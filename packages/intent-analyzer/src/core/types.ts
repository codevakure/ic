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
  /** Fetch transcripts and metadata from YouTube videos */
  YOUTUBE_VIDEO = 'youtube_video',
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
 * Previous tool usage context for conversation analysis
 */
export interface PreviousToolContext {
  /** Tools used in the last assistant response */
  lastUsedTools: Tool[];
  /** Whether the last tool execution was successful */
  lastToolSuccess?: boolean;
  /** Topic/subject of the last exchange (extracted keywords) */
  lastTopics?: string[];
  /** Type of output produced (chart, code, document, etc.) */
  lastOutputType?: 'chart' | 'code' | 'document' | 'ui_component' | 'search_result' | 'other';
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
  /** Previous tool usage context for follow-up detection */
  previousToolContext?: PreviousToolContext;
}

/**
 * Signal source for weighted scoring
 */
export type SignalSource = 
  | 'user_selected'      // User explicitly selected in UI
  | 'explicit_request'   // User asked for tool in query
  | 'file_type'          // Attached file type requires tool
  | 'context_followup'   // Follow-up to previous tool usage
  | 'context_reference'  // References previous output
  | 'ngram_match'        // N-gram phrase match
  | 'regex_high'         // High-confidence regex pattern
  | 'regex_medium'       // Medium-confidence regex pattern
  | 'regex_low'          // Low-confidence regex pattern

/**
 * Individual signal for weighted scoring
 */
export interface IntentSignal {
  /** The tool this signal suggests */
  tool: Tool;
  /** Source of the signal */
  source: SignalSource;
  /** Raw score from this signal (0-1) */
  score: number;
  /** Optional reason for debugging */
  reason?: string;
}

/**
 * Result of query intent analysis
 */
export interface QueryIntentResult {
  /** Tools to use, in priority order */
  tools: Tool[];
  /** Confidence score 0-1 */
  confidence: number;
  /** Brief reasoning for tool selection */
  reasoning: string;
  /** 
   * Optional clarification prompt when intent is ambiguous
   * UI can show this to help user specify their intent
   */
  clarificationPrompt?: string;
  /**
   * Suggested options for clarification (if clarificationPrompt is set)
   * e.g., ["Create a React dashboard", "Create an HTML page", "Generate a diagram"]
   */
  clarificationOptions?: string[];
}

// ============================================================================
// Model Routing Types (merged from llm-router)
// ============================================================================

/**
 * Model tier for routing queries to appropriate LLM
 * 
 * 4-TIER SYSTEM (target distribution):
 * - simple   (~1%)  : Nova Micro  ($0.035/$0.14)  - Greetings, text-only simple responses
 * - moderate (~80%) : Haiku 4.5   ($1/$5)         - Most tasks, tool usage, standard code
 * - complex  (~15%) : Sonnet 4.5  ($3/$15)        - Debugging, detailed analysis
 * - expert   (~4%)  : Opus 4.5    ($15/$75)       - Deep analysis, architecture, research
 * 
 * Routing Rules:
 * - Tool usage → Haiku 4.5 minimum (Claude handles tools better)
 * - Deep/comprehensive analysis → Opus 4.5
 * - Text-only simple queries → Nova Micro
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

/**
 * Unified query analysis result combining tool and model routing
 */
export interface UnifiedQueryResult {
  /** Tool selection result */
  tools: QueryIntentResult;
  /** Model routing result */
  model: ModelRoutingResult;
  /** Whether LLM fallback was used */
  usedLlmFallback: boolean;
  /** LLM classifier token usage (only when usedLlmFallback is true) */
  classifierUsage?: {
    inputTokens: number;
    outputTokens: number;
    /** Estimated cost in USD */
    cost: number;
  };
}

/**
 * LLM fallback response with usage data for cost tracking
 */
export interface LlmFallbackResponse {
  /** The LLM response text */
  text: string;
  /** Token usage for cost calculation */
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * LLM fallback function signature - injectable for flexibility
 * The caller provides the LLM function, keeping this package pure
 * Returns response text and optional usage data for cost tracking
 */
export type LlmFallbackFunction = (prompt: string) => Promise<string | LlmFallbackResponse>;

/**
 * Options for unified query analysis
 */
export interface UnifiedAnalysisOptions {
  /** The user's query */
  query: string;
  /** Available tools */
  availableTools: Tool[];
  /** Attached files context */
  attachedFiles?: AttachedFileContext;
  /** Conversation history for context */
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Optional LLM fallback function for low-confidence cases */
  llmFallback?: LlmFallbackFunction;
  /** Confidence threshold below which to use LLM fallback (default: 0.4) */
  fallbackThreshold?: number;
  /** Tools that are auto-enabled (will always be added if applicable) */
  autoEnabledTools?: Tool[];
  /** Tools explicitly selected by user in UI */
  userSelectedTools?: Tool[];
}
