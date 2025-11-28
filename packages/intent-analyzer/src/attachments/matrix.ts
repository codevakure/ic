/**
 * File Routing Matrix
 * 
 * Defines which upload strategies apply to which file types.
 * This is the core decision matrix for attachment routing.
 */

import { FileCategory, UploadStrategy } from './types';

/**
 * MIME type patterns for file categorization
 */
export const MIME_PATTERNS = {
  /** Image files - route to IMAGE strategy */
  images: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/bmp',
    'image/tiff',
    'image/heic',
    'image/heif',
  ],

  /** Spreadsheet files - route to CODE_EXECUTOR */
  spreadsheets: [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.oasis.opendocument.spreadsheet',
    'text/csv',
    'application/csv',
  ],

  /** Code files - route to CODE_EXECUTOR */
  code: [
    'text/x-python',
    'application/x-python',
    'application/x-python-code',
    'text/x-python-script',
    'text/javascript',
    'application/javascript',
    'text/typescript',
    'application/typescript',
    'text/x-java',
    'text/x-c',
    'text/x-c++',
    'text/x-csharp',
    'text/x-go',
    'text/x-rust',
    'application/json',
    'text/x-yaml',
    'application/x-yaml',
    'text/xml',
    'application/xml',
    'text/x-sql',
    'application/sql',
    'text/x-shellscript',
    'application/x-sh',
  ],

  /** Document files - route to FILE_SEARCH */
  documents: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.oasis.opendocument.text',
    'text/plain',
    'text/markdown',
    'text/html',
    'application/rtf',
    'application/epub+zip',
  ],

  /** Audio files - route to TEXT_CONTEXT with STT */
  audio: [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/wave',
    'audio/x-wav',
    'audio/ogg',
    'audio/flac',
    'audio/aac',
    'audio/m4a',
    'audio/webm',
  ],

  /** Video files */
  video: [
    'video/mp4',
    'video/mpeg',
    'video/webm',
    'video/ogg',
    'video/quicktime',
    'video/x-msvideo',
  ],

  /** Archive files */
  archives: [
    'application/zip',
    'application/x-zip-compressed',
    'application/x-rar-compressed',
    'application/x-tar',
    'application/gzip',
    'application/x-7z-compressed',
  ],
};

/**
 * File extension patterns (fallback when MIME type is unreliable)
 */
export const EXTENSION_PATTERNS = {
  images: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.heic', '.heif'],
  spreadsheets: ['.xlsx', '.xls', '.csv', '.ods', '.tsv'],
  code: [
    '.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.c', '.cpp', '.cs', '.go', '.rs',
    '.json', '.yaml', '.yml', '.xml', '.sql', '.sh', '.bash', '.rb', '.php', '.swift',
    '.kt', '.scala', '.r', '.m', '.h', '.hpp', '.vue', '.svelte',
  ],
  documents: ['.pdf', '.doc', '.docx', '.odt', '.txt', '.md', '.html', '.htm', '.rtf', '.epub'],
  audio: ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.wma'],
  video: ['.mp4', '.mpeg', '.webm', '.ogv', '.mov', '.avi', '.wmv', '.mkv'],
  archives: ['.zip', '.rar', '.tar', '.gz', '.7z', '.bz2'],
};

/**
 * Strategy routing matrix
 * Defines primary and background strategies for each file category
 */
export const STRATEGY_MATRIX: Record<FileCategory, {
  primary: UploadStrategy;
  background: UploadStrategy[];
  description: string;
}> = {
  [FileCategory.IMAGE]: {
    primary: UploadStrategy.IMAGE,
    background: [], // Images don't need RAG embedding
    description: 'Route to vision/image processing',
  },
  [FileCategory.SPREADSHEET]: {
    primary: UploadStrategy.CODE_EXECUTOR,
    background: [UploadStrategy.FILE_SEARCH], // Also embed for search
    description: 'Route to code executor for calculations, also embed for search',
  },
  [FileCategory.CODE]: {
    primary: UploadStrategy.CODE_EXECUTOR,
    background: [UploadStrategy.FILE_SEARCH], // Also embed for search
    description: 'Route to code executor, also embed for search',
  },
  [FileCategory.DOCUMENT]: {
    primary: UploadStrategy.FILE_SEARCH,
    background: [], // FILE_SEARCH handles both text extraction and embedding
    description: 'Extract text and create embeddings for RAG',
  },
  [FileCategory.AUDIO]: {
    primary: UploadStrategy.TEXT_CONTEXT,
    background: [UploadStrategy.FILE_SEARCH], // Also embed transcription
    description: 'Transcribe audio (STT), then embed for search',
  },
  [FileCategory.VIDEO]: {
    primary: UploadStrategy.PROVIDER,
    background: [],
    description: 'Route to provider for native handling',
  },
  [FileCategory.ARCHIVE]: {
    primary: UploadStrategy.PROVIDER,
    background: [],
    description: 'Route to provider (may need extraction)',
  },
  [FileCategory.UNKNOWN]: {
    primary: UploadStrategy.FILE_SEARCH,
    background: [],
    description: 'Default: attempt text extraction and embedding',
  },
};

/**
 * Files that should NOT be embedded (too large, binary, etc.)
 */
export const EMBEDDING_EXCLUSIONS = {
  /** Max file size for embedding (50MB) */
  maxSize: 50 * 1024 * 1024,
  /** MIME types to exclude from embedding */
  excludedMimeTypes: [
    ...MIME_PATTERNS.video,
    ...MIME_PATTERNS.archives,
    'application/octet-stream',
    'application/x-executable',
    'application/x-msdos-program',
  ],
  /** Extensions to exclude */
  excludedExtensions: [
    '.exe', '.dll', '.so', '.dylib', '.bin', '.dat',
    ...EXTENSION_PATTERNS.video,
    ...EXTENSION_PATTERNS.archives,
  ],
};

/**
 * Files that need OCR processing
 */
export const OCR_CANDIDATES = {
  mimeTypes: [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/tiff',
    'image/bmp',
    'application/pdf', // Scanned PDFs
  ],
  extensions: ['.jpg', '.jpeg', '.png', '.tiff', '.bmp', '.pdf'],
};

/**
 * Files that need STT processing
 */
export const STT_CANDIDATES = {
  mimeTypes: MIME_PATTERNS.audio,
  extensions: EXTENSION_PATTERNS.audio,
};
