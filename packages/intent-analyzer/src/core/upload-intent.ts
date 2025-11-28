/**
 * Upload Intent Analyzer
 * 
 * Determines where to upload files based on file type:
 * - Images → IMAGE endpoint
 * - Documents (PDF, DOCX, TXT, MD) → FILE_SEARCH endpoint  
 * - Spreadsheets/Code (XLSX, CSV, PY, JS) → CODE_INTERPRETER endpoint
 */

import { FileInfo, UploadIntent, UploadIntentResult, BatchUploadIntentResult } from './types';

/**
 * File extension to upload intent mapping
 */
const EXTENSION_MAP: Record<string, UploadIntent> = {
  // Images → IMAGE
  '.png': UploadIntent.IMAGE,
  '.jpg': UploadIntent.IMAGE,
  '.jpeg': UploadIntent.IMAGE,
  '.gif': UploadIntent.IMAGE,
  '.webp': UploadIntent.IMAGE,
  '.svg': UploadIntent.IMAGE,
  '.bmp': UploadIntent.IMAGE,
  '.ico': UploadIntent.IMAGE,
  '.tiff': UploadIntent.IMAGE,
  '.tif': UploadIntent.IMAGE,

  // Spreadsheets → CODE_INTERPRETER
  '.xlsx': UploadIntent.CODE_INTERPRETER,
  '.xls': UploadIntent.CODE_INTERPRETER,
  '.csv': UploadIntent.CODE_INTERPRETER,
  '.tsv': UploadIntent.CODE_INTERPRETER,
  '.ods': UploadIntent.CODE_INTERPRETER,

  // Code files → CODE_INTERPRETER
  '.py': UploadIntent.CODE_INTERPRETER,
  '.js': UploadIntent.CODE_INTERPRETER,
  '.ts': UploadIntent.CODE_INTERPRETER,
  '.jsx': UploadIntent.CODE_INTERPRETER,
  '.tsx': UploadIntent.CODE_INTERPRETER,
  '.json': UploadIntent.CODE_INTERPRETER,
  '.yaml': UploadIntent.CODE_INTERPRETER,
  '.yml': UploadIntent.CODE_INTERPRETER,
  '.xml': UploadIntent.CODE_INTERPRETER,
  '.sql': UploadIntent.CODE_INTERPRETER,
  '.sh': UploadIntent.CODE_INTERPRETER,
  '.bash': UploadIntent.CODE_INTERPRETER,
  '.r': UploadIntent.CODE_INTERPRETER,
  '.rb': UploadIntent.CODE_INTERPRETER,
  '.php': UploadIntent.CODE_INTERPRETER,
  '.java': UploadIntent.CODE_INTERPRETER,
  '.c': UploadIntent.CODE_INTERPRETER,
  '.cpp': UploadIntent.CODE_INTERPRETER,
  '.h': UploadIntent.CODE_INTERPRETER,
  '.go': UploadIntent.CODE_INTERPRETER,
  '.rs': UploadIntent.CODE_INTERPRETER,
  '.swift': UploadIntent.CODE_INTERPRETER,
  '.kt': UploadIntent.CODE_INTERPRETER,
  '.scala': UploadIntent.CODE_INTERPRETER,
  '.ipynb': UploadIntent.CODE_INTERPRETER,

  // Documents → FILE_SEARCH
  '.pdf': UploadIntent.FILE_SEARCH,
  '.doc': UploadIntent.FILE_SEARCH,
  '.docx': UploadIntent.FILE_SEARCH,
  '.txt': UploadIntent.FILE_SEARCH,
  '.md': UploadIntent.FILE_SEARCH,
  '.markdown': UploadIntent.FILE_SEARCH,
  '.rtf': UploadIntent.FILE_SEARCH,
  '.odt': UploadIntent.FILE_SEARCH,
  '.ppt': UploadIntent.FILE_SEARCH,
  '.pptx': UploadIntent.FILE_SEARCH,
  '.html': UploadIntent.FILE_SEARCH,
  '.htm': UploadIntent.FILE_SEARCH,
  '.epub': UploadIntent.FILE_SEARCH,
};

/**
 * MIME type patterns to upload intent mapping
 */
