import { DocumentViewer } from '../core/DocumentViewer';
import type { DocumentMetadata, SearchResult, ViewerOptions } from '../core/types';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
}

/**
 * PDF-specific options
 */
export interface PDFOptions extends Partial<ViewerOptions> {
  /**
   * Scale factor for rendering
   */
  scale?: number;

  /**
   * Enable text layer
   */
  enableTextLayer?: boolean;

  /**
   * Max canvas size (pixels)
   */
  maxCanvasPixels?: number;
}

/**
 * PDF Document Viewer
 */
export class PDFViewer extends DocumentViewer {
  private pdfDocument: pdfjsLib.PDFDocumentProxy | null = null;
  private renderedPages: Map<number, HTMLCanvasElement> = new Map();
  private scale: number;
  private enableTextLayer: boolean;

  constructor(container: HTMLElement, options: PDFOptions = {}) {
    super(container, options);
    
    this.scale = options.scale || 1.5;
    this.enableTextLayer = options.enableTextLayer !== false;
    // maxCanvasPixels could be used for large page optimization
  }

  /**
   * Render PDF from ArrayBuffer
   */
  async renderFile(data: ArrayBuffer): Promise<void> {
    try {
      this.reportProgress(10);

      // Load PDF document
      const loadingTask = pdfjsLib.getDocument({ data });
      this.pdfDocument = await loadingTask.promise;

      this.reportProgress(30);

      // Render all pages
      await this.renderAllPages();

      this.reportProgress(100);
      this.emitLoad();
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Render all pages
   */
  private async renderAllPages(): Promise<void> {
    if (!this.pdfDocument) return;

    const numPages = this.pdfDocument.numPages;
    const pagesContainer = document.createElement('div');
    pagesContainer.className = `${this.options.classPrefix}pdf-pages`;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const pageContainer = document.createElement('div');
      pageContainer.className = `${this.options.classPrefix}pdf-page`;
      pageContainer.dataset.pageNumber = String(pageNum);

      const canvas = await this.renderPage(pageNum);
      if (canvas) {
        pageContainer.appendChild(canvas);
        this.renderedPages.set(pageNum, canvas);
      }

      pagesContainer.appendChild(pageContainer);

      // Report progress
      this.reportProgress(30 + (pageNum / numPages) * 70);
    }

    this.container.appendChild(pagesContainer);
  }

  /**
   * Render single page
   */
  private async renderPage(pageNumber: number): Promise<HTMLCanvasElement | null> {
    if (!this.pdfDocument) return null;

    try {
      const page = await this.pdfDocument.getPage(pageNumber);
      const viewport = page.getViewport({ scale: this.scale });

      // Create canvas
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) return null;

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.className = `${this.options.classPrefix}pdf-canvas`;

      // Render page to canvas
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;

      // Optionally render text layer
      if (this.enableTextLayer) {
        await this.renderTextLayer(page, canvas, viewport);
      }

      return canvas;
    } catch (error) {
      console.error(`Error rendering page ${pageNumber}:`, error);
      return null;
    }
  }

  /**
   * Render text layer for selection/search
   */
  private async renderTextLayer(
    page: pdfjsLib.PDFPageProxy,
    canvas: HTMLCanvasElement,
    viewport: pdfjsLib.PageViewport
  ): Promise<void> {
    try {
      const textContent = await page.getTextContent();
      
      const textLayerDiv = document.createElement('div');
      textLayerDiv.className = `${this.options.classPrefix}pdf-text-layer`;
      textLayerDiv.style.position = 'absolute';
      textLayerDiv.style.left = '0';
      textLayerDiv.style.top = '0';
      textLayerDiv.style.width = `${viewport.width}px`;
      textLayerDiv.style.height = `${viewport.height}px`;

      // Note: Full text layer rendering would require pdfjsLib.renderTextLayer
      // For now, we'll just store the text content for search
      const textItems = textContent.items as Array<{ str: string }>;
      const pageText = textItems.map(item => item.str).join(' ');
      textLayerDiv.dataset.pageText = pageText;

      canvas.parentElement?.appendChild(textLayerDiv);
    } catch (error) {
      console.error('Error rendering text layer:', error);
    }
  }

  /**
   * Get document metadata
   */
  getMetadata(): DocumentMetadata {
    if (!this.pdfDocument) {
      return {};
    }

    return {
      pageCount: this.pdfDocument.numPages,
      // Note: Full metadata requires pdfDocument.getMetadata()
    };
  }

  /**
   * Search in document
   */
  async search(query: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    
    if (!this.pdfDocument || !query) return results;

    const normalizedQuery = query.toLowerCase();

    for (let pageNum = 1; pageNum <= this.pdfDocument.numPages; pageNum++) {
      try {
        const page = await this.pdfDocument.getPage(pageNum);
        const textContent = await page.getTextContent();
        const textItems = textContent.items as Array<{ str: string }>;
        const pageText = textItems.map(item => item.str).join(' ');

        if (pageText.toLowerCase().includes(normalizedQuery)) {
          const index = pageText.toLowerCase().indexOf(normalizedQuery);
          const contextStart = Math.max(0, index - 50);
          const contextEnd = Math.min(pageText.length, index + query.length + 50);
          
          results.push({
            text: query,
            pageNumber: pageNum,
            position: { x: 0, y: 0 }, // Would need more complex calculation
            context: pageText.substring(contextStart, contextEnd),
          });
        }
      } catch (error) {
        console.error(`Error searching page ${pageNum}:`, error);
      }
    }

    return results;
  }

  /**
   * Cleanup resources
   */
  protected cleanup(): void {
    this.renderedPages.clear();
    
    if (this.pdfDocument) {
      this.pdfDocument.destroy();
      this.pdfDocument = null;
    }
  }

  /**
   * Go to specific page
   */
  goToPage(pageNumber: number): void {
    const pageElement = this.container.querySelector(
      `[data-page-number="${pageNumber}"]`
    );
    
    if (pageElement) {
      pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /**
   * Get current page number (based on scroll position)
   */
  getCurrentPage(): number {
    const pages = this.container.querySelectorAll(`[data-page-number]`);
    const containerRect = this.container.getBoundingClientRect();
    
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      if (!page) continue;
      const pageRect = page.getBoundingClientRect();
      
      if (pageRect.top <= containerRect.top + 100 && pageRect.bottom >= containerRect.top + 100) {
        return parseInt(page.getAttribute('data-page-number') || '1', 10);
      }
    }
    
    return 1;
  }
}
