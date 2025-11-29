/**
 * Model configurations index
 */

export * from './bedrock';
export * from './openai';

import { BedrockModels, BedrockRoutingPairs } from './bedrock';
import { OpenAIModels, OpenAIRoutingPairs } from './openai';
import type { ModelConfig, ModelPair, ModelTier } from '../types';

/**
 * All available models across providers
 */
export const AllModels: Record<string, ModelConfig> = {
  ...BedrockModels,
  ...OpenAIModels,
};

/**
 * All routing pairs across providers
 */
export const AllRoutingPairs: Record<string, Record<string, ModelPair>> = {
  bedrock: BedrockRoutingPairs,
  openai: OpenAIRoutingPairs,
};

/**
 * Get model config by ID from any provider
 */
export function getModel(modelId: string): ModelConfig | undefined {
  return AllModels[modelId];
}

/**
 * Get model tier
 */
export function getModelTier(modelId: string): ModelTier | undefined {
  const model = getModel(modelId);
  return model?.tier;
}

/**
 * Calculate cost for any model
 */
export function calculateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const model = AllModels[modelId];
  if (!model) {
    return 0;
  }

  return (
    (inputTokens / 1000) * model.costPer1kTokens.input +
    (outputTokens / 1000) * model.costPer1kTokens.output
  );
}
