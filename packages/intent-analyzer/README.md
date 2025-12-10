# @ranger/intent-analyzer

Unified intent analyzer for Ranger that handles **both tool selection AND model routing** in a single package.

## Overview

This package provides intelligent routing for:

1. **Tool Selection** - Which tools to use (web_search, execute_code, file_search, artifacts)
2. **Model Routing** - Which model tier to use (simple → expert)
3. **Upload Intent** - Where to upload files (IMAGE, FILE_SEARCH, CODE_INTERPRETER)

All in **ONE call** with optional LLM fallback for edge cases.

## 3-Tier Model Routing

| Tier | Score Range | Model | Use Case |
|------|-------------|-------|---------|
| SIMPLE | 0.00-0.10 | Nova Micro | Basic greetings, simple text-only responses |
| MODERATE | 0.10-0.55 | Haiku 4.5 | Most tasks, tool usage, standard coding |
| COMPLEX/EXPERT | 0.55+ | Sonnet 4.5 | Debugging, detailed analysis, architecture |

> **Note**: Nova Micro is used for simple tier AND `titleModel`/`classifierModel`. For any tool usage, Haiku 4.5 minimum is enforced.

## Installation

```bash
npm install @ranger/intent-analyzer
```

## Quick Start

### Universal Routing (Recommended)

Get both tools AND model in one call:

```typescript
import { routeQuery, Tool } from '@ranger/intent-analyzer';

const result = await routeQuery('What are booming stocks today?', {
  provider: 'bedrock',
  preset: 'costOptimized',
  availableTools: [Tool.WEB_SEARCH, Tool.CODE_INTERPRETER],
});

console.log(result.tools);  // ['web_search']
console.log(result.model);  // 'us.anthropic.claude-haiku-4-5-20251001-v1:0'
console.log(result.tier);   // 'moderate'
console.log(result.reason); // 'Query needs real-time data with tool usage'
```

### With LLM Fallback

For queries that don't match regex patterns, use an LLM to classify:

```typescript
import { routeQuery, Tool } from '@ranger/intent-analyzer';

const result = await routeQuery('Find me trending tech stocks', {
  provider: 'bedrock',
  preset: 'premium',
  availableTools: [Tool.WEB_SEARCH, Tool.CODE_INTERPRETER],
  llmFallback: async (prompt) => {
    // Call Nova Micro (cheapest) for classification
    return await callNovaMicro(prompt);
  },
});

console.log(result.usedLlmFallback); // true if LLM was needed
```

## Routing Flow

```
Query comes in
     ↓
┌─────────────────────────────────────┐
│ 1. Try REGEX patterns (FREE, fast) │
│    - Tool patterns → which tools   │
│    - Complexity patterns → tier    │
└─────────────────────────────────────┘
     ↓
Confidence high? ──YES──→ Return result (no LLM cost)
     ↓ NO
┌─────────────────────────────────────┐
│ 2. LLM Fallback (ONE call)         │
│    - Classifies BOTH tools + tier  │
│    - Uses cheapest model (Micro)   │
└─────────────────────────────────────┘
     ↓
Return result
```

## API Reference

### Main Functions

#### `routeQuery(query, config)`

Universal routing - returns both tools and model.

```typescript
const result = await routeQuery(query, {
  provider: 'bedrock' | 'openai',
  preset: 'premium' | 'costOptimized' | 'ultraCheap',
  availableTools: Tool[],
  llmFallback?: (prompt: string) => Promise<string>,
  fallbackThreshold?: number, // default: 0.4
});

// Returns:
{
  tools: Tool[],           // Selected tools
  model: string,           // Model ID to use
  tier: ModelTier,         // 'simple' | 'moderate' | 'complex' | 'expert'
  confidence: number,      // 0-1 confidence score
  reason: string,          // Explanation
  usedLlmFallback: boolean // Whether LLM was used
}
```

#### `analyzeQuery(options)`

Lower-level analysis - returns detailed results.

