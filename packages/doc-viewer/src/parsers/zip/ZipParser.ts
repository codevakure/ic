import { unzip, Unzipped } from 'fflate';

/**
 * ZIP file entry
 */
export interface ZipEntry {
  name: string;
  data: Uint8Array;
  isDirectory: boolean;
}

/**
 * ZIP Package Parser
 * Parses OOXML files (DOCX, XLSX, PPTX) which are ZIP archives
 */
export class ZipParser {
  private entries: Map<string, Uint8Array> = new Map();

  /**
   * Parse ZIP file from ArrayBuffer
   */
  async parse(data: ArrayBuffer): Promise<void> {
    const uint8Array = new Uint8Array(data);
    
    return new Promise((resolve, reject) => {
      unzip(uint8Array, (err, unzipped) => {
        if (err) {
          reject(new Error(`Failed to unzip file: ${err.message}`));
          return;
        }

        this.processUnzipped(unzipped);
        resolve();
      });
    });
  }

  /**
   * Process unzipped files
   */
  private processUnzipped(unzipped: Unzipped): void {
    this.entries.clear();
    
    for (const [path, data] of Object.entries(unzipped)) {
      // Normalize path (remove leading slash)
      const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
      this.entries.set(normalizedPath, data);
    }
  }

  /**
   * Get file as Uint8Array
   */
  getFile(path: string): Uint8Array | undefined {
    const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
    return this.entries.get(normalizedPath);
  }

  /**
   * Get file as string (UTF-8)
   */
  getFileAsString(path: string): string | undefined {
    const data = this.getFile(path);
    if (!data) return undefined;
    
    return new TextDecoder('utf-8').decode(data);
  }

  /**
   * Get file as XML Document
   */
  getFileAsXml(path: string): Document | undefined {
    const content = this.getFileAsString(path);
    if (!content) return undefined;

    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/xml');

    // Check for parsing errors
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      console.error(`XML parsing error for ${path}:`, parserError.textContent);
      return undefined;
    }

    return doc;
  }

  /**
   * Check if file exists
   */
  hasFile(path: string): boolean {
    const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
    return this.entries.has(normalizedPath);
  }

  /**
   * Get all file paths
   */
  getFilePaths(): string[] {
    return Array.from(this.entries.keys());
  }

  /**
   * Get files matching pattern
   */
  getFilesByPattern(pattern: RegExp): ZipEntry[] {
    const results: ZipEntry[] = [];
    
    for (const [path, data] of this.entries) {
      if (pattern.test(path)) {
        results.push({
          name: path,
          data,
          isDirectory: false,
        });
      }
    }
    
    return results;
  }

  /**
   * Get directory entries
   */
  getDirectory(dirPath: string): string[] {
    const normalizedDir = dirPath.endsWith('/') ? dirPath : `${dirPath}/`;
    const results: string[] = [];
    
    for (const path of this.entries.keys()) {
      if (path.startsWith(normalizedDir) && path !== normalizedDir) {
        // Get relative path
        const relativePath = path.slice(normalizedDir.length);
        // Only include direct children (not nested)
        if (!relativePath.includes('/')) {
          results.push(path);
        }
      }
    }
    
    return results;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries.clear();
  }

  /**
   * Get entry count
   */
  get entryCount(): number {
    return this.entries.size;
  }
}
