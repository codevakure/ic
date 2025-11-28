/**
 * Tests for Attachment Routing Module
 */

import {
  routeAttachment,
  routeAttachments,
  categorizeFile,
  shouldEmbedFile,
  needsOCR,
  needsSTT,
  DEFAULT_ROUTING_CONFIG,
} from '../attachments';

import {
  AttachmentFile,
  FileCategory,
  UploadStrategy,
} from '../attachments/types';

describe('categorizeFile', () => {
  it('should categorize image files correctly', () => {
    const file: AttachmentFile = {
      file_id: '1',
      filename: 'photo.jpg',
      mimetype: 'image/jpeg',
      size: 1000,
    };
    expect(categorizeFile(file)).toBe(FileCategory.IMAGE);
  });

  it('should categorize PNG images', () => {
    const file: AttachmentFile = {
      file_id: '2',
      filename: 'screenshot.png',
      mimetype: 'image/png',
      size: 2000,
    };
    expect(categorizeFile(file)).toBe(FileCategory.IMAGE);
  });

  it('should categorize spreadsheets correctly', () => {
    const file: AttachmentFile = {
      file_id: '3',
      filename: 'data.xlsx',
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: 5000,
    };
    expect(categorizeFile(file)).toBe(FileCategory.SPREADSHEET);
  });

  it('should categorize CSV as spreadsheet', () => {
    const file: AttachmentFile = {
      file_id: '4',
      filename: 'data.csv',
      mimetype: 'text/csv',
      size: 1000,
    };
    expect(categorizeFile(file)).toBe(FileCategory.SPREADSHEET);
  });

  it('should categorize code files correctly', () => {
    const file: AttachmentFile = {
      file_id: '5',
      filename: 'script.py',
      mimetype: 'text/x-python',
      size: 500,
    };
    expect(categorizeFile(file)).toBe(FileCategory.CODE);
  });

  it('should categorize documents correctly', () => {
    const file: AttachmentFile = {
      file_id: '6',
      filename: 'document.pdf',
      mimetype: 'application/pdf',
      size: 10000,
    };
    expect(categorizeFile(file)).toBe(FileCategory.DOCUMENT);
  });

  it('should categorize audio files correctly', () => {
    const file: AttachmentFile = {
      file_id: '7',
      filename: 'audio.mp3',
      mimetype: 'audio/mpeg',
      size: 5000,
    };
    expect(categorizeFile(file)).toBe(FileCategory.AUDIO);
  });

  it('should fallback to extension when MIME is generic', () => {
    const file: AttachmentFile = {
      file_id: '8',
      filename: 'script.py',
      mimetype: 'application/octet-stream',
      size: 500,
      extension: '.py',
    };
    expect(categorizeFile(file)).toBe(FileCategory.CODE);
  });

  it('should return UNKNOWN for unrecognized files', () => {
    const file: AttachmentFile = {
      file_id: '9',
      filename: 'unknown.xyz',
      mimetype: 'application/octet-stream',
      size: 500,
    };
    expect(categorizeFile(file)).toBe(FileCategory.UNKNOWN);
  });
});

describe('routeAttachment', () => {
  it('should route images to IMAGE strategy', () => {
    const file: AttachmentFile = {
      file_id: '1',
      filename: 'photo.jpg',
      mimetype: 'image/jpeg',
      size: 1000,
    };
    const result = routeAttachment(file);
    expect(result.primaryStrategy).toBe(UploadStrategy.IMAGE);
    expect(result.shouldEmbed).toBe(false);
    expect(result.category).toBe(FileCategory.IMAGE);
  });

  it('should route spreadsheets to CODE_EXECUTOR with FILE_SEARCH background', () => {
    const file: AttachmentFile = {
      file_id: '2',
      filename: 'data.xlsx',
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: 5000,
    };
    const result = routeAttachment(file);
    expect(result.primaryStrategy).toBe(UploadStrategy.CODE_EXECUTOR);
    expect(result.backgroundStrategies).toContain(UploadStrategy.FILE_SEARCH);
    expect(result.shouldEmbed).toBe(true);
  });

  it('should route documents to FILE_SEARCH', () => {
    const file: AttachmentFile = {
      file_id: '3',
      filename: 'document.pdf',
      mimetype: 'application/pdf',
      size: 10000,
    };
    const result = routeAttachment(file);
    expect(result.primaryStrategy).toBe(UploadStrategy.FILE_SEARCH);
    expect(result.shouldEmbed).toBe(true);
  });

  it('should route audio to TEXT_CONTEXT with STT', () => {
    const file: AttachmentFile = {
      file_id: '4',
      filename: 'audio.mp3',
      mimetype: 'audio/mpeg',
      size: 5000,
    };
    const result = routeAttachment(file);
    expect(result.primaryStrategy).toBe(UploadStrategy.TEXT_CONTEXT);
    expect(result.needsSTT).toBe(true);
  });

  it('should mark PDF as needing OCR', () => {
    const file: AttachmentFile = {
      file_id: '5',
      filename: 'scanned.pdf',
      mimetype: 'application/pdf',
      size: 10000,
    };
    const result = routeAttachment(file);
    expect(result.needsOCR).toBe(true);
  });
});

