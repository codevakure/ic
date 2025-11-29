/**
 * Bedrock Model Configurations
 * 
 * 6 SUPPORTED MODELS (by cost, low to high):
 * ==========================================
 * 1. Nova Micro   - $0.035/$0.14 MTok  - Trivial (greetings)
 * 2. Nova Lite    - $0.06/$0.24 MTok   - Simple (basic Q&A)
 * 3. Nova Pro     - $0.80/$3.20 MTok   - Moderate (reasoning)
 * 4. Haiku 4.5    - $1/$5 MTok         - Moderate (fast coding)
 * 5. Sonnet 4.5   - $3/$15 MTok        - Complex (code, analysis)
 * 6. Opus 4.5     - $5/$25 MTok        - Expert (most complex)
 *
 * Model ID Format: us.{provider}.{model}-v1:0 (US cross-region inference)
 */

import type { ModelConfig, ModelPair, BedrockPresetTier, ModelTier } from '../types';

/**
 * Bedrock model configurations - 6 models only
 */
export const BedrockModels: Record<string, ModelConfig> = {
  // ============================================================================
  // TRIVIAL TIER - Nova Micro ($0.035/$0.14 per MTok) - CHEAPEST
  // ============================================================================
  'us.amazon.nova-micro-v1:0': {
    id: 'us.amazon.nova-micro-v1:0',
    name: 'Amazon Nova Micro',
    tier: 'trivial',
    costPer1kTokens: { input: 0.000035, output: 0.00014 },
    maxTokens: 128000,
    capabilities: ['general', 'fast'],
    provider: 'amazon',
  },

  // ============================================================================
  // SIMPLE TIER - Nova Lite ($0.06/$0.24 per MTok)
  // ============================================================================
  'us.amazon.nova-lite-v1:0': {
    id: 'us.amazon.nova-lite-v1:0',
    name: 'Amazon Nova Lite',
    tier: 'simple',
    costPer1kTokens: { input: 0.00006, output: 0.00024 },
    maxTokens: 300000,
    capabilities: ['general', 'vision', 'video', 'fast'],
    provider: 'amazon',
  },

  // ============================================================================
  // MODERATE TIER - Nova Pro ($0.80/$3.20 per MTok) & Haiku 4.5 ($1/$5 per MTok)
  // ============================================================================
  'us.amazon.nova-pro-v1:0': {
    id: 'us.amazon.nova-pro-v1:0',
    name: 'Amazon Nova Pro',
    tier: 'moderate',
    costPer1kTokens: { input: 0.0008, output: 0.0032 },
    maxTokens: 300000,
    capabilities: ['general', 'vision', 'video', 'tools', 'analysis'],
    provider: 'amazon',
  },

  'us.anthropic.claude-haiku-4-5-20251001-v1:0': {
    id: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
    name: 'Claude Haiku 4.5',
    tier: 'moderate',
    costPer1kTokens: { input: 0.001, output: 0.005 },
    maxTokens: 200000,
    capabilities: ['general', 'coding', 'tools', 'fast', 'extended-thinking'],
    provider: 'anthropic',
  },

  // ============================================================================
  // COMPLEX TIER - Sonnet 4.5 ($3/$15 per MTok)
  // ============================================================================
  'us.anthropic.claude-sonnet-4-5-20250929-v1:0': {
    id: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
    name: 'Claude Sonnet 4.5',
    tier: 'complex',
    costPer1kTokens: { input: 0.003, output: 0.015 },
    maxTokens: 200000,
    capabilities: ['reasoning', 'coding', 'analysis', 'vision', 'tools', 'extended-thinking'],
    provider: 'anthropic',
  },

  // ============================================================================
  // EXPERT TIER - Opus 4.5 ($5/$25 per MTok) - MOST CAPABLE
  // ============================================================================
  'global.anthropic.claude-opus-4-5-20251101-v1:0': {
    id: 'global.anthropic.claude-opus-4-5-20251101-v1:0',
    name: 'Claude Opus 4.5',
    tier: 'expert',
    costPer1kTokens: { input: 0.005, output: 0.025 },
    maxTokens: 200000,
    capabilities: ['reasoning', 'coding', 'analysis', 'vision', 'tools', 'extended-thinking'],
    provider: 'anthropic',
  },
};

