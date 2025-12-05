import { describe, it, expect } from 'vitest';
import { detectDocumentType, detectFromExtension, detectFromMimeType, DocumentType } from '../utils/detectType';

describe('detectType', () => {
  describe('detectFromExtension', () => {
    it('should detect DOCX', () => {
      expect(detectFromExtension('document.docx')).toBe(DocumentType.WORD);
    });

    it('should detect XLSX', () => {
      expect(detectFromExtension('spreadsheet.xlsx')).toBe(DocumentType.EXCEL);
    });

    it('should detect PPTX', () => {
      expect(detectFromExtension('presentation.pptx')).toBe(DocumentType.POWERPOINT);
    });

    it('should detect PDF', () => {
      expect(detectFromExtension('document.pdf')).toBe(DocumentType.PDF);
    });

    it('should detect CSV', () => {
      expect(detectFromExtension('data.csv')).toBe(DocumentType.CSV);
    });

    it('should return UNKNOWN for unsupported extensions', () => {
      expect(detectFromExtension('file.txt')).toBe(DocumentType.UNKNOWN);
    });
  });

  describe('detectFromMimeType', () => {
    it('should detect Word from MIME type', () => {
      const mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      expect(detectFromMimeType(mimeType)).toBe(DocumentType.WORD);
    });

    it('should detect Excel from MIME type', () => {
      const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      expect(detectFromMimeType(mimeType)).toBe(DocumentType.EXCEL);
    });

    it('should detect PDF from MIME type', () => {
      expect(detectFromMimeType('application/pdf')).toBe(DocumentType.PDF);
    });

    it('should detect CSV from MIME type', () => {
      expect(detectFromMimeType('text/csv')).toBe(DocumentType.CSV);
      expect(detectFromMimeType('application/csv')).toBe(DocumentType.CSV);
    });
  });

  describe('detectDocumentType', () => {
    it('should detect from extension', () => {
      const buffer = new ArrayBuffer(0);
      const type = detectDocumentType(buffer, 'test.docx');
      expect(type).toBe(DocumentType.WORD);
    });

    it('should detect from MIME type', () => {
      const buffer = new ArrayBuffer(0);
      const type = detectDocumentType(buffer, undefined, 'application/pdf');
      expect(type).toBe(DocumentType.PDF);
    });

    it('should detect PDF signature', () => {
      // PDF signature: %PDF
      const buffer = new ArrayBuffer(8);
      const view = new Uint8Array(buffer);
      view[0] = 0x25; // %
      view[1] = 0x50; // P
      view[2] = 0x44; // D
      view[3] = 0x46; // F
      
      const type = detectDocumentType(buffer);
      expect(type).toBe(DocumentType.PDF);
    });
  });
});
