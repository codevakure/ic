import { DocumentType, ViewerOptions, IViewer } from './types';
import { WordViewer } from '../viewers/WordViewer';
import { ExcelViewer } from '../viewers/ExcelViewer';
import { PDFViewer } from '../viewers/PDFViewer';
import { PPTXViewer } from '../viewers/PPTXViewer';

/**
 * Create appropriate viewer based on document type
 */
export function createDocumentViewer(
  container: HTMLElement,
  type: DocumentType,
  options: Partial<ViewerOptions> = {}
): IViewer {
  switch (type) {
    case DocumentType.WORD:
      return new WordViewer(container, options as any);
    case DocumentType.EXCEL:
      return new ExcelViewer(container, options as any);
    case DocumentType.PDF:
      return new PDFViewer(container, options as any);
    case DocumentType.POWERPOINT:
      return new PPTXViewer(container, options as any);
    default:
      throw new Error(`Unsupported document type: ${type}`);
  }
}