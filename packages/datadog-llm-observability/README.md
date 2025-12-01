# Datadog LLM Observability Package

Standalone package for Datadog LLM Observability integration in LibreChat.

## Installation

```bash
npm install @LibreChat/datadog-llm-observability
```

## Usage

### Initialize Tracer

```typescript
import { initializeDatadog, isLLMObservabilityEnabled } from '@LibreChat/datadog-llm-observability';

// Initialize at application startup
initializeDatadog({
  enabled: process.env.DD_LLMOBS_ENABLED === 'true',
  service: process.env.DD_SERVICE || 'LibreChat',
  env: process.env.DD_ENV || 'development',
  apiKey: process.env.DD_API_KEY
});
```

### Trace LLM Calls

```typescript
import { traceLLMCall, LLM_PROVIDERS, LLM_OPERATION_TYPES } from '@LibreChat/datadog-llm-observability';

const result = await traceLLMCall({
  provider: LLM_PROVIDERS.OPENAI,
  model: 'gpt-4o',
  operationType: LLM_OPERATION_TYPES.COMPLETION,
  userId: user.id,
  conversationId: conv.id,
  metadata: {
    temperature: 0.7,
    maxTokens: 1000
  }
}, async () => {
  // Your LLM API call
  return await openai.chat.completions.create({ ... });
});
```

### Trace Conversation Workflows

```typescript
import { traceConversationWorkflow } from '@LibreChat/datadog-llm-observability';

const result = await traceConversationWorkflow({
  conversationId: conv.id,
  userId: user.id,
  user: user,
  workflowType: 'chat',
  metadata: { agent_name: 'MyAgent' }
}, async () => {
  // Your conversation logic
});
```

## Environment Variables

Required:
- `DD_LLMOBS_ENABLED` - Enable/disable Datadog LLM Observability
- `DD_API_KEY` - Datadog API key

Optional:
- `DD_SERVICE` - Service name (default: 'LibreChat')
- `DD_ENV` - Environment (default: 'development')
- `DD_VERSION` - Version
- `DD_SITE` - Datadog site (default: 'datadoghq.com')

## Features

- ✅ Automatic LLM call tracing
- ✅ Conversation workflow tracking
- ✅ User session monitoring
- ✅ Token usage and cost estimation
- ✅ Enhanced trace correlation
- ✅ Support for multiple LLM providers
- ✅ Snowflake span filtering
- ✅ Comprehensive error tracking

## API Reference

See [DATADOG_LLM_OBSERVABILITY.md](../../DATADOG_LLM_OBSERVABILITY.md) for detailed documentation.
