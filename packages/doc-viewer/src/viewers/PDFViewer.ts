import { DocumentViewer } from '../core/DocumentViewer';
import type { DocumentMetadata, SearchResult, ViewerOptions } from '../core/types';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
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
   * Highlight text on a specific page
   * @param pageNumber - Page number to highlight on (1-indexed)
   * @param textToHighlight - Text string to highlight
   * @returns boolean - Whether highlighting was successful
   */
  async highlightText(pageNumber: number, textToHighlight: string): Promise<boolean> {
    if (!this.pdfDocument || !textToHighlight) return false;

    console.log(`[PDFViewer] highlightText called: page=${pageNumber}, textLength=${textToHighlight.length}`);

    try {
      // First, go to the page
      this.goToPage(pageNumber);

      const page = await this.pdfDocument.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const viewport = page.getViewport({ scale: this.scale });
      
      const pageElement = this.container.querySelector(
        `[data-page-number="${pageNumber}"]`
      );
      if (!pageElement) {
        console.log(`[PDFViewer] Page element not found for page ${pageNumber}`);
        return false;
      }

      // Remove any existing highlights on this page
      const existingHighlights = pageElement.querySelectorAll(`.${this.options.classPrefix}pdf-highlight`);
      existingHighlights.forEach(el => el.remove());

      // Get actual canvas element and its displayed size
      const canvas = pageElement.querySelector('canvas');
      const canvasRect = canvas?.getBoundingClientRect();
      const displayedWidth = canvasRect?.width || viewport.width;
      const displayedHeight = canvasRect?.height || viewport.height;
      
      // Calculate scale factor between viewport and displayed size
      const scaleX = displayedWidth / viewport.width;
      const scaleY = displayedHeight / viewport.height;
      
      console.log(`[PDFViewer] Viewport: ${viewport.width}x${viewport.height}, Displayed: ${displayedWidth}x${displayedHeight}, Scale: ${scaleX.toFixed(2)}x${scaleY.toFixed(2)}`);

      // Create highlight overlay container that matches the displayed canvas size
      let highlightContainer = pageElement.querySelector(`.${this.options.classPrefix}pdf-highlight-layer`) as HTMLElement;
      if (!highlightContainer) {
        highlightContainer = document.createElement('div');
        highlightContainer.className = `${this.options.classPrefix}pdf-highlight-layer`;
        highlightContainer.style.cssText = `
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 10;
        `;
        // Ensure page element is positioned
        const pageStyle = window.getComputedStyle(pageElement);
        if (pageStyle.position === 'static') {
          (pageElement as HTMLElement).style.position = 'relative';
        }
        pageElement.appendChild(highlightContainer);
      } else {
        // Update existing container size
        highlightContainer.style.width = '100%';
        highlightContainer.style.height = '100%';
      }

      // Normalize search text - extract key phrases for matching
      const normalizedSearchText = textToHighlight.toLowerCase().replace(/\s+/g, ' ').trim();
      // Get first 100 chars for matching (RAG chunks can be long)
      const searchPrefix = normalizedSearchText.substring(0, 100);
      
      console.log(`[PDFViewer] Search prefix: "${searchPrefix.substring(0, 50)}..."`);

      // Build page text with position info
      const textItems = textContent.items as Array<{
        str: string;
        transform: number[];
        width: number;
        height: number;
      }>;
      
      console.log(`[PDFViewer] Page has ${textItems.length} text items`);

      // Helper to create highlight element with percentage-based positioning
      const createHighlight = (item: typeof textItems[0]) => {
        if (!item.str || !item.transform) return;
        
        const [x1, y1] = viewport.convertToViewportPoint(
          item.transform[4],
          item.transform[5]
        );
        
        const itemWidth = (item.width || 50) * this.scale;
        const itemHeight = Math.abs(item.transform[3]) * this.scale || 14;
        
        // Convert to percentages for responsive scaling
        const leftPercent = (x1 / viewport.width) * 100;
        const topPercent = ((y1 - itemHeight) / viewport.height) * 100;
        const widthPercent = (itemWidth / viewport.width) * 100;
        const heightPercent = (itemHeight / viewport.height) * 100;
        
        const highlight = document.createElement('div');
        highlight.className = `${this.options.classPrefix}pdf-highlight`;
        highlight.style.cssText = `
          position: absolute;
          left: ${leftPercent}%;
          top: ${topPercent}%;
          width: ${widthPercent}%;
          height: ${heightPercent}%;
          background-color: rgba(255, 235, 59, 0.5);
          mix-blend-mode: multiply;
          border-radius: 2px;
          pointer-events: none;
        `;
        
        highlightContainer.appendChild(highlight);
      };

      // Build a map of character positions to text item indices
      // This allows us to find exactly which text items correspond to the matched text
      const charToItemMap: Array<{ itemIndex: number; charInItem: number }> = [];
      let fullText = '';
      
      for (let i = 0; i < textItems.length; i++) {
        const item = textItems[i];
        if (!item.str) continue;
        
        // Add space between items
        if (fullText.length > 0) {
          charToItemMap.push({ itemIndex: -1, charInItem: 0 }); // space
          fullText += ' ';
        }
        
        // Map each character to its source item
        for (let c = 0; c < item.str.length; c++) {
          charToItemMap.push({ itemIndex: i, charInItem: c });
        }
        fullText += item.str;
      }
      
      const normalizedFullText = fullText.toLowerCase().replace(/\s+/g, ' ');
      console.log(`[PDFViewer] Full page text length: ${normalizedFullText.length}`);
      console.log(`[PDFViewer] First 200 chars of page: "${normalizedFullText.substring(0, 200)}"`);

      // Find where the search text starts in the page
      const matchPosition = normalizedFullText.indexOf(searchPrefix.substring(0, 50).toLowerCase().replace(/\s+/g, ' '));
      console.log(`[PDFViewer] Match position in page text: ${matchPosition}`);
      
      let foundMatch = false;
      
      if (matchPosition !== -1) {
        // Find which text items correspond to the matched region
        // We need to map from normalized position back to original position
        let normalizedPos = 0;
        let originalPos = 0;
        
        // Find original position corresponding to normalized match position
        while (normalizedPos < matchPosition && originalPos < fullText.length) {
          if (fullText[originalPos] === ' ' && (originalPos === 0 || fullText[originalPos - 1] === ' ')) {
            // Skip extra spaces in original that were collapsed
            originalPos++;
          } else {
            normalizedPos++;
            originalPos++;
          }
        }
        
        console.log(`[PDFViewer] Original position: ${originalPos}, charToItemMap length: ${charToItemMap.length}`);
        
        // Get the text items that should be highlighted (covering ~chunk size)
        const highlightedItemIndices = new Set<number>();
        const charsToHighlight = Math.min(searchPrefix.length * 2, 300); // Highlight more than just the prefix
        
        for (let i = originalPos; i < Math.min(originalPos + charsToHighlight, charToItemMap.length); i++) {
          const mapping = charToItemMap[i];
          if (mapping && mapping.itemIndex >= 0) {
            highlightedItemIndices.add(mapping.itemIndex);
          }
        }
        
        console.log(`[PDFViewer] Highlighting ${highlightedItemIndices.size} text items`);
        
        // Highlight those items
        for (const itemIndex of highlightedItemIndices) {
          createHighlight(textItems[itemIndex]);
        }
        
        foundMatch = highlightedItemIndices.size > 0;
      }

      if (!foundMatch) {
        console.log(`[PDFViewer] No match found - text may not be on this page`);
      }

      return foundMatch;
    } catch (error) {
      console.error('[PDFViewer] Error highlighting text:', error);
      return false;
    }
  }

  /**
   * Clear all highlights
   */
  clearHighlights(): void {
    const highlights = this.container.querySelectorAll(`.${this.options.classPrefix}pdf-highlight`);
    highlights.forEach(el => el.remove());
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
