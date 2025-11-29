# @librechat/llm-router

LLM routing framework for cost-optimized model selection. Routes queries across **5 tiers of models** based on complexity analysis using fast rule-based pattern matching. Reduces costs by 50-85% while maintaining quality.

## Features

- **5-Tier Routing**: Trivial → Simple → Moderate → Complex → Expert model tiers
- **Zero-Cost Routing**: Rule-based pattern matching with no API calls (~1-3ms per decision)
- **Full Model Utilization**: Uses ALL available models (Nova Micro/Lite/Pro, Haiku/Sonnet/Opus)
- **Provider Support**: Pre-configured for AWS Bedrock and OpenAI models
- **Statistics Tracking**: Monitor routing performance, tier distribution, and cost savings

## How It Works

The router analyzes the **user's message only** (not system prompts) and scores it from 0-1 based on:
- Code patterns (programming keywords, code blocks, debugging terms)
- Reasoning complexity (analytical questions, comparisons, system design)
- Mathematical content (equations, calculations)
- Query length, vocabulary complexity, and technical domain

### 5-Tier Score Mapping

| Score Range | Tier | Bedrock Model | Cost (Input/Output per MTok) |
|-------------|------|---------------|------------------------------|
| 0.80 - 1.00 | **Expert** | Opus 4.5 | $5 / $25 |
| 0.60 - 0.80 | **Complex** | Sonnet 4.5 | $3 / $15 |
| 0.35 - 0.60 | **Moderate** | Haiku 4.5 | $1 / $5 |
| 0.15 - 0.35 | **Simple** | Nova Lite | $0.06 / $0.24 |
| 0.00 - 0.15 | **Trivial** | Nova Micro | $0.035 / $0.14 |

**Examples:**
- "hello" → Score 0.00 → **Trivial** → Nova Micro
- "What is JavaScript?" → Score 0.10 → **Trivial** → Nova Micro  
- "Write a factorial function" → Score 0.33 → **Simple** → Nova Lite
- "Explain promises with examples" → Score 0.59 → **Moderate** → Haiku 4.5
- "Design a distributed system" → Score 0.74 → **Complex** → Sonnet 4.5
- "Build ML pipeline from scratch" → Score 0.90 → **Expert** → Opus 4.5

## Installation

```bash
npm install @librechat/llm-router
```

## Quick Start

### Basic Usage

```typescript
import { createBedrockRouter } from '@librechat/llm-router';

// Create a router (uses all 6 models across 5 tiers)
const router = createBedrockRouter();

// Route queries - automatically selects optimal model
const trivial = await router.route('hello');
console.log(trivial.model);  // 'us.amazon.nova-micro-v1:0' ($0.035/$0.14)
console.log(trivial.tier);   // 'trivial'

const simple = await router.route('What is JavaScript?');
console.log(simple.model);   // 'us.amazon.nova-lite-v1:0' ($0.06/$0.24)
console.log(simple.tier);    // 'simple'

const complex = await router.route('Design a scalable distributed system');
console.log(complex.model);  // 'us.anthropic.claude-sonnet-4-5-v1:0' ($3/$15)
console.log(complex.tier);   // 'complex'
```

### LibreChat Configuration (librechat.yaml)

```yaml
# Enable 5-tier automatic model routing based on query complexity
llmRouter:
  enabled: true
  preset: 'premium'  # Uses all 6 models: Opus → Sonnet → Haiku → Nova Pro → Nova Lite → Nova Micro
  debug: true        # Enable detailed logging (pattern matches, costs, savings)
  endpoints:
    bedrock:
      enabled: true
```

## Configuration

### 5-Tier Model Hierarchy (Bedrock)

All presets use these 6 models across 5 tiers:

| Tier | Model | Bedrock ID | Input $/MTok | Output $/MTok |
|------|-------|-----------|--------------|---------------|
| **Expert** | Opus 4.5 | `global.anthropic.claude-opus-4-5-20251101-v1:0` | $5.00 | $25.00 |
| **Complex** | Sonnet 4.5 | `us.anthropic.claude-sonnet-4-5-20250929-v1:0` | $3.00 | $15.00 |
| **Moderate** | Haiku 4.5 | `us.anthropic.claude-haiku-4-5-20251001-v1:0` | $1.00 | $5.00 |
| **Simple** | Nova Lite | `us.amazon.nova-lite-v1:0` | $0.06 | $0.24 |
| **Trivial** | Nova Micro | `us.amazon.nova-micro-v1:0` | $0.035 | $0.14 |

### Presets

Presets define the **ceiling model** (max model used):

| Preset | Ceiling | When to Use |
|--------|---------|-------------|
| `premium` | Opus 4.5 | Full power, best quality for complex tasks |
| `costOptimized` | Sonnet 4.5 | Balanced - skips expensive Opus |
| `ultraCheap` | Haiku 4.5 | Budget mode - no Sonnet/Opus |

```typescript
import { createBedrockRouter } from '@librechat/llm-router';

// Premium tier for production
const premiumRouter = createBedrockRouter('premium', 0.5);

// Ultra cheap for high volume
const cheapRouter = createBedrockRouter('ultraCheap', 0.6);
```

### OpenAI Presets

| Tier | Strong Model | Weak Model |
|------|--------------|------------|
| `premium` | GPT-4o | GPT-4o Mini |
| `standard` | GPT-4o | GPT-3.5 Turbo |
| `economy` | GPT-4o Mini | GPT-3.5 Turbo |

