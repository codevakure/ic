# @librechat/guardrails

AWS Bedrock Guardrails integration package for content moderation in LibreChat.

## Overview

This package provides a standalone, production-ready service for moderating user input and AI output using AWS Bedrock Guardrails. It centralizes all guardrails logic with three high-level handlers for clean integration into any application.

## Features

- ✅ **Input Moderation** - Block harmful user messages before LLM processing
- ✅ **Output Moderation** - Filter AI responses to ensure policy compliance
- ✅ **Context Injection** - Automatic system prompt enhancement with violation context
- ✅ **Clean UX** - Violations hidden from users unless explicitly asked
- ✅ **Metadata Tracking** - Complete audit trail of all blocks
- ✅ **Production Logging** - Minimal noise, only logs blocks and errors
- ✅ **Singleton Pattern** - Single shared instance across application
- ✅ **TypeScript** - Full type safety with comprehensive interfaces

## Installation

```bash
npm install @librechat/guardrails
```

## Quick Start

```typescript
import { getGuardrailsService } from '@librechat/guardrails';

const guardrailsService = getGuardrailsService();

// 1. Moderate user input
const inputResult = await guardrailsService.handleInputModeration(userText);
if (inputResult.blocked) {
  // Save to database with inputResult.metadata
  // Return inputResult.blockMessage to user
  return;
}

// 2. Process with LLM
const llmResponse = await callLLM(userText);

// 3. Moderate LLM output
const outputResult = await guardrailsService.handleOutputModeration(llmResponse.text);
if (outputResult.blocked && outputResult.modifiedResponse) {
  llmResponse.text = outputResult.modifiedResponse.text;
  llmResponse.metadata = outputResult.modifiedResponse.metadata;
}

// 4. Inject context for future LLM calls
const messages = await getConversationHistory();
const injection = guardrailsService.extractGuardrailContext(messages);
if (injection.hasGuardrailContext && injection.systemNote) {
  systemPrompt = [systemPrompt, injection.systemNote].join('\n\n');
}
```

## Configuration

### Environment Variables

```bash
# Required
BEDROCK_GUARDRAILS_ENABLED=true
BEDROCK_GUARDRAILS_ID=your-guardrail-id
BEDROCK_AWS_ACCESS_KEY_ID=your-access-key
BEDROCK_AWS_SECRET_ACCESS_KEY=your-secret-key

# Optional
BEDROCK_GUARDRAILS_VERSION=DRAFT       # or version number (e.g., "1", "2")
BEDROCK_AWS_DEFAULT_REGION=us-east-1   # AWS region
BEDROCK_AWS_SESSION_TOKEN=token        # Optional session token
BEDROCK_GUARDRAILS_BLOCK_MESSAGE=custom-message  # Custom block message
```

### Programmatic Configuration

```typescript
import { GuardrailsService } from '@librechat/guardrails';

const service = new GuardrailsService({
  enabled: true,
  guardrailId: 'your-guardrail-id',
  guardrailVersion: '4',
  region: 'us-east-1',
  accessKeyId: 'your-access-key',
  secretAccessKey: 'your-secret-key',
  blockMessage: 'Your message violates our policies.'
});
```

## API Reference

### High-Level Handlers

#### `handleInputModeration(text: string)`

Moderate user input before sending to LLM.

**Returns:** `InputModerationResult`
```typescript
{
  blocked: boolean;           // true if content blocked
  shouldContinue: boolean;    // false if blocked
  metadata?: {                // Save to database for audit trail
    guardrailBlocked: true,
    violations: ViolationDetail[],
    assessments: any[],
    originalUserMessage: string,
    blockReason: string,
    systemNote: string        // For LLM context injection
  };
  blockMessage?: string;      // Message to show user
  violations?: ViolationDetail[];
}
```

