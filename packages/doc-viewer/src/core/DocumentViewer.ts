import { DocumentType, IViewer, ViewerOptions } from './types';
import { WordViewer } from '../viewers/WordViewer';
import { ExcelViewer } from '../viewers/ExcelViewer';
import { PDFViewer } from '../viewers/PDFViewer';

/**
 * Base Document Viewer class
 * Provides common functionality for all document types
 */
export abstract class DocumentViewer implements IViewer {
  protected container: HTMLElement;
  protected options: ViewerOptions;
  protected isLoaded: boolean = false;
  protected isDestroyed: boolean = false;

  constructor(container: HTMLElement, options: Partial<ViewerOptions> = {}) {
    this.container = container;
    this.options = {
      container,
      classPrefix: 'doc-viewer-',
      enableSelection: true,
      enableCopy: true,
      showToolbar: false,
      debug: false,
      ...options,
    };

    this.initialize();
  }

  /**
   * Initialize viewer
   */
  protected initialize(): void {
    this.container.classList.add(`${this.options.classPrefix}container`);
  }

  /**
   * Render document from ArrayBuffer
   */
  abstract renderFile(data: ArrayBuffer): Promise<void>;

  /**
   * Render document from URL
   */
  async renderURL(url: string): Promise<void> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch document: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      await this.renderFile(arrayBuffer);
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Destroy viewer and cleanup
   */
  destroy(): void {
    if (this.isDestroyed) return;

    this.cleanup();
    this.container.innerHTML = '';
    this.container.classList.remove(`${this.options.classPrefix}container`);
    this.isDestroyed = true;
  }

  /**
   * Cleanup resources (override in subclasses)
   */
  protected cleanup(): void {
    // Override in subclasses
  }

  /**
   * Get document metadata
   */
  abstract getMetadata(): import('./types').DocumentMetadata;

  /**
   * Search in document
   */
  abstract search(query: string): Promise<import('./types').SearchResult[]>;

  /**
   * Handle errors
   */
  protected handleError(error: Error): void {
    if (this.options.onError) {
      this.options.onError(error);
    } else if (this.options.debug) {
      console.error('[DocumentViewer]', error);
    }
  }

  /**
   * Report progress
   */
  protected reportProgress(progress: number): void {
    if (this.options.onProgress) {
      this.options.onProgress(Math.max(0, Math.min(100, progress)));
    }
  }

  /**
   * Emit load event
   */
  protected emitLoad(): void {
    this.isLoaded = true;
    if (this.options.onLoad) {
      this.options.onLoad();
    }
  }
}

