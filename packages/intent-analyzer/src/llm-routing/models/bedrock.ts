/**
 * Bedrock Model Configurations
 * 
 * 4-TIER ROUTING SYSTEM (target distribution):
 * =============================================
 * 1. Nova Micro   - $0.035/$0.14 per 1K tok  - SIMPLE   (~1%)  - Greetings, text-only simple responses
 * 2. Haiku 4.5    - $1/$5 per 1K tok         - MODERATE (~80%) - Most tasks, tool usage, standard code
 * 3. Sonnet 4.5   - $3/$15 per 1K tok        - COMPLEX  (~15%) - Debugging, detailed analysis
 * 4. Opus 4.5     - $5/$25 per 1K tok        - EXPERT   (~4%)  - Deep analysis, architecture, research
 *
 * Alternative Models:
 * - Nova Lite     - $0.06/$0.24 per 1K tok   - Multimodal (image/video) capable
 * - Nova Pro      - $0.80/$3.20 per 1K tok   - Multimodal with better quality
 *
 * ROUTING RULES:
 * - ANY tool usage (web_search, execute_code, file_search, artifacts) → Haiku 4.5 minimum
 * - Deep/comprehensive analysis requests → Opus 4.5
 * - Text-only simple queries (greetings, yes/no) → Nova Micro
 *
 * Model ID Format: us.{provider}.{model}-v1:0 (US cross-region inference)
 */

import type { ModelConfig, ModelPair, BedrockPresetTier, ModelTier } from '../types';

/**
 * Bedrock model configurations - 4 models for 4-tier routing
 */
export const BedrockModels: Record<string, ModelConfig> = {
  // ============================================================================
  // SIMPLE TIER (~1%) - Nova Micro ($0.035/$0.14 per MTok) - CHEAPEST
  // Simple greetings, yes/no, acknowledgments - TEXT ONLY, no tools
  // ============================================================================
  'us.amazon.nova-micro-v1:0': {
    id: 'us.amazon.nova-micro-v1:0',
    name: 'Amazon Nova Micro',
    tier: 'simple',
    costPer1kTokens: { input: 0.000035, output: 0.00014 },
    maxTokens: 128000,
    capabilities: ['general', 'fast'],
    provider: 'amazon',
  },

  // ============================================================================
  // MODERATE TIER (~80%) - Haiku 4.5 ($1/$5 per MTok)
  // Most tasks: explanations, standard code, tool usage
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
  // Nova Lite ($0.06/$0.24 per 1K tok) - Alternative cheap model
  // ============================================================================
  'us.amazon.nova-lite-v1:0': {
    id: 'us.amazon.nova-lite-v1:0',
    name: 'Amazon Nova Lite',
    tier: 'simple',
    costPer1kTokens: { input: 0.00006, output: 0.00024 },
    maxTokens: 300000,
    capabilities: ['general', 'fast', 'vision', 'video'],
    provider: 'amazon',
  },

  // ============================================================================
  // Nova Pro ($0.80/$3.20 per MTok) - Multimodal capable
  // ============================================================================
  'us.amazon.nova-pro-v1:0': {
    id: 'us.amazon.nova-pro-v1:0',
    name: 'Amazon Nova Pro',
    tier: 'moderate',
    costPer1kTokens: { input: 0.0008, output: 0.0032 },
    maxTokens: 300000,
    capabilities: ['general', 'coding', 'tools', 'vision', 'video'],
    provider: 'amazon',
  },

  // ============================================================================
  // COMPLEX TIER (~15%) - Sonnet 4.5 ($3/$15 per MTok)
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
  // EXPERT TIER (~4%) - Opus 4.5 ($5/$25 per MTok) - MOST CAPABLE
  // Deep analysis, system architecture, research
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
 * 4-TIER ROUTING PRESETS
 * ======================
 * 
 * Target Distribution: Simple ~1%, Moderate ~80%, Complex ~15%, Expert ~4%
 * 
 * Score Range → Tier → Model
 * 0.85+ → expert   → Opus 4.5     ($15/$75)     - Deep analysis, architecture, research
 * 0.55+ → complex  → Sonnet 4.5   ($3/$15)      - Debugging, detailed analysis
 * 0.10+ → moderate → Haiku 4.5    ($1/$5)       - Most tasks, tool usage, standard code
 * 0.00+ → simple   → Nova Micro   ($0.035/$0.14) - Greetings, text-only simple responses
 */
export const BedrockRoutingPairs: Record<BedrockPresetTier, ModelPair> = {
  /**
   * Premium: Full 4-tier with Opus 4.5 at top
   * Best for: Production, customer-facing, quality-critical
   */
  premium: {
    expert: 'global.anthropic.claude-opus-4-5-20251101-v1:0',
    complex: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
    moderate: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
    simple: 'us.amazon.nova-micro-v1:0',
  },

  /**
   * Cost Optimized: Sonnet 4.5 at top (no Opus)
   * Best for: Development, internal tools, balanced cost/quality
   */
  costOptimized: {
    expert: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
    complex: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
    moderate: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
    simple: 'us.amazon.nova-micro-v1:0',
  },

  /**
   * Ultra Cheap: Haiku 4.5 at top (no Opus/Sonnet)
   * Best for: High-volume, cost-sensitive, simpler use cases
   */
  ultraCheap: {
    expert: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
    complex: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
    moderate: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
    simple: 'us.amazon.nova-micro-v1:0',
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
