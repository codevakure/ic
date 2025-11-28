/**
 * LLM Routing Module
 * 
 * Intelligent LLM routing based on:
 * - Task complexity
 * - Required capabilities (vision, code, reasoning)
 * - Cost optimization
 * - Latency requirements
 * - Token limits
 */

import { AttachmentFile, FileCategory } from '../attachments/types';
import { categorizeFile } from '../attachments';

/**
 * Model capabilities
 */
export enum ModelCapability {
  /** Text generation */
  TEXT = 'text',
  /** Vision/image understanding */
  VISION = 'vision',
  /** Code generation and understanding */
  CODE = 'code',
  /** Advanced reasoning */
  REASONING = 'reasoning',
  /** Function/tool calling */
  FUNCTION_CALLING = 'function_calling',
  /** Long context window */
  LONG_CONTEXT = 'long_context',
  /** Fast response time */
  FAST = 'fast',
  /** JSON mode output */
  JSON_MODE = 'json_mode',
}

/**
 * Task complexity levels
 */
export enum TaskComplexity {
  SIMPLE = 'simple',
  MODERATE = 'moderate',
  COMPLEX = 'complex',
}

/**
 * Model tier for cost optimization
 */
export enum ModelTier {
  /** Cheapest, fastest, basic tasks */
  ECONOMY = 'economy',
  /** Balanced cost/performance */
  STANDARD = 'standard',
  /** Best performance, higher cost */
  PREMIUM = 'premium',
}

/**
 * Model definition
 */
export interface ModelDefinition {
  id: string;
  name: string;
  provider: string;
  capabilities: ModelCapability[];
  tier: ModelTier;
  contextWindow: number;
  /** Cost per 1K input tokens */
  inputCostPer1K?: number;
  /** Cost per 1K output tokens */
  outputCostPer1K?: number;
  /** Average latency in ms */
  avgLatencyMs?: number;
}

/**
 * Context for LLM routing
 */
export interface LLMRoutingContext {
  /** User's query */
  query: string;
  /** Available models */
  availableModels: ModelDefinition[];
  /** File attachments */
  attachments?: AttachmentFile[];
  /** Estimated input tokens */
  estimatedTokens?: number;
  /** Required capabilities */
  requiredCapabilities?: ModelCapability[];
  /** Preferred model tier */
  preferredTier?: ModelTier;
  /** Whether to optimize for cost */
  optimizeForCost?: boolean;
  /** Whether to optimize for speed */
  optimizeForSpeed?: boolean;
  /** Conversation context for complexity estimation */
  conversationContext?: string;
}

/**
 * Result of LLM routing
 */
export interface LLMRoutingResult {
  /** Selected model */
  selectedModel: ModelDefinition | null;
  /** Fallback models in priority order */
  fallbackModels: ModelDefinition[];
  /** Required capabilities detected */
  requiredCapabilities: ModelCapability[];
  /** Estimated task complexity */
  taskComplexity: TaskComplexity;
  /** Reasoning for selection */
  reasoning: string;
  /** Confidence score 0-1 */
  confidence: number;
}

/**
 * Complexity indicators in queries
 */
const COMPLEXITY_PATTERNS = {
  simple: [
    /^(hi|hello|hey|thanks|thank you|ok|okay|yes|no)\b/i,
    /^what (is|are) \w+\??$/i,
    /^(translate|convert|format)/i,
  ],
  complex: [
    /\b(analyze|compare|evaluate|assess|critique|review)\b/i,
    /\b(explain .* in detail|comprehensive|thorough)\b/i,
    /\b(step by step|walkthrough|break down)\b/i,
    /\b(optimize|improve|refactor|redesign)\b/i,
    /\b(multiple|several|various|different) .*(approach|solution|option)/i,
  ],
  reasoning: [
    /\b(why|reason|because|therefore|however|although)\b/i,
    /\b(logic|argument|proof|deduce|infer)\b/i,
    /\b(pros? and cons?|trade-?offs?|advantages? and disadvantages?)\b/i,
  ],
  code: [
    /\b(code|function|class|method|algorithm|implement|debug|fix)\b/i,
    /\b(python|javascript|typescript|java|c\+\+|rust|go)\b/i,
    /```[\s\S]*```/,
  ],
};

/**
 * Estimate task complexity from query
 */
