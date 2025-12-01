/**
 * Type definitions for Datadog LLM Observability
 */

/**
 * LLM Provider constants
 */
export const LLM_PROVIDERS = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  GOOGLE: 'google',
  BEDROCK: 'bedrock',
  AZURE_OPENAI: 'azure_openai',
  CUSTOM: 'custom'
} as const;

/**
 * LLM Operation types
 */
export const LLM_OPERATION_TYPES = {
  COMPLETION: 'completion',
  EMBEDDING: 'embedding',
  IMAGE_GENERATION: 'image_generation',
  VISION: 'vision',
  FUNCTION_CALLING: 'function_calling',
  AGENT: 'agent'
} as const;

export type LLMProvider = typeof LLM_PROVIDERS[keyof typeof LLM_PROVIDERS];
export type LLMOperationType = typeof LLM_OPERATION_TYPES[keyof typeof LLM_OPERATION_TYPES];

/**
 * Interface for LLM trace options
 */
export interface LLMTraceOptions {
  provider: LLMProvider;
  model: string;
  operationType?: LLMOperationType;
  userId?: string;
  conversationId?: string;
  messageId?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Interface for conversation workflow trace options
 */
export interface ConversationWorkflowOptions {
  conversationId: string;
  userId?: string;
  user?: any;
  workflowType?: string;
  metadata?: Record<string, any>;
}

/**
 * Interface for user session trace options
 */
export interface UserSessionOptions {
  userId: string;
  sessionId: string;
  activity?: string;
  metadata?: Record<string, any>;
}

/**
 * Interface for LLM usage statistics
 */
export interface LLMUsageStats {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
}

/**
 * Interface for LLM response metadata
 */
export interface LLMResponseMetadata {
  model?: string;
  usage?: LLMUsageStats;
  finishReason?: string;
  duration?: number;
}

/**
 * Interface for Datadog initialization options
 */
export interface DatadogInitOptions {
  enabled?: boolean;
  service?: string;
  env?: string;
  version?: string;
  apiKey?: string;
  site?: string;
  agentlessEnabled?: boolean;
  mlApp?: string;
  debug?: boolean;
  profiling?: boolean;
  logInjection?: boolean;
  sampleRate?: number;
}

/**
 * Interface for trace context
 */
export interface TraceContext {
  traceId: string;
  spanId: string;
}

/**
 * Common model names for convenience
 */
export const COMMON_MODELS = {
  OPENAI: {
    GPT_4O: 'gpt-4o',
    GPT_4_TURBO: 'gpt-4-turbo',
    GPT_4: 'gpt-4',
    GPT_3_5_TURBO: 'gpt-3.5-turbo',
    O1_PREVIEW: 'o1-preview',
    O1_MINI: 'o1-mini',
    O3_MINI: 'o3-mini'
  },
  ANTHROPIC: {
    CLAUDE_3_OPUS: 'claude-3-opus-20240229',
    CLAUDE_3_SONNET: 'claude-3-5-sonnet-20241022',
    CLAUDE_3_HAIKU: 'claude-3-5-haiku-20241022'
  },
  GOOGLE: {
    GEMINI_PRO: 'gemini-pro',
    GEMINI_PRO_VISION: 'gemini-pro-vision',
    GEMINI_1_5_PRO: 'gemini-1.5-pro',
    GEMINI_1_5_FLASH: 'gemini-1.5-flash'
  }
} as const;
