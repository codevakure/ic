/**
 * OpenAI Model Configurations
 * Pricing and capabilities for OpenAI models
 */

import type { ModelConfig, ModelPair, OpenAIPresetTier, ModelTier } from '../types';

/**
 * Complete OpenAI model configurations
 */
export const OpenAIModels: Record<string, ModelConfig> = {
  // ============================================================================
  // EXPERT/COMPLEX TIER - Complex reasoning, coding, analysis
  // ============================================================================

  'gpt-4o': {
    id: 'gpt-4o',
    name: 'GPT-4o',
    tier: 'complex',
    costPer1kTokens: { input: 0.005, output: 0.015 },
    maxTokens: 128000,
    capabilities: ['reasoning', 'coding', 'analysis', 'vision', 'tools'],
    provider: 'openai',
  },

  'gpt-4-turbo': {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    tier: 'complex',
    costPer1kTokens: { input: 0.01, output: 0.03 },
    maxTokens: 128000,
    capabilities: ['reasoning', 'coding', 'analysis', 'vision', 'tools'],
    provider: 'openai',
  },

  'o1-preview': {
    id: 'o1-preview',
    name: 'o1 Preview',
    tier: 'expert',
    costPer1kTokens: { input: 0.015, output: 0.06 },
    maxTokens: 128000,
    capabilities: ['reasoning', 'coding', 'analysis', 'math'],
    provider: 'openai',
  },

  // ============================================================================
  // MODERATE TIER - Balanced performance
  // ============================================================================

  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    tier: 'moderate',
    costPer1kTokens: { input: 0.00015, output: 0.0006 },
    maxTokens: 128000,
    capabilities: ['general', 'coding', 'vision', 'tools', 'fast'],
    provider: 'openai',
  },

  'o1-mini': {
    id: 'o1-mini',
    name: 'o1 Mini',
    tier: 'moderate',
    costPer1kTokens: { input: 0.003, output: 0.012 },
    maxTokens: 128000,
    capabilities: ['reasoning', 'coding', 'math'],
    provider: 'openai',
  },

  // ============================================================================
  // SIMPLE TIER - Simple queries, chat, fast responses
  // ============================================================================

  'gpt-3.5-turbo': {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    tier: 'simple',
    costPer1kTokens: { input: 0.0005, output: 0.0015 },
    maxTokens: 16385,
    capabilities: ['general', 'fast'],
    provider: 'openai',
  },

  'gpt-3.5-turbo-0125': {
    id: 'gpt-3.5-turbo-0125',
    name: 'GPT-3.5 Turbo 0125',
    tier: 'simple',
    costPer1kTokens: { input: 0.0005, output: 0.0015 },
    maxTokens: 16385,
    capabilities: ['general', 'fast'],
    provider: 'openai',
  },
};

/**
 * Pre-configured model pairs for 4-tier routing
 */
export const OpenAIRoutingPairs: Record<OpenAIPresetTier, ModelPair> = {
  /**
   * Premium tier: Full GPT-4 family with o1 for expert
   */
  premium: {
    expert: 'o1-preview',
    complex: 'gpt-4o',
    moderate: 'gpt-4o-mini',
    simple: 'gpt-3.5-turbo-0125',
  },

  /**
   * Standard tier: Balanced cost/quality
   */
  standard: {
    expert: 'gpt-4o',
    complex: 'gpt-4o',
    moderate: 'gpt-4o-mini',
    simple: 'gpt-3.5-turbo-0125',
  },

  /**
   * Economy tier: Maximum cost savings
   */
  economy: {
    expert: 'gpt-4o-mini',
    complex: 'gpt-4o-mini',
    moderate: 'gpt-4o-mini',
    simple: 'gpt-3.5-turbo-0125',
  },
};

/**
 * Get model configuration by ID
 */
export function getOpenAIModel(modelId: string): ModelConfig | undefined {
  return OpenAIModels[modelId];
}

/**
 * Get all models for a specific tier
 */
export function getOpenAIModelsByTier(tier: ModelTier): ModelConfig[] {
  return Object.values(OpenAIModels).filter((model) => model.tier === tier);
}

/**
 * Get routing pair by preset tier
 */
export function getOpenAIRoutingPair(tier: OpenAIPresetTier): ModelPair {
  return OpenAIRoutingPairs[tier];
}

/**
 * Get model ID for a specific tier from a preset
 */
export function getOpenAIModelForTier(tier: ModelTier, preset: OpenAIPresetTier = 'standard'): string {
  return OpenAIRoutingPairs[preset][tier];
}

/**
 * Calculate cost for a request
 */
export function calculateOpenAICost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const model = OpenAIModels[modelId];
  if (!model) {
    return 0;
  }

  return (
    (inputTokens / 1000) * model.costPer1kTokens.input +
    (outputTokens / 1000) * model.costPer1kTokens.output
  );
}
