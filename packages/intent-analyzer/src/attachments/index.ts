/**
 * Attachment Routing Module
 * 
 * Analyzes file attachments and routes them to appropriate upload strategies:
 * - Image files → IMAGE strategy (vision models)
 * - Spreadsheets/Code → CODE_EXECUTOR strategy
 * - Documents → FILE_SEARCH strategy (RAG)
 * - Audio → TEXT_CONTEXT strategy (STT)
 * 
 * Additionally kicks off background embedding for all eligible files.
 */

import {
  AttachmentFile,
  AttachmentRouteResult,
  AttachmentRoutingConfig,
  BatchRouteResult,
  FileCategory,
  UploadStrategy,
} from './types';

import {
  MIME_PATTERNS,
  EXTENSION_PATTERNS,
  STRATEGY_MATRIX,
  EMBEDDING_EXCLUSIONS,
  OCR_CANDIDATES,
  STT_CANDIDATES,
} from './matrix';

/**
 * Default routing configuration
 */
export const DEFAULT_ROUTING_CONFIG: AttachmentRoutingConfig = {
  enableRAG: true,
  enableCodeExecutor: true,
  enableOCR: true,
  enableSTT: true,
  imageMimeTypes: MIME_PATTERNS.images,
  spreadsheetMimeTypes: MIME_PATTERNS.spreadsheets,
  codeMimeTypes: MIME_PATTERNS.code,
  documentMimeTypes: MIME_PATTERNS.documents,
  audioMimeTypes: MIME_PATTERNS.audio,
  maxEmbeddingSize: EMBEDDING_EXCLUSIONS.maxSize,
};

/**
 * Get file extension from filename
 */
function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.substring(lastDot).toLowerCase();
}

/**
 * Categorize file by MIME type and extension
 */
export function categorizeFile(file: AttachmentFile): FileCategory {
  const { mimetype, filename } = file;
  const extension = file.extension || getExtension(filename);
  const mimeLC = mimetype.toLowerCase();

  // Check by MIME type first (more reliable)
  if (MIME_PATTERNS.images.some(m => mimeLC.includes(m) || mimeLC.startsWith('image/'))) {
    return FileCategory.IMAGE;
  }
  if (MIME_PATTERNS.spreadsheets.some(m => mimeLC.includes(m))) {
    return FileCategory.SPREADSHEET;
  }
  if (MIME_PATTERNS.code.some(m => mimeLC.includes(m))) {
    return FileCategory.CODE;
  }
  if (MIME_PATTERNS.documents.some(m => mimeLC.includes(m))) {
    return FileCategory.DOCUMENT;
  }
  if (MIME_PATTERNS.audio.some(m => mimeLC.includes(m) || mimeLC.startsWith('audio/'))) {
    return FileCategory.AUDIO;
  }
  if (MIME_PATTERNS.video.some(m => mimeLC.includes(m) || mimeLC.startsWith('video/'))) {
    return FileCategory.VIDEO;
  }
  if (MIME_PATTERNS.archives.some(m => mimeLC.includes(m))) {
    return FileCategory.ARCHIVE;
  }

  // Fallback to extension
  if (EXTENSION_PATTERNS.images.includes(extension)) {
    return FileCategory.IMAGE;
  }
  if (EXTENSION_PATTERNS.spreadsheets.includes(extension)) {
    return FileCategory.SPREADSHEET;
  }
  if (EXTENSION_PATTERNS.code.includes(extension)) {
    return FileCategory.CODE;
  }
  if (EXTENSION_PATTERNS.documents.includes(extension)) {
    return FileCategory.DOCUMENT;
  }
  if (EXTENSION_PATTERNS.audio.includes(extension)) {
    return FileCategory.AUDIO;
  }
  if (EXTENSION_PATTERNS.video.includes(extension)) {
    return FileCategory.VIDEO;
  }
  if (EXTENSION_PATTERNS.archives.includes(extension)) {
    return FileCategory.ARCHIVE;
  }

  // Check for text-like content
  if (mimeLC.startsWith('text/')) {
    return FileCategory.DOCUMENT;
  }

  return FileCategory.UNKNOWN;
}

/**
 * Check if file should be embedded for RAG
 */
export function shouldEmbedFile(
  file: AttachmentFile,
  category: FileCategory,
  config: AttachmentRoutingConfig = DEFAULT_ROUTING_CONFIG
): boolean {
  if (!config.enableRAG) return false;

  // Check size limit
  if (file.size > config.maxEmbeddingSize) return false;

  // Check exclusions
  const extension = file.extension || getExtension(file.filename);
  if (EMBEDDING_EXCLUSIONS.excludedMimeTypes.includes(file.mimetype.toLowerCase())) {
    return false;
  }
  if (EMBEDDING_EXCLUSIONS.excludedExtensions.includes(extension)) {
    return false;
  }

  // Images don't need embedding (they use vision)
  if (category === FileCategory.IMAGE) return false;

  // Videos and archives are excluded
  if (category === FileCategory.VIDEO || category === FileCategory.ARCHIVE) return false;

  // Everything else should be embedded
  return true;
}