**Example:**
```typescript
const result = await guardrailsService.handleInputModeration(userText);

if (result.blocked) {
  // 1. Save user message with metadata
  await saveMessage({
    text: userText,
    role: 'user',
    metadata: result.metadata
  });

  // 2. Save guardrail response
  await saveMessage({
    text: result.blockMessage,
    role: 'assistant',
    metadata: result.metadata
  });

  // 3. Return block message to user
  return res.json({ message: result.blockMessage });
}

// Continue to LLM
```

#### `handleOutputModeration(text: string)`

Moderate LLM response before showing to user.

**Returns:** `OutputModerationResult`
```typescript
{
  blocked: boolean;           // true if content blocked
  modifiedResponse?: {
    text: string,             // Replacement message
    metadata: GuardrailMetadata  // Save to database
  };
  violations?: ViolationDetail[];
}
```

**Example:**
```typescript
const llmResponse = await runAgent(options);

const result = await guardrailsService.handleOutputModeration(llmResponse.text);

if (result.blocked && result.modifiedResponse) {
  // Replace blocked response
  llmResponse.text = result.modifiedResponse.text;
  llmResponse.metadata = result.modifiedResponse.metadata;
  
  console.warn('🚫 OUTPUT BLOCKED:', {
    violations: result.violations.map(v => v.category).join(', ')
  });
}
```

#### `extractGuardrailContext(messages: any[])`

Extract violation context from message history for system prompt injection.

**Returns:** `SystemPromptInjection`
```typescript
{
  hasGuardrailContext: boolean;  // true if any blocks found
  systemNote?: string;           // Append to system prompt
  violations?: ViolationDetail[];
}
```

**Example:**
```typescript
// Load conversation history
const messages = await getMessages(conversationId);

// Extract guardrail context
const injection = guardrailsService.extractGuardrailContext(messages);

// Inject into system prompt
if (injection.hasGuardrailContext && injection.systemNote) {
  systemPrompt = [baseSystemPrompt, injection.systemNote].join('\n\n');
}

// LLM now has context about what was blocked
```

### Low-Level Methods

#### `moderate(content: string, options?)`

Direct moderation without metadata handling.

```typescript
const result = await guardrailsService.moderate(text, {
  source: 'INPUT',  // or 'OUTPUT'
  guardrailId: 'custom-id',
  guardrailVersion: '1'
});
```

#### `moderateInput(text: string)`

Shorthand for `moderate(text, { source: 'INPUT' })`.

#### `moderateOutput(text: string)`

Shorthand for `moderate(text, { source: 'OUTPUT' })`.

#### `isEnabled()`

Check if guardrails are configured and enabled.

```typescript
if (guardrailsService.isEnabled()) {
  // Guardrails active
}
```

## Integration Examples

### Express Middleware (INPUT)

```typescript
// api/server/middleware/moderateText.js
import { getGuardrailsService } from '@librechat/guardrails';

export async function moderateTextMiddleware(req, res, next) {
  const guardrailsService = getGuardrailsService();
  const { text, conversationId } = req.body;

  // Moderate input
  const result = await guardrailsService.handleInputModeration(text);

  if (result.blocked) {
    // Save user message
    await saveMessage({
      text,
      role: 'user',
      conversationId,
      metadata: result.metadata
    });

    // Save guardrail response
    await saveMessage({
      text: result.blockMessage,
      role: 'assistant',
      conversationId,
      metadata: result.metadata
    });

    // Return block message
    return res.json({
      message: result.blockMessage,
      conversationId
    });
  }

  // Continue to next middleware
  next();
}
```

### Agent Controller (OUTPUT + Context)

