import { DocumentType } from '../core/types';

// Re-export DocumentType for convenience
export { DocumentType };

/**
 * MIME type to document type mapping
 */
const MIME_TYPE_MAP: Record<string, DocumentType> = {
  // Word
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': DocumentType.WORD,
  'application/msword': DocumentType.WORD,
  'application/vnd.ms-word': DocumentType.WORD,
  
  // Excel
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': DocumentType.EXCEL,
  'application/vnd.ms-excel': DocumentType.EXCEL,
  'application/vnd.ms-excel.sheet.macroEnabled.12': DocumentType.EXCEL,
  
  // PowerPoint
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': DocumentType.POWERPOINT,
  'application/vnd.ms-powerpoint': DocumentType.POWERPOINT,
  'application/vnd.ms-powerpoint.presentation.macroEnabled.12': DocumentType.POWERPOINT,
  
  // PDF
  'application/pdf': DocumentType.PDF,
  
  // CSV
  'text/csv': DocumentType.CSV,
  'application/csv': DocumentType.CSV,
  'text/comma-separated-values': DocumentType.CSV,
};

/**
 * File extension to document type mapping
 */
const EXTENSION_MAP: Record<string, DocumentType> = {
  // Word
  'docx': DocumentType.WORD,
  'doc': DocumentType.WORD,
  'dotx': DocumentType.WORD,
  'dot': DocumentType.WORD,
  
  // Excel
  'xlsx': DocumentType.EXCEL,
  'xls': DocumentType.EXCEL,
  'xlsm': DocumentType.EXCEL,
  'xltx': DocumentType.EXCEL,
  'xlt': DocumentType.EXCEL,
  
  // PowerPoint
  'pptx': DocumentType.POWERPOINT,
  'ppt': DocumentType.POWERPOINT,
  'pptm': DocumentType.POWERPOINT,
  'potx': DocumentType.POWERPOINT,
  'pot': DocumentType.POWERPOINT,
  
  // PDF
  'pdf': DocumentType.PDF,
  
  // CSV
  'csv': DocumentType.CSV,
};

/**
 * Detect document type from MIME type
 */
export function detectFromMimeType(mimeType: string): DocumentType {
  return MIME_TYPE_MAP[mimeType.toLowerCase()] || DocumentType.UNKNOWN;
}

/**
 * Detect document type from file extension
 */
export function detectFromExtension(filename: string): DocumentType {
  const extension = filename.split('.').pop()?.toLowerCase();
  if (!extension) return DocumentType.UNKNOWN;
  return EXTENSION_MAP[extension] || DocumentType.UNKNOWN;
}

/**
 * Detect document type from file signature (magic bytes)
 */
export function detectFromSignature(data: ArrayBuffer): DocumentType {
  const view = new Uint8Array(data, 0, Math.min(8, data.byteLength));
  
  // PDF signature: %PDF
  if (view[0] === 0x25 && view[1] === 0x50 && view[2] === 0x44 && view[3] === 0x46) {
    return DocumentType.PDF;
  }
  
  // ZIP signature (Office Open XML): PK
  if (view[0] === 0x50 && view[1] === 0x4B) {
    // Office documents are ZIP files, need to check internal structure
    // For now, return UNKNOWN and rely on extension/MIME type
    return DocumentType.UNKNOWN;
  }
  
  // Legacy Office formats
  // MS Office signature: D0 CF 11 E0
  if (view[0] === 0xD0 && view[1] === 0xCF && view[2] === 0x11 && view[3] === 0xE0) {
    return DocumentType.UNKNOWN; // Need more analysis
  }
  
  return DocumentType.UNKNOWN;
}

/**
 * Comprehensive document type detection
 */
export function detectDocumentType(
  data: ArrayBuffer,
  filename?: string,
  mimeType?: string
): DocumentType {
  // Try MIME type first (most reliable if provided)
  if (mimeType) {
    const type = detectFromMimeType(mimeType);
    if (type !== DocumentType.UNKNOWN) return type;
  }
  
  // Try file signature
  const signatureType = detectFromSignature(data);
  if (signatureType !== DocumentType.UNKNOWN) return signatureType;
  
  // Try filename extension
  if (filename) {
    const extensionType = detectFromExtension(filename);
    if (extensionType !== DocumentType.UNKNOWN) return extensionType;
  }
  
  return DocumentType.UNKNOWN;
}

/**
 * Check if document type is supported
 */
export function isSupported(type: DocumentType): boolean {
  return type !== DocumentType.UNKNOWN;
}

/**
 * Get supported extensions
 */
export function getSupportedExtensions(): string[] {
  return Object.keys(EXTENSION_MAP);
}

/**
 * Get supported MIME types
 */
export function getSupportedMimeTypes(): string[] {
  return Object.keys(MIME_TYPE_MAP);
}
