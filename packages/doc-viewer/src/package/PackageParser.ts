/**
 */

import {Unzipped} from '../util/fflate';

export interface PackageParser {
  load(docxFile: ArrayBuffer | string): void;

  /**
   */
  getXML(filePath: string): Document;

  /**
   */
  getFileByType(
    filePath: string,
    type: 'string' | 'blob' | 'uint8array'
  ): string | Blob | Uint8Array | null;

  /**
   */
  getString(filePath: string): string;

  /**
   */
  saveFile(filePath: string, content: Uint8Array | string): void;

  /**
   */
  fileExists(filePath: string): boolean;

  /**
   *
   */
  generateZipBlob(docContent: string): Blob;

  generateZip(): Uint8Array;

  getZip(): Unzipped;
}
