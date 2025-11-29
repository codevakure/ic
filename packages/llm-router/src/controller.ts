/**
 * LLM Router Controller
 * Main entry point for routing queries between models.
 * Supports 5-tier routing for fine-grained cost optimization.
 */

import { Router, RuleBasedRouter, createRouter } from './routers';
import type {
  RouterConfig,
  RouterType,
  RoutingContext,
  RoutingResult,
  RoutingStats,
  RoutingEvent,
  CalibrationResult,
  ModelPair,
  RoutingReasonCategory,
} from './types';
import { BedrockRoutingPairs, getBedrockModel, calculateBedrockCost } from './models/bedrock';
import { OpenAIRoutingPairs, getOpenAIModel, calculateOpenAICost } from './models/openai';

/**
 * Default configuration values
 */
const DEFAULTS = {
  threshold: 0.5,
  routerType: 'rule-based' as const,
  debug: false,
};

/**
 * Main controller for LLM routing (5-tier)
 */
export class LLMRouterController {
  private readonly router: Router;
  private readonly config: RouterConfig & { threshold: number; routerType: RouterType; debug: boolean };
  private readonly modelPair: ModelPair;

  // Statistics tracking
  private modelCounts: Map<string, number> = new Map();
  private totalConfidence: number = 0;
  private reasonCounts: Map<RoutingReasonCategory, number> = new Map();
  private eventLog: RoutingEvent[] = [];
  private readonly maxEventLogSize: number = 1000;

  /**
   * Create a new LLM Router Controller (5-tier)
   */
  constructor(config: RouterConfig) {
    this.config = {
      threshold: config.threshold ?? DEFAULTS.threshold,
      routerType: config.routerType ?? DEFAULTS.routerType,
      debug: config.debug ?? DEFAULTS.debug,
      endpoint: config.endpoint,
      models: config.models,
    };

    this.modelPair = config.models;

    // Initialize router
    this.router = createRouter(this.config.routerType);

    if (this.config.debug) {
      console.log('[LLMRouter] Initialized with 5-tier config:', {
        endpoint: this.config.endpoint,
        models: this.modelPair,
      });
    }
  }

  /**
   * Route a query to the appropriate model (5-tier)
   */
  async route(prompt: string, context?: RoutingContext): Promise<RoutingResult> {
    const result = await this.router.route(
      prompt,
      this.config.threshold,
      this.modelPair,
      context
    );

    // Calculate estimated cost
    result.estimatedCost = this.calculateEstimatedCost(result.model, prompt);

    // Update statistics
    this.updateStats(result);

    // Log event
    this.logEvent(prompt, result, context);

    if (this.config.debug) {
      console.log('[LLMRouter] Routing result:', {
        model: result.model,
        tier: result.tier,
        confidence: result.confidence.toFixed(3),
        reason: result.reason,
        strongWinRate: result.strongWinRate.toFixed(3),
      });
    }

    return result;
  }

  /**
   * Route multiple queries in batch
   */
  async routeBatch(
    prompts: string[],
    context?: RoutingContext
  ): Promise<RoutingResult[]> {
    return Promise.all(prompts.map((prompt) => this.route(prompt, context)));
  }

  /**
   * Calculate win rate without routing (for calibration)
   */
  async calculateWinRate(prompt: string, context?: RoutingContext): Promise<number> {
    return this.router.calculateStrongWinRate(prompt, context);
  }

  /**
   * Calculate win rates for multiple prompts
   */
  async calculateWinRateBatch(
    prompts: string[],
    context?: RoutingContext
  ): Promise<number[]> {
    return Promise.all(
      prompts.map((prompt) => this.router.calculateStrongWinRate(prompt, context))
    );
  }

