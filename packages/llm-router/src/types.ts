/**
 * @librechat/llm-router
 * Type definitions for LLM routing framework
 */

// ============================================================================
// Model Configuration Types
// ============================================================================

/**
 * Model tier classification - 5-tier system for fine-grained routing
 * 
 * TIER MAPPING:
 * - expert:   Opus 4.5     ($5/$25)   - Most complex reasoning, system design
 * - complex:  Sonnet 4.5   ($3/$15)   - Debugging, code review, analysis
 * - moderate: Haiku 4.5    ($1/$5)    - Explanations, summaries, standard code
 * - simple:   Nova Lite    ($0.06/$0.24) - Basic Q&A, definitions
 * - trivial:  Nova Micro   ($0.035/$0.14) - Greetings, acknowledgments
 */
export type ModelTier = 'expert' | 'complex' | 'moderate' | 'simple' | 'trivial';

/**
 * Cost structure per 1000 tokens
 */
export interface TokenCost {
  input: number;
  output: number;
}

/**
 * Model capability flags
 */
export type ModelCapability =
  | 'reasoning'
  | 'coding'
  | 'analysis'
  | 'vision'
  | 'tools'
  | 'general'
  | 'fast'
  | 'creative'
  | 'math'
  | 'video'
  | 'extended-thinking';

/**
 * Complete model configuration
 */
export interface ModelConfig {
  /** Model identifier (e.g., 'anthropic.claude-sonnet-4-20250514-v1:0') */
  id: string;
  /** Display name for the model */
  name: string;
  /** Model tier classification */
  tier: ModelTier;
  /** Cost per 1000 tokens */
  costPer1kTokens: TokenCost;
  /** Maximum context window */
  maxTokens: number;
  /** Model capabilities */
  capabilities: ModelCapability[];
  /** Optional provider identifier */
  provider?: string;
}

/**
 * Model configuration for 5-tier routing
 */
export interface ModelPair {
  /** Tier 5: Most complex - advanced reasoning, system design (Opus 4.5) */
  expert: string;
  /** Tier 4: Complex - debugging, code review, analysis (Sonnet 4.5) */
  complex: string;
  /** Tier 3: Moderate - explanations, summaries, standard code (Haiku 4.5) */
  moderate: string;
  /** Tier 2: Simple - basic Q&A, definitions (Nova Lite) */
  simple: string;
  /** Tier 1: Trivial - greetings, acknowledgments (Nova Micro) */
  trivial: string;
}

// ============================================================================
// Router Configuration Types
// ============================================================================

/**
 * Available router types
 */
export type RouterType = 'rule-based' | 'embedding' | 'classifier' | 'hybrid' | 'random';

/**
 * User preference for routing optimization
 */
export type UserPreference = 'cost' | 'quality' | 'balanced';

/**
 * Router configuration options (5-tier routing)
 */
export interface RouterConfig {
  /** Target endpoint (e.g., 'bedrock', 'openai') */
  endpoint: string;
  /** 5-tier model configuration */
  models: ModelPair;
  /** Routing threshold (0-1) - unused in 5-tier, kept for compatibility */
  threshold?: number;
  /** Type of router to use */
  routerType?: RouterType;
  /** Enable debug logging */
  debug?: boolean;
}

// ============================================================================
// Routing Context Types
// ============================================================================

/**
 * Attachment information for routing decisions
 */
export interface Attachment {
  type: string;
  name?: string;
  size?: number;
  mimeType?: string;
}

/**
 * Tool information for routing decisions
 */
export interface Tool {
  name: string;
  type?: string;
}

/**
 * Context provided for routing decisions
 */
