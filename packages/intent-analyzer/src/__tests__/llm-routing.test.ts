/**
 * Tests for LLM Routing Module
 */

import {
  routeToLLM,
  modelSupportsCapabilities,
  getCheapestModel,
  getFastestModel,
  ModelCapability,
  ModelTier,
  TaskComplexity,
  ModelDefinition,
  LLMRoutingContext,
} from '../llm-routing';

import { AttachmentFile } from '../attachments/types';

describe('routeToLLM', () => {
  const mockModels: ModelDefinition[] = [
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      provider: 'openai',
      capabilities: [ModelCapability.TEXT, ModelCapability.FAST, ModelCapability.FUNCTION_CALLING],
      tier: ModelTier.ECONOMY,
      contextWindow: 128000,
      inputCostPer1K: 0.00015,
      outputCostPer1K: 0.0006,
      avgLatencyMs: 500,
    },
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      provider: 'openai',
      capabilities: [
        ModelCapability.TEXT,
        ModelCapability.VISION,
        ModelCapability.CODE,
        ModelCapability.REASONING,
        ModelCapability.FUNCTION_CALLING,
        ModelCapability.LONG_CONTEXT,
      ],
      tier: ModelTier.STANDARD,
      contextWindow: 128000,
      inputCostPer1K: 0.005,
      outputCostPer1K: 0.015,
      avgLatencyMs: 1000,
    },
    {
      id: 'claude-3-5-sonnet',
      name: 'Claude 3.5 Sonnet',
      provider: 'anthropic',
      capabilities: [
        ModelCapability.TEXT,
        ModelCapability.VISION,
        ModelCapability.CODE,
        ModelCapability.REASONING,
        ModelCapability.LONG_CONTEXT,
      ],
      tier: ModelTier.STANDARD,
      contextWindow: 200000,
      inputCostPer1K: 0.003,
      outputCostPer1K: 0.015,
      avgLatencyMs: 1200,
    },
    {
      id: 'claude-3-opus',
      name: 'Claude 3 Opus',
      provider: 'anthropic',
      capabilities: [
        ModelCapability.TEXT,
        ModelCapability.VISION,
        ModelCapability.CODE,
        ModelCapability.REASONING,
        ModelCapability.LONG_CONTEXT,
      ],
      tier: ModelTier.PREMIUM,
      contextWindow: 200000,
      inputCostPer1K: 0.015,
      outputCostPer1K: 0.075,
      avgLatencyMs: 2000,
    },
  ];

  it('should select economy model for simple queries', () => {
    const context: LLMRoutingContext = {
      query: 'What is 2 + 2?',
      availableModels: mockModels,
    };
    
    const result = routeToLLM(context);
    
    expect(result.selectedModel).not.toBeNull();
    expect(result.taskComplexity).toBe(TaskComplexity.SIMPLE);
    // Economy or standard should be preferred for simple tasks
    expect([ModelTier.ECONOMY, ModelTier.STANDARD]).toContain(result.selectedModel!.tier);
  });

  it('should select capable model for complex reasoning queries', () => {
    const context: LLMRoutingContext = {
      query: 'Analyze the pros and cons of different architectural patterns and explain step by step why microservices might be better for this use case',
      availableModels: mockModels,
    };
    
    const result = routeToLLM(context);
    
    expect(result.selectedModel).not.toBeNull();
    expect(result.taskComplexity).toBe(TaskComplexity.COMPLEX);
    expect(result.requiredCapabilities).toContain(ModelCapability.REASONING);
  });

  it('should require vision capability for image attachments', () => {
    const attachments: AttachmentFile[] = [
      {
        file_id: '1',
        filename: 'photo.jpg',
        mimetype: 'image/jpeg',
        size: 1000,
      },
    ];
    
    const context: LLMRoutingContext = {
      query: 'What is in this image?',
      availableModels: mockModels,
      attachments,
    };
    
    const result = routeToLLM(context);
    
    expect(result.selectedModel).not.toBeNull();
    expect(result.requiredCapabilities).toContain(ModelCapability.VISION);
    expect(result.selectedModel!.capabilities).toContain(ModelCapability.VISION);
  });

  it('should prefer cost-optimized model when optimizeForCost is true', () => {
    const context: LLMRoutingContext = {
      query: 'Write a simple hello world program',
      availableModels: mockModels,
      optimizeForCost: true,
    };
    
    const result = routeToLLM(context);
    
    expect(result.selectedModel).not.toBeNull();
    expect(result.selectedModel!.tier).toBe(ModelTier.ECONOMY);
  });

  it('should prefer fast model when optimizeForSpeed is true', () => {
    const context: LLMRoutingContext = {
      query: 'Quick question: what is the capital of France?',
      availableModels: mockModels,
      optimizeForSpeed: true,
    };
    
    const result = routeToLLM(context);
    
    expect(result.selectedModel).not.toBeNull();
    // Should prefer model with FAST capability
    expect(result.selectedModel!.capabilities).toContain(ModelCapability.FAST);
  });

  it('should respect preferred tier', () => {
    const context: LLMRoutingContext = {
      query: 'Explain quantum computing',
      availableModels: mockModels,
      preferredTier: ModelTier.PREMIUM,
    };
    
    const result = routeToLLM(context);
    
    expect(result.selectedModel).not.toBeNull();
    // Premium should be selected when preferred
    expect(result.selectedModel!.tier).toBe(ModelTier.PREMIUM);
  });

  it('should disqualify models with insufficient context window', () => {
    const smallContextModels: ModelDefinition[] = [
      {
        id: 'small-model',
        name: 'Small Context Model',
        provider: 'test',
        capabilities: [ModelCapability.TEXT],
        tier: ModelTier.ECONOMY,
        contextWindow: 4000,
      },
    ];
    
    const context: LLMRoutingContext = {
      query: 'Process this large document',
      availableModels: smallContextModels,
      estimatedTokens: 10000, // Exceeds context window
    };
    
    const result = routeToLLM(context);
    
    expect(result.selectedModel).toBeNull();
    expect(result.reasoning).toContain('No available models');
  });

  it('should provide fallback models', () => {
    const context: LLMRoutingContext = {
      query: 'Write some code',
      availableModels: mockModels,
    };
    
    const result = routeToLLM(context);
    
    expect(result.selectedModel).not.toBeNull();
    expect(result.fallbackModels.length).toBeGreaterThan(0);
  });

  it('should detect code capability requirement', () => {
    const context: LLMRoutingContext = {
      query: 'Debug this Python function and fix the algorithm',
      availableModels: mockModels,
    };
    
    const result = routeToLLM(context);
    
    expect(result.requiredCapabilities).toContain(ModelCapability.CODE);
  });
});