  /**
   * Get current routing statistics
   */
  getStats(): RoutingStats {
    const totalRequests = [...this.modelCounts.values()].reduce((a, b) => a + b, 0);
    const expertCount = this.modelCounts.get(this.modelPair.expert) || 0;
    const complexCount = this.modelCounts.get(this.modelPair.complex) || 0;
    const moderateCount = this.modelCounts.get(this.modelPair.moderate) || 0;
    const simpleCount = this.modelCounts.get(this.modelPair.simple) || 0;
    const trivialCount = this.modelCounts.get(this.modelPair.trivial) || 0;

    // Calculate estimated savings (comparing expert vs trivial)
    let estimatedSavings = 0;
    const cheapCount = trivialCount + simpleCount;
    
    if (cheapCount > 0) {
      // Estimate based on average query (500 tokens)
      const avgTokens = 500;
      const expertCost = this.calculateEstimatedCost(this.modelPair.expert, 'x'.repeat(avgTokens * 4)) || 0;
      const trivialCost = this.calculateEstimatedCost(this.modelPair.trivial, 'x'.repeat(avgTokens * 4)) || 0;
      estimatedSavings = cheapCount * (expertCost - trivialCost);
    }

    return {
      modelCounts: Object.fromEntries(this.modelCounts),
      expertPercentage: totalRequests > 0 ? (expertCount / totalRequests) * 100 : 0,
      trivialPercentage: totalRequests > 0 ? (trivialCount / totalRequests) * 100 : 0,
      tierCounts: {
        expert: expertCount,
        complex: complexCount,
        moderate: moderateCount,
        simple: simpleCount,
        trivial: trivialCount,
      },
      totalRequests,
      estimatedSavings,
      averageConfidence: totalRequests > 0 ? this.totalConfidence / totalRequests : 0,
      reasonBreakdown: Object.fromEntries(this.reasonCounts) as Record<RoutingReasonCategory, number>,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.modelCounts.clear();
    this.totalConfidence = 0;
    this.reasonCounts.clear();
    this.eventLog = [];
  }

  /**
   * Get recent routing events
   */
  getRecentEvents(count: number = 100): RoutingEvent[] {
    return this.eventLog.slice(-count);
  }

  /**
   * Get current configuration
   */
  getConfig(): RouterConfig & { threshold: number; routerType: RouterType; debug: boolean } {
    return { ...this.config };
  }

  /**
   * Get model pair
   */
  getModelPair(): ModelPair {
    return { ...this.modelPair };
  }

  /**
   * Update threshold dynamically
   */
  setThreshold(threshold: number): void {
    if (threshold < 0 || threshold > 1) {
      throw new Error('Threshold must be between 0 and 1');
    }
    (this.config as { threshold: number }).threshold = threshold;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private calculateEstimatedCost(modelId: string, prompt: string): number | undefined {
    const tokenCount = Math.ceil(prompt.length / 4);

    // Try Bedrock first
    if (getBedrockModel(modelId)) {
      return calculateBedrockCost(modelId, tokenCount, tokenCount); // Estimate output = input
    }

    // Try OpenAI
    if (getOpenAIModel(modelId)) {
      return calculateOpenAICost(modelId, tokenCount, tokenCount);
    }

    return undefined;
  }

  private updateStats(result: RoutingResult): void {
    // Update model counts
    const count = this.modelCounts.get(result.model) || 0;
    this.modelCounts.set(result.model, count + 1);

    // Update confidence total
    this.totalConfidence += result.confidence;

    // Update reason counts
    const reasonCount = this.reasonCounts.get(result.reasonCategory) || 0;
    this.reasonCounts.set(result.reasonCategory, reasonCount + 1);
  }

  private logEvent(
    prompt: string,
    result: RoutingResult,
    context?: RoutingContext
  ): void {
    const event: RoutingEvent = {
      timestamp: new Date(),
      prompt: prompt.substring(0, 500), // Truncate for storage
      promptHash: this.hashString(prompt),
      result,
      context,
    };

    this.eventLog.push(event);

    // Trim log if too large
    if (this.eventLog.length > this.maxEventLogSize) {
      this.eventLog = this.eventLog.slice(-this.maxEventLogSize / 2);
    }
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Calibrate threshold based on target strong model percentage
   */
  static async calibrateThreshold(
    router: Router,
    sampleQueries: string[],
    targetStrongPercentage: number
  ): Promise<CalibrationResult> {
    if (sampleQueries.length === 0) {
      throw new Error('Sample queries required for calibration');
    }

    // Calculate win rates for all samples
    const winRates = await Promise.all(
      sampleQueries.map((q) => router.calculateStrongWinRate(q))
    );

    // Sort descending
    const sortedRates = [...winRates].sort((a, b) => b - a);

    // Find threshold at target percentile
    const targetIndex = Math.floor(sampleQueries.length * (targetStrongPercentage / 100));
    const threshold = sortedRates[Math.min(targetIndex, sortedRates.length - 1)];

    // Calculate actual percentage with this threshold
    const actualStrong = winRates.filter((r) => r >= threshold).length;
    const actualPercentage = (actualStrong / sampleQueries.length) * 100;

    // Calculate statistics
    const mean = winRates.reduce((a, b) => a + b, 0) / winRates.length;
    const sorted = [...winRates].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const p25 = sorted[Math.floor(sorted.length * 0.25)];
    const p75 = sorted[Math.floor(sorted.length * 0.75)];

    return {
      threshold,
      targetPercentage: targetStrongPercentage,
      actualPercentage,
      sampleSize: sampleQueries.length,
      winRateDistribution: {
        min: Math.min(...winRates),
        max: Math.max(...winRates),
        mean,
        median,
        p25,
        p75,
      },
    };
  }
}

// ============================================================================
// Factory Functions (5-Tier Routing)
// ============================================================================

/**
 * Create a Bedrock router with preset tier (5-tier routing)
 * 
 * @param preset - Model preset: 'premium' | 'costOptimized' | 'ultraCheap'
 * @param threshold - Unused in 5-tier, kept for API compatibility
 * @returns LLMRouterController configured for 5-tier Bedrock routing
 */
export function createBedrockRouter(
  preset: 'premium' | 'costOptimized' | 'ultraCheap' = 'costOptimized',
  threshold: number = 0.5
): LLMRouterController {
  const models = BedrockRoutingPairs[preset];
  return new LLMRouterController({
    endpoint: 'bedrock',
    models,
    threshold,
    routerType: 'rule-based',
  });
}

/**
 * Create an OpenAI router with preset tier (5-tier routing)
 */
export function createOpenAIRouter(
  preset: 'premium' | 'standard' | 'economy' = 'standard',
  threshold: number = 0.5
): LLMRouterController {
  const models = OpenAIRoutingPairs[preset];
  return new LLMRouterController({
    endpoint: 'openai',
    models,
    threshold,
    routerType: 'rule-based',
  });
}

/**
 * Create a custom router with specific 5-tier models
 */
export function createCustomRouter(
  endpoint: string,
  models: ModelPair,
  options?: {
    threshold?: number;
    routerType?: RouterConfig['routerType'];
  }
): LLMRouterController {
  return new LLMRouterController({
    endpoint,
    models,
    threshold: options?.threshold ?? 0.5,
    routerType: options?.routerType ?? 'rule-based',
  });
}
