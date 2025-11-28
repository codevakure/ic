/**
 * Tests for Core Intent Analyzer - Upload Intent
 */

import {
  analyzeUploadIntent,
  analyzeUploadIntents,
  getUploadEndpoint,
  getToolResource,
  UploadIntent,
  FileInfo,
} from '../core';

describe('Upload Intent Analyzer', () => {
  describe('analyzeUploadIntent', () => {
    describe('Images → IMAGE', () => {
      const imageFiles: FileInfo[] = [
        { filename: 'photo.png', mimetype: 'image/png' },
        { filename: 'picture.jpg', mimetype: 'image/jpeg' },
        { filename: 'animation.gif', mimetype: 'image/gif' },
        { filename: 'modern.webp', mimetype: 'image/webp' },
        { filename: 'icon.svg', mimetype: 'image/svg+xml' },
      ];

      it.each(imageFiles)('should route $filename to IMAGE', (file) => {
        const result = analyzeUploadIntent(file);
        expect(result.intent).toBe(UploadIntent.IMAGE);
        expect(result.confidence).toBeGreaterThanOrEqual(0.85);
      });
    });

    describe('Spreadsheets → CODE_INTERPRETER', () => {
      const spreadsheetFiles: FileInfo[] = [
        { filename: 'data.xlsx', mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        { filename: 'legacy.xls', mimetype: 'application/vnd.ms-excel' },
        { filename: 'export.csv', mimetype: 'text/csv' },
        { filename: 'tabbed.tsv', mimetype: 'text/tab-separated-values' },
      ];

      it.each(spreadsheetFiles)('should route $filename to CODE_INTERPRETER', (file) => {
        const result = analyzeUploadIntent(file);
        expect(result.intent).toBe(UploadIntent.CODE_INTERPRETER);
        expect(result.confidence).toBeGreaterThanOrEqual(0.85);
      });
    });

    describe('Code files → CODE_INTERPRETER', () => {
      const codeFiles: FileInfo[] = [
        { filename: 'script.py', mimetype: 'text/x-python' },
        { filename: 'app.js', mimetype: 'application/javascript' },
        { filename: 'types.ts', mimetype: 'application/typescript' },
        { filename: 'config.json', mimetype: 'application/json' },
        { filename: 'setup.yaml', mimetype: 'application/x-yaml' },
        { filename: 'query.sql', mimetype: 'text/plain' },
        { filename: 'script.sh', mimetype: 'text/x-shellscript' },
      ];

      it.each(codeFiles)('should route $filename to CODE_INTERPRETER', (file) => {
        const result = analyzeUploadIntent(file);
        expect(result.intent).toBe(UploadIntent.CODE_INTERPRETER);
        expect(result.confidence).toBeGreaterThanOrEqual(0.85);
      });
    });

    describe('Documents → FILE_SEARCH', () => {
      const documentFiles: FileInfo[] = [
        { filename: 'report.pdf', mimetype: 'application/pdf' },
        { filename: 'document.docx', mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
        { filename: 'notes.txt', mimetype: 'text/plain' },
        { filename: 'readme.md', mimetype: 'text/markdown' },
        { filename: 'page.html', mimetype: 'text/html' },
      ];

      it.each(documentFiles)('should route $filename to FILE_SEARCH', (file) => {
        const result = analyzeUploadIntent(file);
        expect(result.intent).toBe(UploadIntent.FILE_SEARCH);
        expect(result.confidence).toBeGreaterThanOrEqual(0.5);
      });
    });

    it('should default unknown files to FILE_SEARCH with low confidence', () => {
      const unknownFile: FileInfo = {
        filename: 'mystery.xyz',
        mimetype: 'application/octet-stream',
      };
      const result = analyzeUploadIntent(unknownFile);
      expect(result.intent).toBe(UploadIntent.FILE_SEARCH);
      expect(result.confidence).toBe(0.5);
    });
  });

  describe('analyzeUploadIntents (batch)', () => {
    it('should group multiple files by upload intent', () => {
      const files: FileInfo[] = [
        { filename: 'photo.png', mimetype: 'image/png' },
        { filename: 'data.xlsx', mimetype: 'application/vnd.ms-excel' },
        { filename: 'report.pdf', mimetype: 'application/pdf' },
        { filename: 'script.py', mimetype: 'text/x-python' },
        { filename: 'avatar.jpg', mimetype: 'image/jpeg' },
      ];

      const result = analyzeUploadIntents(files);

      // Check groups
      expect(result.groups.get(UploadIntent.IMAGE)?.length).toBe(2);
      expect(result.groups.get(UploadIntent.CODE_INTERPRETER)?.length).toBe(2);
      expect(result.groups.get(UploadIntent.FILE_SEARCH)?.length).toBe(1);

      // Check individual results
      expect(result.files.length).toBe(5);
    });

    it('should handle empty file list', () => {
      const result = analyzeUploadIntents([]);
      expect(result.groups.get(UploadIntent.IMAGE)?.length).toBe(0);
      expect(result.groups.get(UploadIntent.CODE_INTERPRETER)?.length).toBe(0);
      expect(result.groups.get(UploadIntent.FILE_SEARCH)?.length).toBe(0);
      expect(result.files.length).toBe(0);
    });
  });

  describe('getUploadEndpoint', () => {
    it('should return correct endpoints', () => {
      expect(getUploadEndpoint(UploadIntent.IMAGE)).toBe('/api/files/images');
      expect(getUploadEndpoint(UploadIntent.FILE_SEARCH)).toBe('/api/files/agents');
      expect(getUploadEndpoint(UploadIntent.CODE_INTERPRETER)).toBe('/api/files/agents');
    });
  });

  describe('getToolResource', () => {
    it('should return correct tool_resource values', () => {
      expect(getToolResource(UploadIntent.IMAGE)).toBeNull();
      expect(getToolResource(UploadIntent.FILE_SEARCH)).toBe('file_search');
      expect(getToolResource(UploadIntent.CODE_INTERPRETER)).toBe('execute_code');
    });
  });
});