```typescript
// api/server/controllers/agents/client.js
import { getGuardrailsService } from '@librechat/guardrails';

export async function handleAgentRequest(req, res) {
  const guardrailsService = getGuardrailsService();
  
  // 1. Load conversation history
  const messages = await getMessages(req.body.conversationId);
  
  // 2. Extract guardrail context
  const injection = guardrailsService.extractGuardrailContext(messages);
  
  // 3. Build system prompt with context
  let systemPrompt = baseSystemPrompt;
  if (injection.hasGuardrailContext && injection.systemNote) {
    systemPrompt = [systemPrompt, injection.systemNote].join('\n\n');
  }
  
  // 4. Call LLM
  const agentResponse = await runAgent({
    systemPrompt,
    userMessage: req.body.text
  });
  
  // 5. Moderate output
  const result = await guardrailsService.handleOutputModeration(agentResponse.text);
  
  if (result.blocked && result.modifiedResponse) {
    agentResponse.text = result.modifiedResponse.text;
    agentResponse.metadata = result.modifiedResponse.metadata;
    
    console.warn('🚫 OUTPUT BLOCKED:', {
      violations: result.violations.map(v => v.category).join(', ')
    });
  }
  
  // 6. Return response
  return res.json(agentResponse);
}
```

### Database Schema (MongoDB)

```typescript
// models/Message.js
const messageSchema = new Schema({
  conversationId: { type: String, required: true, index: true },
  text: { type: String, required: true },
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  metadata: Schema.Types.Mixed,  // ← Stores GuardrailMetadata
  createdAt: { type: Date, default: Date.now }
});
```

## Violation Types

### Content Policy (AI-Powered)
- **SEXUAL** - Explicit sexual content
- **VIOLENCE** - Violent or graphic content
- **HATE** - Hate speech or discrimination
- **INSULTS** - Personal insults or derogatory language
- **MISCONDUCT** - Criminal advice or unethical behavior
- **PROMPT_ATTACK** - Jailbreak attempts or prompt injections (INPUT only)

### Topic Policy
- Banking/Finance topics (e.g., Investment Advice, Cryptocurrency)
- Medical advice
- Legal advice
- Political extremism
- Hate speech topics
- Adult content
- Self-harm
- Gambling

### Word Policy
- Profanity filtering (optional)
- Custom word lists

### PII Protection
- **BLOCK** (INPUT): SSN, Passport, Tax ID, Bank Account, Driver License, Credit Cards
- **ANONYMIZE** (OUTPUT): Replace detected PII with generic placeholders

## Logging Behavior

### Production Mode (Default)

**Silent Operations:**
- ✅ Passes - No logging
- ✅ isEnabled() checks - No logging
- ✅ Context injection when no violations - No logging

**Logged Events:**
- 🚫 INPUT BLOCKED - With violation summary
- 🚫 OUTPUT BLOCKED - With violation summary
- 💉 Injecting guardrail context - When blocks found
- ❌ Errors - Always logged

### Debug Mode

Set `DEBUG=guardrails:*` for verbose logging:
```bash
DEBUG=guardrails:* npm run backend:dev
```

## Metadata Structure

### GuardrailMetadata (Saved to Database)

```typescript
{
  guardrailBlocked: true,
  violations: [
    {
      type: 'CONTENT_POLICY',
      category: 'HATE',
      confidence: 'HIGH',
      action: 'BLOCKED'
    }
  ],
  assessments: [...],           // Raw AWS response
  originalUserMessage: '...',   // For INPUT blocks only
  blockReason: 'policy_violation',
  systemNote: 'GUARDRAILS CONTEXT: ...'  // For LLM context
}
```

### System Note Format

**INPUT Block:**
```
GUARDRAILS CONTEXT: The user's previous message was blocked by AWS Bedrock 
Guardrails automated policy system. The violations detected were: Hate Speech 
Topic, INSULTS Content (MEDIUM confidence). IMPORTANT: Only explain these 
violations if the user explicitly asks "what policy", "why blocked", "what was 
violated" or similar questions. Otherwise, simply help them with their actual 
request or offer to rephrase.
```

**OUTPUT Block:**
```
GUARDRAILS CONTEXT: The AI's previous response was blocked by AWS Bedrock 
Guardrails automated policy system because it attempted to generate content 
that violated: HATE Content (HIGH confidence). IMPORTANT: Only explain why 
the response was blocked if the user explicitly asks "why blocked", "what 
happened", "what policy" or similar questions. Otherwise, try to help with 
their original request in a policy-compliant way.
```

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:ci

# Watch mode
npm run test:watch
```

## Building

```bash
# Build package
npm run build

