/**
 * Base Router Abstract Class
 * All routers must implement this interface
 */

import type {
  RoutingContext,
  RoutingResult,
  ModelPair,
  RoutingReasonCategory,
  QueryFeatures,
  ModelTier,
} from '../types';

/**
 * Abstract base class for all routers
 */
export abstract class Router {
  /** Whether this router can run in parallel */
  public readonly parallelSafe: boolean = true;

  /** Router name for identification */
  public abstract readonly name: string;

  /**
   * Calculate the probability that the strong model should handle this query.
   * Returns a value between 0 and 1.
   * Higher values = more likely to need strong model.
   *
   * @param prompt - The user's query
   * @param context - Optional routing context
   * @returns Promise resolving to win rate (0-1)
   */
  abstract calculateStrongWinRate(prompt: string, context?: RoutingContext): Promise<number>;

  /**
   * Route the query to appropriate model based on complexity score.
   * Supports 5-tier routing for fine-grained cost optimization.
   *
   * TIER THRESHOLDS (score ranges):
   * - Tier 5 (expert):   0.80+ - Most complex reasoning, advanced code
   * - Tier 4 (complex):  0.60-0.80 - Complex code, detailed analysis
   * - Tier 3 (moderate): 0.35-0.60 - Explanations, moderate reasoning
   * - Tier 2 (simple):   0.15-0.35 - Basic Q&A, simple tasks
   * - Tier 1 (trivial):  0.00-0.15 - Greetings, acknowledgments
   *
   * @param prompt - The user's query
   * @param threshold - Base routing threshold (unused in 5-tier, kept for API compatibility)
   * @param modelPair - Model identifiers for each tier
   * @param context - Optional routing context
   * @returns Promise resolving to routing result
   */
  async route(
    prompt: string,
    threshold: number,
    modelPair: ModelPair,
    context?: RoutingContext
  ): Promise<RoutingResult> {
    const startTime = Date.now();
    const winRate = await this.calculateStrongWinRate(prompt, context);
    
    // 5-tier routing based on complexity score
    const { model, tier } = this.selectModelByTier(winRate, modelPair);

    const { reason, category } = this.getRoutingReason(winRate, threshold, prompt, context);

    return {
      model,
      tier,
      confidence: this.calculateConfidence(winRate, tier),
      reason,
      reasonCategory: category,
      strongWinRate: winRate,
      threshold,
      routingDurationMs: Date.now() - startTime,
    };
  }

  /**
   * Select model based on complexity score (5-tier routing)
   */
  protected selectModelByTier(
    winRate: number,
    modelPair: ModelPair
  ): { model: string; tier: ModelTier } {
    // 5-TIER ROUTING based on complexity score
    if (winRate >= 0.80) {
      return { model: modelPair.expert, tier: 'expert' };
    }
    if (winRate >= 0.60) {
      return { model: modelPair.complex, tier: 'complex' };
    }
    if (winRate >= 0.35) {
      return { model: modelPair.moderate, tier: 'moderate' };
    }
    if (winRate >= 0.15) {
      return { model: modelPair.simple, tier: 'simple' };
    }
    return { model: modelPair.trivial, tier: 'trivial' };
  }

  /**
   * Calculate confidence based on tier and win rate
   */
  protected calculateConfidence(winRate: number, tier: ModelTier): number {
    // Confidence is how well the score fits the tier
    switch (tier) {
      case 'expert': return winRate; // 0.8+ maps to high confidence
      case 'complex': return 0.7 + (winRate - 0.6) * 0.5; // 0.6-0.8 maps to 0.7-0.8
      case 'moderate': return 0.5 + (winRate - 0.35) * 0.4; // 0.35-0.6 maps to 0.5-0.6
      case 'simple': return 0.6 + (0.35 - winRate) * 1.5; // Lower score = higher confidence for simple
      case 'trivial': return 1 - winRate; // Very low score = very confident it's trivial
      default: return 0.5;
    }
  }

  /**
   * Get human-readable reason for routing decision
   */
  protected getRoutingReason(
    winRate: number,
    threshold: number,
    prompt: string,
    context?: RoutingContext
  ): { reason: string; category: RoutingReasonCategory } {
    // Check context-based reasons first
    if (context?.userPreference === 'quality') {
      return { reason: 'User preference set to quality', category: 'user_preference' };
    }
    if (context?.userPreference === 'cost') {
      return { reason: 'User preference set to cost optimization', category: 'user_preference' };
    }

    // 5-tier routing reasons
    if (winRate >= 0.80) {
      return { reason: 'Expert-level complexity: advanced reasoning or complex code generation', category: 'complexity' };
    }
    if (winRate >= 0.60) {
      return { reason: 'Complex task: detailed analysis, debugging, or code review', category: 'complexity' };
    }
    if (winRate >= 0.35) {
      return { reason: 'Moderate complexity: explanations, summaries, or standard coding', category: 'complexity' };
    }
    if (winRate >= 0.15) {
      return { reason: 'Simple task: basic Q&A, definitions, or straightforward questions', category: 'simple' };
    }
    return { reason: 'Trivial query: greeting, acknowledgment, or very simple request', category: 'simple' };
  }

  /**
   * Extract features from prompt (can be overridden by subclasses)
   */
  protected extractFeatures(prompt: string): QueryFeatures {
    return {
      tokenCount: this.estimateTokens(prompt),
      hasCode: false,
      hasQuestion: /\?/.test(prompt),
      hasMath: false,
      hasReasoning: false,
      hasCreativeWriting: false,
      isSimple: prompt.length < 50,
      languageComplexity: 0.5,
      domainSpecificity: 0,
      hasTechnicalTerms: false,
      hasMultiStep: false,
    };
  }

  /**
   * Estimate token count for a string
   */
  protected estimateTokens(text: string): number {
    // Rough estimate: ~4 chars per token for English
    return Math.ceil(text.length / 4);
  }
}
