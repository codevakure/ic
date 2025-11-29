/**
 * Random Router
 * Randomly routes to either model - useful for A/B testing and baselines.
 */

import { Router } from './base';
import type { RoutingContext, RoutingReasonCategory } from '../types';

/**
 * Random router for baseline comparisons and A/B testing
 */
export class RandomRouter extends Router {
  public readonly name = 'random';
  public readonly parallelSafe = false; // Non-deterministic

  private readonly bias: number;

  /**
   * Create a random router
   * @param bias - Bias toward strong model (0-1). Default 0.5 = equal chance.
   */
  constructor(bias: number = 0.5) {
    super();
    this.bias = Math.max(0, Math.min(1, bias));
  }

  /**
   * Returns a random value between 0 and 1
   */
  async calculateStrongWinRate(_prompt: string, _context?: RoutingContext): Promise<number> {
    // Apply bias: if bias is 0.7, we want 70% chance of strong
    // We return a value that, when compared to threshold 0.5, gives us the right bias
    return Math.random() < this.bias ? 0.6 + Math.random() * 0.4 : Math.random() * 0.4;
  }

  protected getRoutingReason(): { reason: string; category: RoutingReasonCategory } {
    return { reason: 'Random selection for A/B testing', category: 'random' };
  }
}