# Build and watch
npm run build:watch

# Clean build artifacts
npm run clean
```

## Guardrails Configuration

### Recommended Banking Configuration (Version 4)

**Content Filters:**
- SEXUAL, VIOLENCE, HATE: **HIGH** (INPUT + OUTPUT)
- INSULTS, MISCONDUCT: **MEDIUM** (INPUT + OUTPUT)
- PROMPT_ATTACK: **HIGH** (INPUT only)

**Topic Policies:**
- All banking topics: **INPUT only** (allows explanations in OUTPUT)
- Hate Speech, Rude Personas: **OUTPUT disabled**

**Word Policy:**
- **REMOVED** - Content filters handle profanity with better accuracy

**PII Protection:**
- **BLOCK** (INPUT) - Prevent sensitive data submission
- **ANONYMIZE** (OUTPUT) - Mask any leaked PII

### Updating AWS Guardrails

```bash
# Update guardrails configuration
aws bedrock update-guardrail \
  --guardrail-identifier your-guardrail-id \
  --name your-guardrail-name \
  --content-policy-config file://contentPolicy.json \
  --topic-policy-config file://topicPolicy.json \
  --sensitive-information-policy-config file://sensitiveInformationPolicy.json \
  --region us-east-1

# Create new version
aws bedrock create-guardrail-version \
  --guardrail-identifier your-guardrail-id \
  --region us-east-1

# Update .env with new version
BEDROCK_GUARDRAILS_VERSION=4
```

## Troubleshooting

### Guardrails Not Working

1. **Check environment variables:**
   ```bash
   echo $BEDROCK_GUARDRAILS_ENABLED  # Should be "true"
   echo $BEDROCK_GUARDRAILS_ID       # Should be set
   echo $BEDROCK_AWS_ACCESS_KEY_ID   # Should be set
   ```

2. **Check isEnabled():**
   ```typescript
   console.log('Guardrails enabled:', guardrailsService.isEnabled());
   ```

3. **Check AWS credentials:**
   ```bash
   aws bedrock get-guardrail \
     --guardrail-identifier $BEDROCK_GUARDRAILS_ID \
     --region us-east-1
   ```

### False Positives

If legitimate content is being blocked:

1. **Review violations:**
   ```typescript
   if (result.blocked) {
     console.log('Violations:', result.violations);
   }
   ```

2. **Adjust confidence levels:**
   - HIGH: Strictest (fewest false positives)
   - MEDIUM: Balanced
   - LOW: Most permissive (more false positives)

3. **Update guardrail configuration** to reduce sensitivity

### Context Not Injecting

1. **Check message metadata:**
   ```typescript
   console.log('Messages:', messages.map(m => ({
     role: m.role,
     hasMetadata: !!m.metadata,
     blocked: m.metadata?.guardrailBlocked
   })));
   ```

2. **Verify extraction:**
   ```typescript
   const injection = guardrailsService.extractGuardrailContext(messages);
   console.log('Has context:', injection.hasGuardrailContext);
   console.log('System note:', injection.systemNote);
   ```

## Migration Guide

### From Inline Guardrails

**Before:**
```typescript
// Scattered guardrails logic
const client = new BedrockRuntimeClient({...});
const command = new ApplyGuardrailCommand({...});
const result = await client.send(command);
// Manual parsing of violations...
```

**After:**
```typescript
import { getGuardrailsService } from '@librechat/guardrails';

const result = await getGuardrailsService().handleInputModeration(text);
if (result.blocked) {
  // Clean metadata handling
}
```

### Version History

- **v0.0.1** - Initial release with three high-level handlers
- **Guardrails V1** - Banking-optimized policies
- **Guardrails V2** - Rude Personas OUTPUT disabled
- **Guardrails V3** - Hate Speech OUTPUT disabled
- **Guardrails V4** - Word policy removed (CURRENT)


**Version:** 0.0.1  
**AWS Bedrock Guardrails Version:** 4 (Recommended)  
**Last Updated:** November 2025
