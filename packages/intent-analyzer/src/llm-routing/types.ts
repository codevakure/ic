/**
 * LLM Routing Types
 * Type definitions for model routing and selection
 */

// ============================================================================
// Model Configuration Types
// ============================================================================

/**
 * Model tier classification - 5-tier system for fine-grained routing
 * 
 * TIER MAPPING (by cost):
 * - trivial:  Nova Lite    ($0.06/$0.24)   - Greetings, yes/no, acknowledgments (multimodal)
 * - simple:   Nova Pro     ($0.80/$3.20)   - Basic Q&A, simple tools
 * - moderate: Haiku 4.5    ($1/$5)         - Explanations, standard code
 * - complex:  Sonnet 4.5   ($3/$15)        - Debugging, analysis
 * - expert:   Opus 4.5     ($15/$75)       - Architecture, research
 * 
 * Note: Nova Micro is used only for classifierModel (internal routing), NOT for user-facing responses
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
  | 'multimodal'
  | 'extended-thinking';

/**
 * Complete model configuration
 */
export interface ModelConfig {
  /** Model identifier (e.g., 'us.anthropic.claude-sonnet-4-5-20250929-v1:0') */
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
 * Note: Nova Micro is only used for classifierModel (internal routing), not for user-facing responses
 */
export interface ModelPair {
  /** Tier 5: Expert - architecture, research, PhD-level (Opus 4.5) */
  expert: string;
  /** Tier 4: Complex - debugging, code review, analysis (Sonnet 4.5) */
  complex: string;
  /** Tier 3: Moderate - explanations, standard code (Haiku 4.5) */
  moderate: string;
  /** Tier 2: Simple - basic Q&A, simple tools (Nova Pro) */
  simple: string;
  /** Tier 1: Trivial - greetings, yes/no, acknowledgments, multimodal (Nova Lite) */
  trivial: string;
}

// ============================================================================
// Routing Configuration Types
// ============================================================================

/**
 * User preference for routing optimization
 */
export type UserPreference = 'cost' | 'quality' | 'balanced';

/**
 * Preset tier names for Bedrock
 */
export type BedrockPresetTier = 'premium' | 'costOptimized' | 'ultraCheap';

/**
 * Preset tier names for OpenAI
 */
export type OpenAIPresetTier = 'premium' | 'standard' | 'economy';

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
  | 'llm_classified';

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
  /** Estimated cost for this request */
  estimatedCost?: number;
  /** Whether LLM fallback was used */
  usedLlmFallback?: boolean;
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
  /** Contains technical terms */
  hasTechnicalTerms: boolean;
  /** Contains multi-step instructions */
  hasMultiStep: boolean;
}

// ============================================================================
// Statistics Types
// ============================================================================

/**
 * Routing statistics for 4-tier routing
 */
export interface RoutingStats {
  /** Count per model */
  modelCounts: Record<string, number>;
  /** Percentage of requests to expert model (highest tier) */
  expertPercentage: number;
  /** Percentage of requests to simple model (lowest tier) */
  simplePercentage: number;
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
