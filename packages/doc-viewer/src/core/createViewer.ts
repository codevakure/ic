import { DocumentType } from './types';
import { createDocumentViewer } from './viewerFactory';
import type { IViewer, ViewerOptions } from './types';

/**
 * Factory function to create a viewer for any document type
 */
export function createViewer(
  container: HTMLElement,
  type: DocumentType,
  options: Partial<ViewerOptions> = {}
): IViewer {
  return createDocumentViewer(container, type, options);
}
