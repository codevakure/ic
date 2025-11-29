# @librechat/intent-analyzer

Intent analyzer for routing attachments and tool selection in LibreChat.

## Overview

This package provides intelligent routing capabilities for:

1. **Upload Intent** - Determine how files should be uploaded (IMAGE, FILE_SEARCH, CODE_INTERPRETER)
2. **Query Intent** - Analyze queries to determine which tools to use
3. **Attachment Routing** - Route file attachments to appropriate upload strategies
4. **Tool Selection** - Automatically select tools based on user query and context

> **Note**: For LLM routing/model selection based on task complexity, use the separate `@librechat/llm-router` package.

## Installation

```bash
npm install @librechat/intent-analyzer
```

## Usage

### Core Module (Recommended)

The core module provides lightweight intent analysis without external dependencies.

#### Upload Intent

Analyze files to determine the best upload strategy:

```typescript
import { analyzeUploadIntent, analyzeUploadIntents, UploadIntent } from '@librechat/intent-analyzer';

// Single file
const result = analyzeUploadIntent({
  filename: 'photo.jpg',
  type: 'image/jpeg',
  size: 50000,
});

console.log(result.intent);      // UploadIntent.IMAGE
console.log(result.endpoint);    // '/api/files/images'
console.log(result.toolResource); // 'images'

// Multiple files
const batchResult = analyzeUploadIntents([
  { filename: 'photo.jpg', type: 'image/jpeg', size: 50000 },
  { filename: 'data.csv', type: 'text/csv', size: 10000 },
  { filename: 'report.pdf', type: 'application/pdf', size: 100000 },
]);

console.log(batchResult.results);
// [
//   { intent: 'IMAGE', endpoint: '/api/files/images', ... },
//   { intent: 'CODE_INTERPRETER', endpoint: '/api/files/code_interpreter', ... },
//   { intent: 'FILE_SEARCH', endpoint: '/api/files/file_search', ... },
// ]
```

#### Upload Intents

| Intent | Description | File Types |
|--------|-------------|------------|
| `IMAGE` | Vision/image processing | JPG, PNG, GIF, WebP, SVG, etc. |
| `CODE_INTERPRETER` | Code interpreter execution | Excel, CSV, Python, JS, JSON, etc. |
| `FILE_SEARCH` | RAG embeddings/search | PDF, DOC, TXT, MD, HTML, etc. |

#### Query Intent

Analyze queries to determine which tools to enable:

```typescript
import { analyzeQueryIntent, Tool } from '@librechat/intent-analyzer';

const result = analyzeQueryIntent({
  query: 'Calculate the sum of sales in this spreadsheet',
  attachedFiles: [
    { filename: 'sales.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  ],
  availableTools: [Tool.CODE_INTERPRETER, Tool.FILE_SEARCH, Tool.WEB_SEARCH],
});

console.log(result.tools);           // [Tool.CODE_INTERPRETER]
console.log(result.contextPrompts);  // ['Spreadsheet attached for analysis...']
console.log(result.confidence);      // 0.9
```

### Legacy Modules

For advanced use cases, the package also exports detailed routing functions:

#### Attachment Routing (Detailed)

```typescript
import { routeAttachment, routeAttachments } from '@librechat/intent-analyzer';

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
```

#### Tool Selection (Detailed)

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

## API Reference

### Core Module

- `analyzeUploadIntent(file)` - Analyze a single file for upload intent
- `analyzeUploadIntents(files)` - Analyze multiple files for upload intents
- `getUploadEndpoint(intent)` - Get API endpoint for an upload intent
- `getToolResource(intent)` - Get tool resource name for an upload intent
- `analyzeQueryIntent(context)` - Analyze query to determine tools to use
- `shouldUseTool(tool, context)` - Check if a specific tool should be used
- `getToolContextPrompts(tools, files)` - Get context prompts for selected tools

### Legacy Attachment Module

- `routeAttachment(file, config?)` - Route a single file (detailed)
- `routeAttachments(files, config?)` - Route multiple files (detailed)
- `categorizeFile(file)` - Get file category
- `shouldEmbedFile(file, category, config?)` - Check if file should be embedded
- `needsOCR(file, config?)` - Check if file needs OCR
- `needsSTT(file, config?)` - Check if file needs speech-to-text

### Legacy Tools Module

- `selectTools(context)` - Select tools based on context (detailed)
- `shouldEnableTool(toolType, context)` - Check if a tool should be enabled

## Enums

### UploadIntent (Core)
- `IMAGE` - Vision/image processing
- `CODE_INTERPRETER` - Code interpreter
- `FILE_SEARCH` - RAG embeddings/search

### Tool (Core)
- `CODE_INTERPRETER`, `FILE_SEARCH`, `WEB_SEARCH`, `IMAGE_GEN`, `CALCULATOR`

### UploadStrategy (Legacy)
- `IMAGE`, `CODE_EXECUTOR`, `FILE_SEARCH`, `TEXT_CONTEXT`, `PROVIDER`

### FileCategory (Legacy)
- `IMAGE`, `DOCUMENT`, `SPREADSHEET`, `CODE`, `AUDIO`, `VIDEO`, `ARCHIVE`, `UNKNOWN`

### ToolType (Legacy)
- `CODE_INTERPRETER`, `FILE_SEARCH`, `IMAGE_GENERATION`, `WEB_SEARCH`, `CALCULATOR`, `MCP_TOOL`

## Related Packages

- `@librechat/llm-router` - LLM routing for cost-optimized model selection based on task complexity

## License

MIT
