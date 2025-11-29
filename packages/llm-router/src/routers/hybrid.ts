/**
 * Hybrid Router
 * Combines multiple routing strategies for better accuracy.
 */

import { Router } from './base';
import type { RoutingContext } from '../types';

/**
 * Weight configuration for combining routers
 */
export interface RouterWeight {
  router: Router;
  weight: number;
}

/**
 * Hybrid router that combines multiple routing strategies
 */
export class HybridRouter extends Router {
  public readonly name = 'hybrid';
  public readonly parallelSafe: boolean;

  private readonly routers: RouterWeight[];
  private readonly totalWeight: number;

  /**
   * Create a hybrid router
   * @param routers - Array of routers with weights
   */
  constructor(routers: RouterWeight[]) {
    super();
    this.routers = routers;
    this.totalWeight = routers.reduce((sum, r) => sum + r.weight, 0);
    this.parallelSafe = routers.every((r) => r.router.parallelSafe);
  }

  /**
   * Calculate weighted average of all router scores
   */
  async calculateStrongWinRate(prompt: string, context?: RoutingContext): Promise<number> {
    const scores = await Promise.all(
      this.routers.map(async ({ router, weight }) => {
        const score = await router.calculateStrongWinRate(prompt, context);
        return score * weight;
      })
    );

    const weightedSum = scores.reduce((sum, score) => sum + score, 0);
    return weightedSum / this.totalWeight;
  }
}

/**
 * Create a hybrid router from multiple routers with equal weights
 */
export function createEqualWeightHybrid(routers: Router[]): HybridRouter {
  const weight = 1 / routers.length;
  return new HybridRouter(routers.map((router) => ({ router, weight })));
}