describe('routeAttachments', () => {
  it('should route multiple files and provide summary', () => {
    const files: AttachmentFile[] = [
      { file_id: '1', filename: 'photo.jpg', mimetype: 'image/jpeg', size: 1000 },
      { file_id: '2', filename: 'data.csv', mimetype: 'text/csv', size: 2000 },
      { file_id: '3', filename: 'doc.pdf', mimetype: 'application/pdf', size: 5000 },
    ];
    
    const result = routeAttachments(files);
    
    expect(result.files).toHaveLength(3);
    expect(result.summary.total).toBe(3);
    expect(result.summary.byCategory[FileCategory.IMAGE]).toBe(1);
    expect(result.summary.byCategory[FileCategory.SPREADSHEET]).toBe(1);
    expect(result.summary.byCategory[FileCategory.DOCUMENT]).toBe(1);
  });
});

describe('shouldEmbedFile', () => {
  it('should not embed images', () => {
    const file: AttachmentFile = {
      file_id: '1',
      filename: 'photo.jpg',
      mimetype: 'image/jpeg',
      size: 1000,
    };
    expect(shouldEmbedFile(file, FileCategory.IMAGE)).toBe(false);
  });

  it('should embed documents', () => {
    const file: AttachmentFile = {
      file_id: '2',
      filename: 'doc.pdf',
      mimetype: 'application/pdf',
      size: 10000,
    };
    expect(shouldEmbedFile(file, FileCategory.DOCUMENT)).toBe(true);
  });

  it('should not embed files exceeding size limit', () => {
    const file: AttachmentFile = {
      file_id: '3',
      filename: 'huge.pdf',
      mimetype: 'application/pdf',
      size: 100 * 1024 * 1024, // 100MB
    };
    expect(shouldEmbedFile(file, FileCategory.DOCUMENT)).toBe(false);
  });

  it('should respect RAG disabled config', () => {
    const file: AttachmentFile = {
      file_id: '4',
      filename: 'doc.pdf',
      mimetype: 'application/pdf',
      size: 10000,
    };
    const config = { ...DEFAULT_ROUTING_CONFIG, enableRAG: false };
    expect(shouldEmbedFile(file, FileCategory.DOCUMENT, config)).toBe(false);
  });
});

describe('needsOCR', () => {
  it('should return true for images', () => {
    const file: AttachmentFile = {
      file_id: '1',
      filename: 'scan.jpg',
      mimetype: 'image/jpeg',
      size: 1000,
    };
    expect(needsOCR(file)).toBe(true);
  });

  it('should return true for PDFs', () => {
    const file: AttachmentFile = {
      file_id: '2',
      filename: 'scanned.pdf',
      mimetype: 'application/pdf',
      size: 10000,
    };
    expect(needsOCR(file)).toBe(true);
  });

  it('should return false for text files', () => {
    const file: AttachmentFile = {
      file_id: '3',
      filename: 'readme.txt',
      mimetype: 'text/plain',
      size: 500,
    };
    expect(needsOCR(file)).toBe(false);
  });
});

describe('needsSTT', () => {
  it('should return true for audio files', () => {
    const file: AttachmentFile = {
      file_id: '1',
      filename: 'audio.mp3',
      mimetype: 'audio/mpeg',
      size: 5000,
    };
    expect(needsSTT(file)).toBe(true);
  });

  it('should return true for wav files', () => {
    const file: AttachmentFile = {
      file_id: '2',
      filename: 'recording.wav',
      mimetype: 'audio/wav',
      size: 10000,
    };
    expect(needsSTT(file)).toBe(true);
  });

  it('should return false for non-audio files', () => {
    const file: AttachmentFile = {
      file_id: '3',
      filename: 'doc.pdf',
      mimetype: 'application/pdf',
      size: 5000,
    };
    expect(needsSTT(file)).toBe(false);
  });
});
