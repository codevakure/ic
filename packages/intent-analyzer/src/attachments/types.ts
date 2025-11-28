/**
 * Attachment Upload Strategy Types
 */

/**
 * Upload strategies for file attachments
 */
export enum UploadStrategy {
  /** Upload as image for vision models */
  IMAGE = 'image',
  /** Upload to code executor for computation (Excel, CSV, code files) */
  CODE_EXECUTOR = 'code_executor',
  /** Upload for RAG/file search (vector embeddings) */
  FILE_SEARCH = 'file_search',
  /** Upload as text context (OCR, audio transcription) */
  TEXT_CONTEXT = 'text_context',
  /** Direct provider upload (OpenAI, Anthropic native handling) */
  PROVIDER = 'provider',
}

/**
 * File processing status
 */
export enum FileProcessingStatus {
  PENDING = 'pending',
  UPLOADING = 'uploading',
  EXTRACTING = 'extracting',
  EMBEDDING = 'embedding',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * File category based on content type
 */
export enum FileCategory {
  IMAGE = 'image',
  DOCUMENT = 'document',
  SPREADSHEET = 'spreadsheet',
  CODE = 'code',
  AUDIO = 'audio',
  VIDEO = 'video',
  ARCHIVE = 'archive',
  UNKNOWN = 'unknown',
}

/**
 * Attachment file metadata
 */
export interface AttachmentFile {
  file_id: string;
  filename: string;
  mimetype: string;
  size: number;
  extension?: string;
}

/**
 * Result of attachment intent analysis
 */
export interface AttachmentRouteResult {
  file: AttachmentFile;
  /** Primary upload strategy */
  primaryStrategy: UploadStrategy;
  /** Secondary strategies to run in background */
  backgroundStrategies: UploadStrategy[];
  /** File category */
  category: FileCategory;
  /** Whether file should be embedded for RAG */
  shouldEmbed: boolean;
  /** Whether file needs OCR processing */
  needsOCR: boolean;
  /** Whether file needs STT processing */
  needsSTT: boolean;
  /** Confidence score 0-1 */
  confidence: number;
  /** Reasoning for the routing decision */
  reasoning: string;
}

/**
 * Configuration for attachment routing
 */
export interface AttachmentRoutingConfig {
  /** Enable RAG/embedding for all supported files */
  enableRAG: boolean;
  /** Enable code executor for spreadsheets */
  enableCodeExecutor: boolean;
  /** Enable OCR for images/scanned PDFs */
  enableOCR: boolean;
  /** Enable STT for audio files */
  enableSTT: boolean;
  /** Supported image types for vision */
  imageMimeTypes: string[];
  /** Supported spreadsheet types for code executor */
  spreadsheetMimeTypes: string[];
  /** Supported code file types */
  codeMimeTypes: string[];
  /** Supported document types for RAG */
  documentMimeTypes: string[];
  /** Supported audio types for STT */
  audioMimeTypes: string[];
  /** Maximum file size for embedding (bytes) */
  maxEmbeddingSize: number;
}

/**
 * File processing matrix entry
 */
export interface FileMatrixEntry {
  file_id: string;
  filename: string;
  mimetype: string;
  size: number;
  category: FileCategory;
  
  /** Storage info */
  storageStrategy: string; // s3, local, etc.
  storagePath?: string;
  
  /** Processing status for each strategy */
  strategies: {
    [K in UploadStrategy]?: {
      status: FileProcessingStatus;
      startedAt?: Date;
      completedAt?: Date;
      error?: string;
      metadata?: Record<string, unknown>;
    };
  };
  
  /** Extracted text content (for immediate use) */
  text?: string;
  
  /** Whether embedding is complete */
  embedded: boolean;
  
  /** Timestamps */
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Batch routing result
 */
export interface BatchRouteResult {
  files: AttachmentRouteResult[];
  summary: {
    total: number;
    byStrategy: Record<UploadStrategy, number>;
    byCategory: Record<FileCategory, number>;
  };
}