export interface RoutingContext {
  /** Attached files */
  attachments?: Attachment[];
  /** Available tools */
  tools?: Tool[];
  /** Number of messages in conversation */
  messageCount?: number;
  /** Previously used model */
  previousModel?: string;
  /** User's preference for optimization */
  userPreference?: UserPreference;
  /** Conversation ID for consistency */
  conversationId?: string;
  /** Whether this is a continuation of a previous response */
  isContinuation?: boolean;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Routing Result Types
// ============================================================================

/**
 * Reason categories for routing decisions
 */
export type RoutingReasonCategory =
  | 'complexity'
  | 'code'
  | 'reasoning'
  | 'math'
  | 'creative'
  | 'ui_generation'
  | 'simple'
  | 'context'
  | 'tools'
  | 'attachments'
  | 'user_preference'
  | 'general'
  | 'random';

/**
 * Detailed routing result
 */
export interface RoutingResult {
  /** Selected model identifier */
  model: string;
  /** Model tier */
  tier: ModelTier;
  /** Confidence score (0-1) */
  confidence: number;
  /** Human-readable reason */
  reason: string;
  /** Reason category */
  reasonCategory: RoutingReasonCategory;
  /** Calculated win rate for strong model */
  strongWinRate: number;
  /** Applied threshold */
  threshold: number;
  /** Estimated cost for this request */
  estimatedCost?: number;
  /** Routing duration in milliseconds */
  routingDurationMs?: number;
}

// ============================================================================
// Query Feature Types
// ============================================================================

/**
 * Extracted features from a query for routing decisions
 */
export interface QueryFeatures {
  /** Estimated token count */
  tokenCount: number;
  /** Contains code or code-related content */
  hasCode: boolean;
  /** Contains a question */
  hasQuestion: boolean;
  /** Contains mathematical content */
  hasMath: boolean;
  /** Requires reasoning or analysis */
  hasReasoning: boolean;
  /** Creative writing request */
  hasCreativeWriting: boolean;
  /** Is a simple/trivial query */
  isSimple: boolean;
  /** Language complexity score (0-1) */
  languageComplexity: number;
  /** Domain specificity score (0-1) */
  domainSpecificity: number;
  /** Contains technical terms */
  hasTechnicalTerms: boolean;
  /** Contains multi-step instructions */
  hasMultiStep: boolean;
}

// ============================================================================
// Statistics Types
// ============================================================================

/**
 * Routing statistics for 5-tier routing
 */
export interface RoutingStats {
  /** Count per model */
  modelCounts: Record<string, number>;
  /** Percentage of requests to expert model (highest tier) */
  expertPercentage: number;
  /** Percentage of requests to trivial model (lowest tier) */
  trivialPercentage: number;
  /** Count per tier */
  tierCounts: Record<ModelTier, number>;
  /** Total requests routed */
  totalRequests: number;
  /** Estimated cost savings */
  estimatedSavings?: number;
  /** Average confidence score */
  averageConfidence: number;
  /** Routing decisions by reason category */
  reasonBreakdown: Record<RoutingReasonCategory, number>;
}

// ============================================================================
// Calibration Types
// ============================================================================

/**
 * Calibration result
 */
export interface CalibrationResult {
  /** Recommended threshold */
  threshold: number;
  /** Target strong model percentage */
  targetPercentage: number;
  /** Actual percentage with this threshold */
  actualPercentage: number;
  /** Sample size used */
  sampleSize: number;
  /** Win rate distribution */
  winRateDistribution: {
    min: number;
    max: number;
    mean: number;
    median: number;
    p25: number;
    p75: number;
  };
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Routing event for logging/analytics
 */
export interface RoutingEvent {
  timestamp: Date;
  prompt: string;
  promptHash?: string;
  result: RoutingResult;
  context?: RoutingContext;
  features?: QueryFeatures;
}

// ============================================================================
// Configuration Presets
// ============================================================================

/**
 * Preset tier names for Bedrock
 */
export type BedrockPresetTier = 'premium' | 'costOptimized' | 'ultraCheap';

/**
 * Preset tier names for OpenAI
 */
export type OpenAIPresetTier = 'premium' | 'standard' | 'economy';

/**
 * Configuration for intent-based threshold overrides
 */
export interface IntentThresholdConfig {
  code_generation?: number;
  code_review?: number;
  debugging?: number;
  data_analysis?: number;
  document_analysis?: number;
  simple_question?: number;
  greeting?: number;
  creative_writing?: number;
  general?: number;
  default: number;
}

/**
 * Full routing configuration for an endpoint
 */
export interface EndpointRoutingConfig {
  enabled: boolean;
  tier?: string;
  threshold?: number;
  models?: ModelPair;
  intentThresholds?: IntentThresholdConfig;
}