const MIME_PATTERNS: Array<{ pattern: RegExp | string; intent: UploadIntent }> = [
  // Images
  { pattern: /^image\//, intent: UploadIntent.IMAGE },
  
  // Spreadsheets
  { pattern: 'application/vnd.ms-excel', intent: UploadIntent.CODE_INTERPRETER },
  { pattern: 'application/vnd.openxmlformats-officedocument.spreadsheetml', intent: UploadIntent.CODE_INTERPRETER },
  { pattern: 'text/csv', intent: UploadIntent.CODE_INTERPRETER },
  { pattern: 'application/csv', intent: UploadIntent.CODE_INTERPRETER },
  { pattern: 'text/tab-separated-values', intent: UploadIntent.CODE_INTERPRETER },
  
  // Code
  { pattern: 'text/x-python', intent: UploadIntent.CODE_INTERPRETER },
  { pattern: 'application/javascript', intent: UploadIntent.CODE_INTERPRETER },
  { pattern: 'text/javascript', intent: UploadIntent.CODE_INTERPRETER },
  { pattern: 'application/typescript', intent: UploadIntent.CODE_INTERPRETER },
  { pattern: 'application/json', intent: UploadIntent.CODE_INTERPRETER },
  { pattern: 'application/x-yaml', intent: UploadIntent.CODE_INTERPRETER },
  { pattern: 'text/yaml', intent: UploadIntent.CODE_INTERPRETER },
  
  // Documents
  { pattern: 'application/pdf', intent: UploadIntent.FILE_SEARCH },
  { pattern: 'application/msword', intent: UploadIntent.FILE_SEARCH },
  { pattern: 'application/vnd.openxmlformats-officedocument.wordprocessingml', intent: UploadIntent.FILE_SEARCH },
  { pattern: 'text/plain', intent: UploadIntent.FILE_SEARCH },
  { pattern: 'text/markdown', intent: UploadIntent.FILE_SEARCH },
  { pattern: 'text/html', intent: UploadIntent.FILE_SEARCH },
];

/**
 * Get file extension from filename
 */
function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.substring(lastDot).toLowerCase();
}

/**
 * Analyze a single file to determine upload intent
 */
export function analyzeUploadIntent(file: FileInfo): UploadIntentResult {
  const extension = getExtension(file.filename);
  const mimetype = file.mimetype.toLowerCase();

  console.log(`[IntentAnalyzer:Upload] File: ${file.filename}, ext: ${extension}, mime: ${mimetype}`);

  // Check by extension first (most reliable for our use case)
  if (extension && EXTENSION_MAP[extension]) {
    const result = { intent: EXTENSION_MAP[extension], confidence: 0.95 };
    console.log(`[IntentAnalyzer:Upload] Matched by extension → ${result.intent} (confidence: ${result.confidence})`);
    return result;
  }

  // Fallback to MIME type
  for (const { pattern, intent } of MIME_PATTERNS) {
    if (typeof pattern === 'string') {
      if (mimetype.includes(pattern)) {
        console.log(`[IntentAnalyzer:Upload] Matched by MIME pattern '${pattern}' → ${intent} (confidence: 0.85)`);
        return { intent, confidence: 0.85 };
      }
    } else if (pattern.test(mimetype)) {
      console.log(`[IntentAnalyzer:Upload] Matched by MIME regex → ${intent} (confidence: 0.85)`);
      return { intent, confidence: 0.85 };
    }
  }

  // Default to FILE_SEARCH for unknown types (RAG can handle most text)
  console.log(`[IntentAnalyzer:Upload] No match, defaulting to FILE_SEARCH (confidence: 0.5)`);
  return {
    intent: UploadIntent.FILE_SEARCH,
    confidence: 0.5,
  };
}

/**
 * Analyze multiple files and group by upload intent
 */
export function analyzeUploadIntents(files: FileInfo[]): BatchUploadIntentResult {
  const groups = new Map<UploadIntent, FileInfo[]>();
  const fileResults: Array<{ file: FileInfo; result: UploadIntentResult }> = [];

  // Initialize groups
  groups.set(UploadIntent.IMAGE, []);
  groups.set(UploadIntent.FILE_SEARCH, []);
  groups.set(UploadIntent.CODE_INTERPRETER, []);

  for (const file of files) {
    const result = analyzeUploadIntent(file);
    fileResults.push({ file, result });
    
    const group = groups.get(result.intent) || [];
    group.push(file);
    groups.set(result.intent, group);
  }

  return { groups, files: fileResults };
}

/**
 * Get the upload endpoint for a given intent
 */
export function getUploadEndpoint(intent: UploadIntent): string {
  switch (intent) {
    case UploadIntent.IMAGE:
      return '/api/files/images';
    case UploadIntent.FILE_SEARCH:
      return '/api/files/agents'; // with tool_resource: file_search
    case UploadIntent.CODE_INTERPRETER:
      return '/api/files/agents'; // with tool_resource: execute_code
  }
}

/**
 * Get tool_resource value for agent file upload
 */
export function getToolResource(intent: UploadIntent): string | null {
  switch (intent) {
    case UploadIntent.IMAGE:
      return null; // Images don't use tool_resource
    case UploadIntent.FILE_SEARCH:
      return 'file_search';
    case UploadIntent.CODE_INTERPRETER:
      return 'execute_code';
  }
}