function estimateComplexity(query: string, tokenCount?: number): TaskComplexity {
  // Simple patterns
  for (const pattern of COMPLEXITY_PATTERNS.simple) {
    if (pattern.test(query)) {
      return TaskComplexity.SIMPLE;
    }
  }

  // Complex patterns
  let complexScore = 0;
  for (const pattern of COMPLEXITY_PATTERNS.complex) {
    if (pattern.test(query)) {
      complexScore++;
    }
  }
  for (const pattern of COMPLEXITY_PATTERNS.reasoning) {
    if (pattern.test(query)) {
      complexScore++;
    }
  }

  // Token count affects complexity
  if (tokenCount && tokenCount > 2000) {
    complexScore++;
  }

  if (complexScore >= 2) {
    return TaskComplexity.COMPLEX;
  } else if (complexScore >= 1 || (tokenCount && tokenCount > 500)) {
    return TaskComplexity.MODERATE;
  }

  return TaskComplexity.SIMPLE;
}

/**
 * Detect required capabilities from context
 */
function detectRequiredCapabilities(
  query: string,
  attachments: AttachmentFile[] = []
): ModelCapability[] {
  const capabilities = new Set<ModelCapability>();

  // Always need text
  capabilities.add(ModelCapability.TEXT);

  // Check for vision needs from attachments
  for (const attachment of attachments) {
    const category = categorizeFile(attachment);
    if (category === FileCategory.IMAGE) {
      capabilities.add(ModelCapability.VISION);
      break;
    }
  }

  // Check for code needs
  for (const pattern of COMPLEXITY_PATTERNS.code) {
    if (pattern.test(query)) {
      capabilities.add(ModelCapability.CODE);
      break;
    }
  }

  // Check for reasoning needs
  for (const pattern of COMPLEXITY_PATTERNS.reasoning) {
    if (pattern.test(query)) {
      capabilities.add(ModelCapability.REASONING);
      break;
    }
  }

  // Check for function calling (tool use indicators)
  if (/\b(search|calculate|execute|run|call|use tool)\b/i.test(query)) {
    capabilities.add(ModelCapability.FUNCTION_CALLING);
  }

  return Array.from(capabilities);
}

/**
 * Score a model based on requirements
 */
function scoreModel(
  model: ModelDefinition,
  requiredCapabilities: ModelCapability[],
  complexity: TaskComplexity,
  context: LLMRoutingContext
): number {
  let score = 0;

  // Check required capabilities (must have all)
  const hasAllCapabilities = requiredCapabilities.every(
    cap => model.capabilities.includes(cap)
  );
  if (!hasAllCapabilities) {
    return -1; // Disqualify
  }

  // Base score from tier matching
  const tierScores: Record<ModelTier, Record<TaskComplexity, number>> = {
    [ModelTier.ECONOMY]: {
      [TaskComplexity.SIMPLE]: 10,
      [TaskComplexity.MODERATE]: 5,
      [TaskComplexity.COMPLEX]: 2,
    },
    [ModelTier.STANDARD]: {
      [TaskComplexity.SIMPLE]: 7,
      [TaskComplexity.MODERATE]: 10,
      [TaskComplexity.COMPLEX]: 7,
    },
    [ModelTier.PREMIUM]: {
      [TaskComplexity.SIMPLE]: 3,
      [TaskComplexity.MODERATE]: 7,
      [TaskComplexity.COMPLEX]: 10,
    },
  };
  score += tierScores[model.tier][complexity];

  // Bonus for preferred tier - high enough to override default scoring
  if (context.preferredTier && model.tier === context.preferredTier) {
    score += 15;
  }

  // Cost optimization
  if (context.optimizeForCost && model.tier === ModelTier.ECONOMY) {
    score += 3;
  }

  // Speed optimization
  if (context.optimizeForSpeed) {
    if (model.capabilities.includes(ModelCapability.FAST)) {
      score += 3;
    }
    if (model.tier === ModelTier.ECONOMY) {
      score += 2;
    }
  }

  // Context window check
  if (context.estimatedTokens && model.contextWindow < context.estimatedTokens) {
    return -1; // Disqualify - context too large
  }

  // Bonus for extra capabilities
  const extraCapabilities = model.capabilities.filter(
    cap => !requiredCapabilities.includes(cap)
  );
  score += extraCapabilities.length * 0.5;

  return score;
}

/**
 * Route to the best LLM based on context
 */
