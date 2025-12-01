import { describe, it, expect, beforeEach } from 'vitest';
import { ZipParser } from '../parsers/zip/ZipParser';

describe('ZipParser', () => {
  let zipParser: ZipParser;

  beforeEach(() => {
    zipParser = new ZipParser();
  });

  it('should create instance', () => {
    expect(zipParser).toBeInstanceOf(ZipParser);
  });

  it('should have zero entries initially', () => {
    expect(zipParser.entryCount).toBe(0);
  });

  it('should clear entries', () => {
    zipParser.clear();
    expect(zipParser.entryCount).toBe(0);
  });

  it('should get file paths', () => {
    const paths = zipParser.getFilePaths();
    expect(Array.isArray(paths)).toBe(true);
  });

  it('should check file existence', () => {
    const exists = zipParser.hasFile('test.txt');
    expect(typeof exists).toBe('boolean');
  });
});
