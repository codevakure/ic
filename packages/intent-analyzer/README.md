# @librechat/intent-analyzer

Intent analyzer for routing attachments, tools, and LLM selection in LibreChat.

## Overview

This package provides intelligent routing capabilities for:

1. **Attachment Routing** - Route file attachments to appropriate upload strategies
2. **Tool Selection** - Automatically select tools based on user query and context  
3. **LLM Routing** - Route to appropriate LLM based on task complexity and capabilities

## Installation

```bash
npm install @librechat/intent-analyzer
```

## Usage

### Attachment Routing

Route file attachments to the appropriate upload strategy:

```typescript
import { routeAttachment, routeAttachments } from '@librechat/intent-analyzer';

// Single file
const result = routeAttachment({
  file_id: '123',
  filename: 'data.xlsx',
  mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  size: 5000,
});

console.log(result.primaryStrategy);      // 'code_executor'
console.log(result.backgroundStrategies); // ['file_search']
console.log(result.shouldEmbed);          // true
console.log(result.category);             // 'spreadsheet'

// Multiple files
const batchResult = routeAttachments([
  { file_id: '1', filename: 'photo.jpg', mimetype: 'image/jpeg', size: 1000 },
  { file_id: '2', filename: 'doc.pdf', mimetype: 'application/pdf', size: 5000 },
]);

console.log(batchResult.summary);
// { total: 2, byStrategy: {...}, byCategory: {...} }
```

### Upload Strategies

| Strategy | Description | File Types |
|----------|-------------|------------|
| `IMAGE` | Vision/image processing | JPG, PNG, GIF, WebP, etc. |
| `CODE_EXECUTOR` | Code interpreter | Excel, CSV, Python, JS, etc. |
| `FILE_SEARCH` | RAG embeddings | PDF, DOC, TXT, MD, etc. |
| `TEXT_CONTEXT` | Text extraction | Audio (STT), scanned docs (OCR) |
| `PROVIDER` | Native provider handling | Video, archives |

### Tool Selection

Automatically select tools based on query and attachments:

```typescript
import { selectTools, ToolType } from '@librechat/intent-analyzer';

const result = selectTools({
  query: 'Calculate the sum of values in this spreadsheet',
  availableTools: [
    { type: ToolType.CODE_INTERPRETER, name: 'Code Interpreter', enabled: true },
    { type: ToolType.FILE_SEARCH, name: 'File Search', enabled: true },
  ],
  attachments: [
    { file_id: '1', filename: 'data.xlsx', mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 5000 },
  ],
});

console.log(result.selectedTools);    // [{ type: 'code_interpreter', ... }]
console.log(result.autoEnabledTools); // ['code_interpreter']
console.log(result.reasoning);        // 'Query suggests code_interpreter...'
```

### LLM Routing

Route to the best LLM based on task requirements:

```typescript
import { routeToLLM, ModelCapability, ModelTier } from '@librechat/intent-analyzer';

const result = routeToLLM({
  query: 'Analyze this image and explain what you see',
  availableModels: [
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      provider: 'openai',
      capabilities: [ModelCapability.TEXT, ModelCapability.VISION, ModelCapability.CODE],
      tier: ModelTier.STANDARD,
      contextWindow: 128000,
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      provider: 'openai',
      capabilities: [ModelCapability.TEXT, ModelCapability.FAST],
      tier: ModelTier.ECONOMY,
      contextWindow: 128000,
    },
  ],
  attachments: [
    { file_id: '1', filename: 'photo.jpg', mimetype: 'image/jpeg', size: 1000 },
  ],
});

console.log(result.selectedModel);        // { id: 'gpt-4o', ... }
console.log(result.requiredCapabilities); // ['text', 'vision']
console.log(result.taskComplexity);       // 'moderate'
console.log(result.fallbackModels);       // []
```

## API Reference

### Attachment Module

- `routeAttachment(file, config?)` - Route a single file
- `routeAttachments(files, config?)` - Route multiple files
- `categorizeFile(file)` - Get file category
- `shouldEmbedFile(file, category, config?)` - Check if file should be embedded
- `needsOCR(file, config?)` - Check if file needs OCR
- `needsSTT(file, config?)` - Check if file needs speech-to-text

### Tools Module

- `selectTools(context)` - Select tools based on context
- `shouldEnableTool(toolType, context)` - Check if a tool should be enabled

### LLM Routing Module

- `routeToLLM(context)` - Route to best LLM
- `modelSupportsCapabilities(model, capabilities)` - Check model capabilities
- `getCheapestModel(models, capabilities?)` - Get cheapest eligible model
- `getFastestModel(models, capabilities?)` - Get fastest eligible model

## Enums

### UploadStrategy
- `IMAGE` - Vision/image processing
- `CODE_EXECUTOR` - Code interpreter
- `FILE_SEARCH` - RAG embeddings
- `TEXT_CONTEXT` - Text extraction
- `PROVIDER` - Native provider handling

### FileCategory
- `IMAGE`, `DOCUMENT`, `SPREADSHEET`, `CODE`, `AUDIO`, `VIDEO`, `ARCHIVE`, `UNKNOWN`

### ToolType
- `CODE_INTERPRETER`, `FILE_SEARCH`, `IMAGE_GENERATION`, `WEB_SEARCH`, `CALCULATOR`, `MCP_TOOL`

### ModelCapability
- `TEXT`, `VISION`, `CODE`, `REASONING`, `FUNCTION_CALLING`, `LONG_CONTEXT`, `FAST`, `JSON_MODE`

### ModelTier
- `ECONOMY`, `STANDARD`, `PREMIUM`

### TaskComplexity
- `SIMPLE`, `MODERATE`, `COMPLEX`

## License

MIT