export function routeToLLM(context: LLMRoutingContext): LLMRoutingResult {
  const { query, availableModels, attachments = [] } = context;

  // Detect requirements
  const requiredCapabilities = context.requiredCapabilities || 
    detectRequiredCapabilities(query, attachments);
  
  const taskComplexity = estimateComplexity(query, context.estimatedTokens);

  const reasons: string[] = [];
  reasons.push(`Task complexity: ${taskComplexity}`);
  reasons.push(`Required capabilities: ${requiredCapabilities.join(', ')}`);

  // Score all models
  const scoredModels = availableModels
    .map(model => ({
      model,
      score: scoreModel(model, requiredCapabilities, taskComplexity, context),
    }))
    .filter(({ score }) => score >= 0) // Remove disqualified
    .sort((a, b) => b.score - a.score); // Sort by score descending

  if (scoredModels.length === 0) {
    return {
      selectedModel: null,
      fallbackModels: [],
      requiredCapabilities,
      taskComplexity,
      reasoning: 'No available models meet the requirements',
      confidence: 0,
    };
  }

  const selectedModel = scoredModels[0].model;
  const fallbackModels = scoredModels.slice(1, 4).map(({ model }) => model);

  reasons.push(`Selected ${selectedModel.name} (${selectedModel.provider}) - score: ${scoredModels[0].score.toFixed(1)}`);

  if (fallbackModels.length > 0) {
    reasons.push(`Fallbacks: ${fallbackModels.map(m => m.name).join(', ')}`);
  }

  // Calculate confidence based on score gap
  const scoreGap = scoredModels.length > 1
    ? scoredModels[0].score - scoredModels[1].score
    : scoredModels[0].score;
  const confidence = Math.min(0.95, 0.5 + (scoreGap * 0.05));

  return {
    selectedModel,
    fallbackModels,
    requiredCapabilities,
    taskComplexity,
    reasoning: reasons.join('. '),
    confidence,
  };
}

/**
 * Check if a model supports required capabilities
 */
export function modelSupportsCapabilities(
  model: ModelDefinition,
  capabilities: ModelCapability[]
): boolean {
  return capabilities.every(cap => model.capabilities.includes(cap));
}

/**
 * Get the cheapest model that supports capabilities
 */
export function getCheapestModel(
  models: ModelDefinition[],
  requiredCapabilities: ModelCapability[] = [ModelCapability.TEXT]
): ModelDefinition | null {
  const eligible = models.filter(m => 
    modelSupportsCapabilities(m, requiredCapabilities)
  );

  if (eligible.length === 0) return null;

  // Sort by tier (economy first), then by cost if available
  eligible.sort((a, b) => {
    const tierOrder = { [ModelTier.ECONOMY]: 0, [ModelTier.STANDARD]: 1, [ModelTier.PREMIUM]: 2 };
    const tierDiff = tierOrder[a.tier] - tierOrder[b.tier];
    if (tierDiff !== 0) return tierDiff;

    // If same tier, sort by cost
    const aCost = (a.inputCostPer1K || 0) + (a.outputCostPer1K || 0);
    const bCost = (b.inputCostPer1K || 0) + (b.outputCostPer1K || 0);
    return aCost - bCost;
  });

  return eligible[0];
}

/**
 * Get the fastest model that supports capabilities
 */
export function getFastestModel(
  models: ModelDefinition[],
  requiredCapabilities: ModelCapability[] = [ModelCapability.TEXT]
): ModelDefinition | null {
  const eligible = models.filter(m => 
    modelSupportsCapabilities(m, requiredCapabilities)
  );

  if (eligible.length === 0) return null;

  // Sort by latency, then by FAST capability
  eligible.sort((a, b) => {
    const aFast = a.capabilities.includes(ModelCapability.FAST) ? 0 : 1;
    const bFast = b.capabilities.includes(ModelCapability.FAST) ? 0 : 1;
    if (aFast !== bFast) return aFast - bFast;

    return (a.avgLatencyMs || Infinity) - (b.avgLatencyMs || Infinity);
  });

  return eligible[0];
}

export default {
  routeToLLM,
  modelSupportsCapabilities,
  getCheapestModel,
  getFastestModel,
  estimateComplexity,
  detectRequiredCapabilities,
  ModelCapability,
  ModelTier,
  TaskComplexity,
};