```typescript
const result = await analyzeQuery({
  query: 'Calculate sales totals',
  availableTools: [Tool.CODE_INTERPRETER],
  llmFallback: async (p) => callNovaMicro(p),
});

// Returns:
{
  tools: QueryIntentResult,  // Detailed tool selection
  model: ModelRoutingResult, // Detailed model routing
  usedLlmFallback: boolean
}
```

#### `getModelForTier(tier, preset?)`

Get model ID for a specific tier.

```typescript
import { getModelForTier } from '@ranger/intent-analyzer';

getModelForTier('simple');              // 'us.amazon.nova-micro-v1:0'
getModelForTier('complex', 'premium');  // 'us.anthropic.claude-sonnet-4-5-20250929-v1:0'
getModelForTier('moderate');            // 'us.anthropic.claude-haiku-4-5-20251001-v1:0'
```

### Upload Intent

Analyze files for upload routing:

```typescript
import { analyzeUploadIntent, UploadIntent } from '@ranger/intent-analyzer';

const result = analyzeUploadIntent({
  filename: 'data.xlsx',
  mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
});

console.log(result.intent); // UploadIntent.CODE_INTERPRETER
```

### Tool Selection Only

```typescript
import { analyzeQueryIntent, Tool } from '@ranger/intent-analyzer';

const result = analyzeQueryIntent({
  query: 'Search the web for latest news',
  availableTools: [Tool.WEB_SEARCH, Tool.FILE_SEARCH],
});

console.log(result.tools);      // [Tool.WEB_SEARCH]
console.log(result.confidence); // 0.85
```

### Model Routing Only

```typescript
import { scoreQueryComplexity } from '@ranger/intent-analyzer';

const result = scoreQueryComplexity('Design a microservices architecture');

console.log(result.tier);       // 'expert'
console.log(result.score);      // 0.85
console.log(result.categories); // ['code', 'reasoning']
```

## Configuration

### Presets

| Preset | Expert/Complex | Moderate | Simple |
|--------|----------------|----------|--------|
| `premium` | Sonnet 4.5 | Haiku 4.5 | Nova Micro |
| `costOptimized` | Sonnet 4.5 | Haiku 4.5 | Nova Micro |
| `ultraCheap` | Haiku 4.5 | Haiku 4.5 | Nova Micro |

> **Note**: Only 3 models are used: Nova Micro, Claude Haiku 4.5, and Claude Sonnet 4.5.

### ranger.yaml Configuration

```yaml
intentAnalyzer:
  autoToolSelection: true   # Smart tool selection based on query
  modelRouting: true        # 3-tier model routing based on complexity
  preset: 'premium'         # or 'costOptimized' or 'ultraCheap'
  debug: true               # Enable detailed logging
  endpoints:
    bedrock:
      enabled: true
      classifierModel: 'us.amazon.nova-micro-v1:0'  # For classification and simple tier
```

## Tools

| Tool | Description |
|------|-------------|
| `WEB_SEARCH` | Search the internet for current information |
| `CODE_INTERPRETER` | Execute code, analyze data, create charts |
| `FILE_SEARCH` | Search through uploaded documents (RAG) |
| `ARTIFACTS` | Create interactive UI components |

## Constants

```typescript
import { CLASSIFIER_MODEL } from '@ranger/intent-analyzer';

console.log(CLASSIFIER_MODEL); // 'us.amazon.nova-micro-v1:0'
```

## Migration from @ranger/llm-router

This package replaces `@ranger/llm-router`. Update your imports:

```typescript
// Before
import { createBedrockRouter } from '@ranger/llm-router';
const router = createBedrockRouter('costOptimized');
const result = await router.route(prompt);

// After
import { routeQuery, Tool } from '@ranger/intent-analyzer';
const result = await routeQuery(prompt, {
  provider: 'bedrock',
  preset: 'costOptimized',
  availableTools: [Tool.WEB_SEARCH],
});
```

## License

MIT
