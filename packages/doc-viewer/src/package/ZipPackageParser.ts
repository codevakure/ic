/**
 */

import {zipSync, unzipSync, Unzipped, strFromU8, strToU8} from '../util/fflate';

import {PackageParser} from './PackageParser';

export default class ZipPackageParser implements PackageParser {
  private zip: Unzipped;

  /**
   */
  load(docxFile: ArrayBuffer) {
    // Avoid duplicate parsing
    if (!this.zip) {
      this.zip = unzipSync(new Uint8Array(docxFile));
    }
  }

  /**
   */
  getXML(filePath: string): Document {
    const fileContent = this.getFileByType(filePath, 'string') as string;

    const doc = new DOMParser().parseFromString(fileContent, 'application/xml');

    const errorNode = doc.getElementsByTagName('parsererror').item(0);
    if (errorNode) {
      throw new Error(errorNode.textContent || "can't parse xml");
    } else {
      return doc;
    }
  }

  /**
   */
  getFileByType(
    filePath: string,
    type: 'string' | 'blob' | 'uint8array' = 'string'
  ) {
    filePath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
    let file = this.zip[filePath];
    if (!file) {
      // Use case-insensitive search
      for (const key in this.zip) {
        if (key.toLowerCase() === filePath.toLowerCase()) {
          file = this.zip[key];
          break;
        }
      }
    }

    if (file) {
      if (type === 'string') {
        return strFromU8(file);
      } else if (type === 'blob') {
        return new Blob([file as any]);
      } else if (type === 'uint8array') {
        return file;
      }
    }

    console.warn('getFileByType', filePath, 'not found');
    return null;
  }

  /**
   */
  getString(filePath: string): string {
    return this.getFileByType(filePath, 'string') as string;
  }

  /**
   */
  saveFile(filePath: string, content: Uint8Array | string): void {
    if (typeof content === 'string') {
      content = strToU8(content);
    }
    this.zip[filePath] = content;
  }

  /**
   */
  fileExists(filePath: string) {
    filePath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
    if (filePath in this.zip) {
      return true;
    }

    // Support case-insensitive matching
    for (const key in this.zip) {
      if (key.toLowerCase() === filePath.toLowerCase()) {
        return true;
      }
    }

    return false;
  }

  /**
   */
  generateZipBlob(docContent?: string) {
    if (docContent) {
      // [comment removed]
      this.zip['word/document.xml'] = strToU8(docContent);
    }

    return new Blob([zipSync(this.zip)]);
  }

  generateZip() {
    return zipSync(this.zip);
  }

  getZip() {
    return this.zip;
  }
}
