/**
 * Router exports
 */

export { Router } from './base';
export { RuleBasedRouter } from './rule-based';
export { RandomRouter } from './random';
export { HybridRouter, createEqualWeightHybrid } from './hybrid';
export type { RouterWeight } from './hybrid';

import { RuleBasedRouter } from './rule-based';
import { RandomRouter } from './random';
import { HybridRouter } from './hybrid';
import { Router } from './base';
import type { RouterType } from '../types';

/**
 * Router class registry
 */
export const RouterRegistry: Record<RouterType, new (...args: any[]) => Router> = {
  'rule-based': RuleBasedRouter,
  random: RandomRouter,
  hybrid: HybridRouter,
  // Fallbacks for unused types
  classifier: RuleBasedRouter,
  embedding: RuleBasedRouter,
};

/**
 * Create a router instance by type
 */
export function createRouter(type: RouterType): Router {
  const RouterClass = RouterRegistry[type];
  if (!RouterClass) {
    throw new Error(`Unknown router type: ${type}`);
  }
  return new RouterClass();
}