describe('modelSupportsCapabilities', () => {
  const model: ModelDefinition = {
    id: 'test',
    name: 'Test Model',
    provider: 'test',
    capabilities: [ModelCapability.TEXT, ModelCapability.CODE],
    tier: ModelTier.STANDARD,
    contextWindow: 8000,
  };

  it('should return true when all capabilities are supported', () => {
    expect(modelSupportsCapabilities(model, [ModelCapability.TEXT])).toBe(true);
    expect(modelSupportsCapabilities(model, [ModelCapability.TEXT, ModelCapability.CODE])).toBe(true);
  });

  it('should return false when capability is missing', () => {
    expect(modelSupportsCapabilities(model, [ModelCapability.VISION])).toBe(false);
    expect(modelSupportsCapabilities(model, [ModelCapability.TEXT, ModelCapability.VISION])).toBe(false);
  });
});

describe('getCheapestModel', () => {
  const models: ModelDefinition[] = [
    {
      id: 'expensive',
      name: 'Expensive',
      provider: 'test',
      capabilities: [ModelCapability.TEXT, ModelCapability.VISION],
      tier: ModelTier.PREMIUM,
      contextWindow: 8000,
      inputCostPer1K: 0.01,
    },
    {
      id: 'cheap',
      name: 'Cheap',
      provider: 'test',
      capabilities: [ModelCapability.TEXT],
      tier: ModelTier.ECONOMY,
      contextWindow: 8000,
      inputCostPer1K: 0.001,
    },
    {
      id: 'medium',
      name: 'Medium',
      provider: 'test',
      capabilities: [ModelCapability.TEXT, ModelCapability.VISION],
      tier: ModelTier.STANDARD,
      contextWindow: 8000,
      inputCostPer1K: 0.005,
    },
  ];

  it('should return cheapest model for basic requirements', () => {
    const result = getCheapestModel(models);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('cheap');
  });

  it('should return cheapest model with required capability', () => {
    const result = getCheapestModel(models, [ModelCapability.TEXT, ModelCapability.VISION]);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('medium'); // Cheap doesn't have vision
  });

  it('should return null if no model supports capabilities', () => {
    const result = getCheapestModel(models, [ModelCapability.REASONING]);
    expect(result).toBeNull();
  });
});

describe('getFastestModel', () => {
  const models: ModelDefinition[] = [
    {
      id: 'slow',
      name: 'Slow',
      provider: 'test',
      capabilities: [ModelCapability.TEXT],
      tier: ModelTier.STANDARD,
      contextWindow: 8000,
      avgLatencyMs: 2000,
    },
    {
      id: 'fast',
      name: 'Fast',
      provider: 'test',
      capabilities: [ModelCapability.TEXT, ModelCapability.FAST],
      tier: ModelTier.ECONOMY,
      contextWindow: 8000,
      avgLatencyMs: 500,
    },
    {
      id: 'medium',
      name: 'Medium',
      provider: 'test',
      capabilities: [ModelCapability.TEXT],
      tier: ModelTier.STANDARD,
      contextWindow: 8000,
      avgLatencyMs: 1000,
    },
  ];

  it('should return fastest model', () => {
    const result = getFastestModel(models);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('fast');
  });

  it('should prefer model with FAST capability', () => {
    const result = getFastestModel(models);
    expect(result!.capabilities).toContain(ModelCapability.FAST);
  });
});