/**
 * Check if file needs OCR processing
 */
export function needsOCR(
  file: AttachmentFile,
  config: AttachmentRoutingConfig = DEFAULT_ROUTING_CONFIG
): boolean {
  if (!config.enableOCR) return false;

  const extension = file.extension || getExtension(file.filename);
  const mimeLC = file.mimetype.toLowerCase();

  return (
    OCR_CANDIDATES.mimeTypes.some(m => mimeLC.includes(m)) ||
    OCR_CANDIDATES.extensions.includes(extension)
  );
}

/**
 * Check if file needs STT processing
 */
export function needsSTT(
  file: AttachmentFile,
  config: AttachmentRoutingConfig = DEFAULT_ROUTING_CONFIG
): boolean {
  if (!config.enableSTT) return false;

  const extension = file.extension || getExtension(file.filename);
  const mimeLC = file.mimetype.toLowerCase();

  return (
    STT_CANDIDATES.mimeTypes.some(m => mimeLC.includes(m)) ||
    STT_CANDIDATES.extensions.includes(extension)
  );
}

/**
 * Route a single attachment to appropriate strategy
 */
export function routeAttachment(
  file: AttachmentFile,
  config: AttachmentRoutingConfig = DEFAULT_ROUTING_CONFIG
): AttachmentRouteResult {
  const category = categorizeFile(file);
  const strategyConfig = STRATEGY_MATRIX[category];
  
  // Determine if file should be embedded
  const shouldEmbed = shouldEmbedFile(file, category, config);
  
  // Check for special processing needs
  const fileNeedsOCR = needsOCR(file, config);
  const fileNeedsSTT = needsSTT(file, config);

  // Build background strategies
  let backgroundStrategies = [...strategyConfig.background];
  
  // Add FILE_SEARCH to background if embedding is needed but not primary
  if (shouldEmbed && strategyConfig.primary !== UploadStrategy.FILE_SEARCH) {
    if (!backgroundStrategies.includes(UploadStrategy.FILE_SEARCH)) {
      backgroundStrategies.push(UploadStrategy.FILE_SEARCH);
    }
  }

  // Build reasoning
  const reasons: string[] = [strategyConfig.description];
  if (shouldEmbed) {
    reasons.push('Will create embeddings for RAG search');
  }
  if (fileNeedsOCR) {
    reasons.push('Requires OCR for text extraction');
  }
  if (fileNeedsSTT) {
    reasons.push('Requires STT for audio transcription');
  }

  return {
    file,
    primaryStrategy: strategyConfig.primary,
    backgroundStrategies,
    category,
    shouldEmbed,
    needsOCR: fileNeedsOCR,
    needsSTT: fileNeedsSTT,
    confidence: 0.9, // High confidence for rule-based routing
    reasoning: reasons.join('. '),
  };
}

/**
 * Route multiple attachments
 */
export function routeAttachments(
  files: AttachmentFile[],
  config: AttachmentRoutingConfig = DEFAULT_ROUTING_CONFIG
): BatchRouteResult {
  const results = files.map(file => routeAttachment(file, config));

  // Build summary
  const byStrategy: Record<UploadStrategy, number> = {
    [UploadStrategy.IMAGE]: 0,
    [UploadStrategy.CODE_EXECUTOR]: 0,
    [UploadStrategy.FILE_SEARCH]: 0,
    [UploadStrategy.TEXT_CONTEXT]: 0,
    [UploadStrategy.PROVIDER]: 0,
  };

  const byCategory: Record<FileCategory, number> = {
    [FileCategory.IMAGE]: 0,
    [FileCategory.SPREADSHEET]: 0,
    [FileCategory.CODE]: 0,
    [FileCategory.DOCUMENT]: 0,
    [FileCategory.AUDIO]: 0,
    [FileCategory.VIDEO]: 0,
    [FileCategory.ARCHIVE]: 0,
    [FileCategory.UNKNOWN]: 0,
  };

  for (const result of results) {
    byStrategy[result.primaryStrategy]++;
    byCategory[result.category]++;
  }

  return {
    files: results,
    summary: {
      total: files.length,
      byStrategy,
      byCategory,
    },
  };
}

/**
 * Check if a file type is supported for a specific strategy
 */
export function isStrategySupported(
  file: AttachmentFile,
  strategy: UploadStrategy,
  config: AttachmentRoutingConfig = DEFAULT_ROUTING_CONFIG
): boolean {
  const category = categorizeFile(file);
  const routing = STRATEGY_MATRIX[category];
  
  return (
    routing.primary === strategy ||
    routing.background.includes(strategy)
  );
}

export default {
  routeAttachment,
  routeAttachments,
  categorizeFile,
  shouldEmbedFile,
  needsOCR,
  needsSTT,
  isStrategySupported,
  DEFAULT_ROUTING_CONFIG,
};
