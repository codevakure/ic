/**
 * Bedrock Model Configurations
 * 
 * 5-TIER ROUTING SYSTEM (by cost, low to high):
 * =============================================
 * 1. Nova Lite    - $0.06/$0.24 MTok   - TRIVIAL  (greetings, yes/no, acknowledgments, multimodal)
 * 2. Nova Pro     - $0.80/$3.20 MTok   - SIMPLE   (basic Q&A, simple tools)
 * 3. Haiku 4.5    - $1/$5 MTok         - MODERATE (explanations, standard code)
 * 4. Sonnet 4.5   - $3/$15 MTok        - COMPLEX  (debugging, analysis)
 * 5. Opus 4.5     - $15/$75 MTok       - EXPERT   (architecture, research)
 *
 * Note: Nova Micro is used ONLY for classifierModel (internal routing), NOT for user-facing responses.
 *
 * Model ID Format: us.{provider}.{model}-v1:0 (US cross-region inference)
 */

import type { ModelConfig, ModelPair, BedrockPresetTier, ModelTier } from '../types';

/**
 * Bedrock model configurations - 5 models for 5-tier routing
 * Nova Micro excluded from routing (only for classification)
 */
export const BedrockModels: Record<string, ModelConfig> = {
  // ============================================================================
  // TRIVIAL TIER - Nova Lite ($0.06/$0.24 per MTok) - CHEAPEST for routing
  // Simple greetings, yes/no, acknowledgments, basic image understanding
  // ============================================================================
  'us.amazon.nova-lite-v1:0': {
    id: 'us.amazon.nova-lite-v1:0',
    name: 'Amazon Nova Lite',
    tier: 'trivial',
    costPer1kTokens: { input: 0.00006, output: 0.00024 },
    maxTokens: 300000,
    capabilities: ['general', 'vision', 'tools', 'multimodal'],
    provider: 'amazon',
  },

  // ============================================================================
  // SIMPLE TIER - Nova Pro ($0.80/$3.20 per MTok)
  // Basic Q&A, simple tool usage, straightforward tasks
  // ============================================================================
  'us.amazon.nova-pro-v1:0': {
    id: 'us.amazon.nova-pro-v1:0',
    name: 'Amazon Nova Pro',
    tier: 'simple',
    costPer1kTokens: { input: 0.0008, output: 0.0032 },
    maxTokens: 300000,
    capabilities: ['general', 'vision', 'video', 'tools', 'analysis'],
    provider: 'amazon',
  },

  // ============================================================================
  // MODERATE TIER - Haiku 4.5 ($1/$5 per MTok)
  // Explanations, summaries, standard code generation
  // ============================================================================
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
  // Debugging, code review, detailed analysis
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
  // EXPERT TIER - Opus 4.5 ($15/$75 per MTok) - MOST CAPABLE
  // System architecture, algorithm design, PhD-level research
  // ============================================================================
  'global.anthropic.claude-opus-4-5-20251101-v1:0': {
    id: 'global.anthropic.claude-opus-4-5-20251101-v1:0',
    name: 'Claude Opus 4.5',
    tier: 'expert',
    costPer1kTokens: { input: 0.015, output: 0.075 },
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
 * 0.80+ → expert   → Opus 4.5     ($15/$75)     - Architecture, research
 * 0.60+ → complex  → Sonnet 4.5   ($3/$15)      - Debugging, analysis
 * 0.35+ → moderate → Haiku 4.5    ($1/$5)       - Explanations, standard code
 * 0.15+ → simple   → Nova Pro     ($0.80/$3.20) - Basic Q&A, simple tools
 * 0.00+ → trivial  → Nova Lite    ($0.06/$0.24) - Greetings, yes/no, acknowledgments
 * 
 * Note: Nova Micro is used ONLY for classifierModel, not in routing.
 */
export const BedrockRoutingPairs: Record<BedrockPresetTier, ModelPair> = {
  /**
   * Premium: Full 5-tier with Opus 4.5 at top
   * Best for: Production, customer-facing, quality-critical
   */
  premium: {
    expert: 'global.anthropic.claude-opus-4-5-20251101-v1:0',
    complex: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
    moderate: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
    simple: 'us.amazon.nova-pro-v1:0',
    trivial: 'us.amazon.nova-lite-v1:0',
  },

  /**
   * Cost Optimized: Sonnet 4.5 at top (no Opus)
   * Best for: Development, internal tools, balanced cost/quality
   */
  costOptimized: {
    expert: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
    complex: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
    moderate: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
    simple: 'us.amazon.nova-pro-v1:0',
    trivial: 'us.amazon.nova-lite-v1:0',
  },

  /**
   * Ultra Cheap: Haiku 4.5 at top (no Opus/Sonnet)
   * Best for: High-volume, cost-sensitive, simpler use cases
   */
  ultraCheap: {
    expert: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
    complex: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
    moderate: 'us.amazon.nova-pro-v1:0',
    simple: 'us.amazon.nova-lite-v1:0',
    trivial: 'us.amazon.nova-lite-v1:0',
  },
};

/**
 * Default classifier model - cheapest for classification
 */
export const CLASSIFIER_MODEL = 'us.amazon.nova-micro-v1:0';

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
 * Get model ID for a specific tier from a preset
 */
export function getModelForTier(tier: ModelTier, preset: BedrockPresetTier = 'costOptimized'): string {
  return BedrockRoutingPairs[preset][tier];
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