/**
 * 5-TIER ROUTING PRESETS
 * ======================
 * 
 * Score Range → Tier → Model
 * 0.80+ → expert   → Opus 4.5     ($5/$25)
 * 0.60+ → complex  → Sonnet 4.5   ($3/$15)
 * 0.35+ → moderate → Haiku 4.5    ($1/$5)
 * 0.15+ → simple   → Nova Pro     ($0.80/$3.20) - Can follow tool instructions
 * 0.00+ → trivial  → Nova Lite    ($0.06/$0.24) - Basic chat
 * 
 * NOTE: Nova Micro removed - cannot follow tool/system prompt instructions reliably
 */
export const BedrockRoutingPairs: Record<BedrockPresetTier, ModelPair> = {
  /**
   * Premium: Full 5-tier with Opus 4.5 at top
   * Best for: Production, customer-facing, quality-critical
   */
  premium: {
    expert: 'global.anthropic.claude-opus-4-5-20251101-v1:0',    // $5/$25 (global only)
    complex: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0', // $3/$15
    moderate: 'us.anthropic.claude-haiku-4-5-20251001-v1:0', // $1/$5
    simple: 'us.amazon.nova-pro-v1:0',                       // $0.80/$3.20 - Can follow tools
    trivial: 'us.amazon.nova-lite-v1:0',                     // $0.06/$0.24 - Basic chat only
  },

  /**
   * Cost Optimized: Sonnet 4.5 at top (no Opus)
   * Best for: Development, internal tools, balanced cost/quality
   */
  costOptimized: {
    expert: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',  // $3/$15
    complex: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0', // $3/$15
    moderate: 'us.anthropic.claude-haiku-4-5-20251001-v1:0', // $1/$5
    simple: 'us.amazon.nova-pro-v1:0',                       // $0.80/$3.20 - Can follow tools
    trivial: 'us.amazon.nova-lite-v1:0',                     // $0.06/$0.24 - Basic chat only
  },

  /**
   * Ultra Cheap: Haiku 4.5 at top (no Opus/Sonnet)
   * Best for: High-volume, cost-sensitive, simpler use cases
   */
  ultraCheap: {
    expert: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',   // $1/$5
    complex: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',  // $1/$5
    moderate: 'us.amazon.nova-pro-v1:0',                     // $0.80/$3.20
    simple: 'us.amazon.nova-pro-v1:0',                       // $0.80/$3.20
    trivial: 'us.amazon.nova-lite-v1:0',                     // $0.06/$0.24
  },
};

/**
 * Get model configuration by ID
 */
export function getBedrockModel(modelId: string): ModelConfig | undefined {
  return BedrockModels[modelId];
}

/**
 * Get all models for a specific tier
 */
export function getBedrockModelsByTier(tier: ModelTier): ModelConfig[] {
  return Object.values(BedrockModels).filter((model) => model.tier === tier);
}

/**
 * Get routing pair by preset
 */
export function getBedrockRoutingPair(preset: BedrockPresetTier): ModelPair {
  return BedrockRoutingPairs[preset];
}

/**
 * Calculate cost for a request
 */
export function calculateBedrockCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const model = BedrockModels[modelId];
  if (!model) return 0;

  return (
    (inputTokens / 1000) * model.costPer1kTokens.input +
    (outputTokens / 1000) * model.costPer1kTokens.output
  );
}

/**
 * Estimate cost savings between two models
 */
export function estimateCostSavings(
  expensiveModelId: string,
  cheapModelId: string,
  inputTokens: number,
  outputTokens: number
): { expensiveCost: number; cheapCost: number; savings: number; savingsPercent: number } {
  const expensiveCost = calculateBedrockCost(expensiveModelId, inputTokens, outputTokens);
  const cheapCost = calculateBedrockCost(cheapModelId, inputTokens, outputTokens);
  const savings = expensiveCost - cheapCost;
  const savingsPercent = expensiveCost > 0 ? (savings / expensiveCost) * 100 : 0;

  return { expensiveCost, cheapCost, savings, savingsPercent };
}