```typescript
import { createOpenAIRouter } from '@librechat/llm-router';

const router = createOpenAIRouter('standard', 0.5);
```

### Custom Models

```typescript
import { createCustomRouter } from '@librechat/llm-router';

const router = createCustomRouter('my-endpoint', 'strong-model-id', 'weak-model-id', {
  mediumModel: 'medium-model-id',
  threshold: 0.5,
  routerType: 'rule-based',
});
```

## Threshold Tuning

The threshold (0-1) controls the cost-quality tradeoff:

- **Lower threshold (0.3)**: More queries go to strong model → Higher quality, higher cost
- **Higher threshold (0.7)**: More queries go to weak model → Lower quality, lower cost

### Automatic Calibration

```typescript
import { LLMRouterController, RuleBasedRouter } from '@librechat/llm-router';

const router = new RuleBasedRouter();
const sampleQueries = [
  'Hello',
  'Write a complex algorithm',
  'What is the weather?',
  // ... more representative queries
];

// Find threshold for 40% strong model usage
const result = await LLMRouterController.calibrateThreshold(router, sampleQueries, 40);

console.log(`Recommended threshold: ${result.threshold}`);
console.log(`Win rate distribution:`, result.winRateDistribution);
```

## Routing Decision Factors

The rule-based router considers:

1. **Code Detection**: Code blocks, programming keywords, debugging terms
2. **Reasoning Complexity**: Analytical questions, comparisons, step-by-step requests
3. **Mathematical Content**: Equations, statistical terms, calculations
4. **Creative Writing**: Story/content generation requests
5. **Query Length**: Longer queries often need stronger models
6. **Technical Domain**: Specialized terminology boosts complexity
7. **Context**: Attachments, tools, conversation history

## Statistics & Monitoring

```typescript
// Get 5-tier routing statistics
const stats = router.getStats();

console.log(`Total requests: ${stats.totalRequests}`);
console.log(`Expert tier %: ${stats.expertPercentage.toFixed(1)}%`);
console.log(`Trivial tier %: ${stats.trivialPercentage.toFixed(1)}%`);
console.log(`Tier distribution:`, stats.tierCounts);
// { expert: 5, complex: 10, moderate: 25, simple: 30, trivial: 30 }
console.log(`Estimated savings: $${stats.estimatedSavings?.toFixed(4)}`);
console.log(`Average confidence: ${stats.averageConfidence.toFixed(3)}`);
console.log(`Reason breakdown:`, stats.reasonBreakdown);

// Get recent routing events
const events = router.getRecentEvents(50);

// Reset statistics
router.resetStats();
```

## Integration with Intent Analyzer

```typescript
import { createBedrockRouter } from '@librechat/llm-router';
import { IntentAnalyzer } from '@librechat/intent-analyzer';

const llmRouter = createBedrockRouter('costOptimized');
const intentAnalyzer = new IntentAnalyzer();

async function routeWithIntent(prompt: string, files?: any[]) {
  // Analyze intent first
  const intent = await intentAnalyzer.analyze(prompt, files);
  
  // Adjust threshold based on intent
  const intentThresholds = {
    code_generation: 0.3,
    simple_question: 0.8,
    default: 0.5,
  };
  
  const threshold = intentThresholds[intent.intent] ?? intentThresholds.default;
  llmRouter.setThreshold(threshold);
  
  return llmRouter.route(prompt, {
    attachments: files?.map(f => ({ type: f.type, name: f.name })),
  });
}
```

## API Reference

### LLMRouterController

```typescript
class LLMRouterController {
  // Route a single query
  route(prompt: string, context?: RoutingContext): Promise<RoutingResult>;
  
  // Route multiple queries
  routeBatch(prompts: string[], context?: RoutingContext): Promise<RoutingResult[]>;
  
  // Calculate win rate without routing
  calculateWinRate(prompt: string, context?: RoutingContext): Promise<number>;
  
  // Get routing statistics
  getStats(): RoutingStats;
  
  // Reset statistics
  resetStats(): void;
  
  // Get recent events
  getRecentEvents(count?: number): RoutingEvent[];
  
  // Update threshold
  setThreshold(threshold: number): void;
  
  // Get current config
  getConfig(): RouterConfig;
  
  // Get model pair
  getModelPair(): ModelPair;
}
```

### RoutingResult

```typescript
interface RoutingResult {
  model: string;                                              // Selected model ID
  tier: 'expert' | 'complex' | 'moderate' | 'simple' | 'trivial';  // 5-tier level
  confidence: number;                                         // Confidence score (0-1)
  reason: string;                                             // Human-readable reason
  reasonCategory: string;                                     // Category (code, reasoning, simple, etc.)
  strongWinRate: number;                                      // Calculated complexity score
  threshold: number;                                          // Applied threshold
  estimatedCost?: number;                                     // Estimated cost
  routingDurationMs?: number;                                 // Routing time in ms
}
```

### RoutingContext

```typescript
interface RoutingContext {
  attachments?: Attachment[];     // Attached files
  tools?: Tool[];                 // Available tools
  messageCount?: number;          // Conversation length
  previousModel?: string;         // Previously used model
  userPreference?: 'cost' | 'quality' | 'balanced';
  isContinuation?: boolean;       // Continue previous response
}
```

## Expected Cost Savings

Based on typical chat workloads:

| Scenario | Strong Model % | Estimated Savings |
|----------|---------------|-------------------|
| Aggressive cost | 20% | 70-80% |
| Balanced | 40% | 50-60% |
| Quality focused | 60% | 30-40% |

## License

MIT
