/**
 * PDF Viewer Implementation
 * Renders PDF documents using PDF.js with canvas-based rendering
 */

import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import type { RenderTask } from 'pdfjs-dist/types/src/display/api';

// Set worker source for PDF.js
if (typeof window !== 'undefined') {
  const pdfjsVersion = pdfjsLib.version;
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsVersion}/pdf.worker.min.js`;
}

export interface PDFOptions {
  /**
   * Initial page to display (1-indexed)
   */
  initialPage?: number;

  /**
   * Scale factor for rendering (1.0 = 100%)
   */
  scale?: number;

  /**
   * Maximum width for the PDF canvas
   */
  maxWidth?: number;

  /**
   * Enable text layer for text selection
   */
  enableTextLayer?: boolean;

  /**
   * Enable annotations layer
   */
  enableAnnotations?: boolean;

  /**
   * Callback when page changes
   */
  onPageChange?: (pageNum: number, totalPages: number) => void;

  /**
   * Callback when document loads
   */
  onLoad?: (totalPages: number) => void;

  /**
   * Callback for errors
   */
  onError?: (error: Error) => void;
}

export class PDF {
  private pdf: PDFDocumentProxy | null = null;
  private currentPage: number = 1;
  private scale: number = 1.5;
  private container: HTMLElement | null = null;
  private options: PDFOptions;
  private renderTask: RenderTask | null = null;

  constructor(private data: ArrayBuffer, options: PDFOptions = {}) {
    this.options = {
      initialPage: 1,
      scale: 1.5,
      enableTextLayer: true,
      enableAnnotations: false,
      ...options
    };
    this.currentPage = this.options.initialPage || 1;
    this.scale = this.options.scale || 1.5;
  }

  /**
   * Initialize and render the PDF document
   */
  async render(container: HTMLElement): Promise<void> {
    this.container = container;
    
    try {
      // Load the PDF document
      const loadingTask = pdfjsLib.getDocument({ data: this.data });
      this.pdf = await loadingTask.promise;

      // Notify load completion
      if (this.options.onLoad) {
        this.options.onLoad(this.pdf.numPages);
      }

      // Create UI structure
      this.createUI();

      // Render the initial page
      await this.renderPage(this.currentPage);
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * Create the UI structure for PDF viewer
   */
  private createUI(): void {
    if (!this.container || !this.pdf) return;

    // Clear container
    this.container.innerHTML = '';
    this.container.className = 'pdf-viewer-container';

    // Create toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'pdf-toolbar';
    toolbar.innerHTML = `
      <div class="pdf-toolbar-group">
        <button class="pdf-btn pdf-btn-prev" title="Previous Page">
          <span>←</span>
        </button>
        <div class="pdf-page-info">
          <input type="number" class="pdf-page-input" value="${this.currentPage}" min="1" max="${this.pdf.numPages}" />
          <span class="pdf-page-separator">/</span>
          <span class="pdf-page-total">${this.pdf.numPages}</span>
        </div>
        <button class="pdf-btn pdf-btn-next" title="Next Page">
          <span>→</span>
        </button>
      </div>
      <div class="pdf-toolbar-group">
        <button class="pdf-btn pdf-btn-zoom-out" title="Zoom Out">
          <span>−</span>
        </button>
        <span class="pdf-zoom-level">${Math.round(this.scale * 100)}%</span>
        <button class="pdf-btn pdf-btn-zoom-in" title="Zoom In">
          <span>+</span>
        </button>
        <button class="pdf-btn pdf-btn-fit" title="Fit to Width">
          <span>⊡</span>
        </button>
      </div>
    `;
    this.container.appendChild(toolbar);

    // Create canvas container
    const canvasContainer = document.createElement('div');
    canvasContainer.className = 'pdf-canvas-container';
    this.container.appendChild(canvasContainer);

    // Attach event listeners
    this.attachEventListeners(toolbar);
  }

  /**
   * Attach event listeners to toolbar buttons
   */
  private attachEventListeners(toolbar: HTMLElement): void {
    const prevBtn = toolbar.querySelector('.pdf-btn-prev') as HTMLButtonElement;
    const nextBtn = toolbar.querySelector('.pdf-btn-next') as HTMLButtonElement;
    const pageInput = toolbar.querySelector('.pdf-page-input') as HTMLInputElement;
    const zoomInBtn = toolbar.querySelector('.pdf-btn-zoom-in') as HTMLButtonElement;
    const zoomOutBtn = toolbar.querySelector('.pdf-btn-zoom-out') as HTMLButtonElement;
    const fitBtn = toolbar.querySelector('.pdf-btn-fit') as HTMLButtonElement;

    if (prevBtn) prevBtn.addEventListener('click', () => this.previousPage());
    if (nextBtn) nextBtn.addEventListener('click', () => this.nextPage());
    if (pageInput) {
      pageInput.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        this.goToPage(parseInt(target.value, 10));
      });
    }
    if (zoomInBtn) zoomInBtn.addEventListener('click', () => this.zoomIn());
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => this.zoomOut());
    if (fitBtn) fitBtn.addEventListener('click', () => this.fitToWidth());
  }

  /**
   * Render a specific page
   */
  private async renderPage(pageNum: number): Promise<void> {
    if (!this.pdf || !this.container) return;

    // Cancel any ongoing render task
    if (this.renderTask) {
      this.renderTask.cancel();
    }

    try {
      const page = await this.pdf.getPage(pageNum);
      await this.renderPageOnCanvas(page);
      
      // Update page info
      this.updatePageInfo();

      // Notify page change
      if (this.options.onPageChange) {
        this.options.onPageChange(this.currentPage, this.pdf.numPages);
      }
    } catch (error) {
      if ((error as any).name !== 'RenderingCancelledException') {
        this.handleError(error as Error);
      }
    }
  }

  /**
   * Render page on canvas
   */
  private async renderPageOnCanvas(page: PDFPageProxy): Promise<void> {
    if (!this.container) return;

    const canvasContainer = this.container.querySelector('.pdf-canvas-container') as HTMLElement;
    if (!canvasContainer) return;

    // Clear previous content
    canvasContainer.innerHTML = '';

    // Calculate scale based on container width if maxWidth is specified
    let scale = this.scale;
    const viewport = page.getViewport({ scale: 1 });
    
    if (this.options.maxWidth) {
      const containerWidth = canvasContainer.clientWidth || this.options.maxWidth;
      scale = Math.min(this.scale, containerWidth / viewport.width);
    }

    const scaledViewport = page.getViewport({ scale });

    // Create canvas
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to get canvas context');
    }

    canvas.height = scaledViewport.height;
    canvas.width = scaledViewport.width;
    canvas.className = 'pdf-canvas';

    canvasContainer.appendChild(canvas);

    // Render PDF page
    const renderContext = {
      canvasContext: context,
      viewport: scaledViewport
    };

    this.renderTask = page.render(renderContext);
    await this.renderTask.promise;
    this.renderTask = null;

    // Render text layer if enabled
    if (this.options.enableTextLayer) {
      await this.renderTextLayer(page, scaledViewport, canvasContainer);
    }
  }

  /**
   * Render text layer for text selection
   */
  private async renderTextLayer(
    page: PDFPageProxy, 
    viewport: any, 
    container: HTMLElement
  ): Promise<void> {
    const textContent = await page.getTextContent();
    
    const textLayerDiv = document.createElement('div');
    textLayerDiv.className = 'pdf-text-layer';
    textLayerDiv.style.position = 'absolute';
    textLayerDiv.style.left = '0';
    textLayerDiv.style.top = '0';
    textLayerDiv.style.width = `${viewport.width}px`;
    textLayerDiv.style.height = `${viewport.height}px`;
    
    container.appendChild(textLayerDiv);

    // Note: Full text layer rendering would require pdf.js TextLayerBuilder
    // This is a simplified version - can be enhanced if needed
  }

  /**
   * Update page information in toolbar
   */
  private updatePageInfo(): void {
    if (!this.container) return;

    const pageInput = this.container.querySelector('.pdf-page-input') as HTMLInputElement;
    const zoomLevel = this.container.querySelector('.pdf-zoom-level');
    const prevBtn = this.container.querySelector('.pdf-btn-prev') as HTMLButtonElement;
    const nextBtn = this.container.querySelector('.pdf-btn-next') as HTMLButtonElement;

    if (pageInput) pageInput.value = this.currentPage.toString();
    if (zoomLevel) zoomLevel.textContent = `${Math.round(this.scale * 100)}%`;
    
    if (prevBtn) prevBtn.disabled = this.currentPage <= 1;
    if (nextBtn) nextBtn.disabled = !this.pdf || this.currentPage >= this.pdf.numPages;
  }

  /**
   * Navigate to previous page
   */
  public async previousPage(): Promise<void> {
    if (this.currentPage > 1) {
      this.currentPage--;
      await this.renderPage(this.currentPage);
    }
  }

  /**
   * Navigate to next page
   */
  public async nextPage(): Promise<void> {
    if (this.pdf && this.currentPage < this.pdf.numPages) {
      this.currentPage++;
      await this.renderPage(this.currentPage);
    }
  }

  /**
   * Go to specific page
   */
  public async goToPage(pageNum: number): Promise<void> {
    if (!this.pdf) return;
    
    const validPage = Math.max(1, Math.min(pageNum, this.pdf.numPages));
    if (validPage !== this.currentPage) {
      this.currentPage = validPage;
      await this.renderPage(this.currentPage);
    }
  }

  /**
   * Zoom in
   */
  public async zoomIn(): Promise<void> {
    this.scale = Math.min(this.scale * 1.2, 5.0);
    await this.renderPage(this.currentPage);
  }

  /**
   * Zoom out
   */
  public async zoomOut(): Promise<void> {
    this.scale = Math.max(this.scale / 1.2, 0.5);
    await this.renderPage(this.currentPage);
  }

  /**
   * Fit to width
   */
  public async fitToWidth(): Promise<void> {
    if (!this.pdf || !this.container) return;

    const canvasContainer = this.container.querySelector('.pdf-canvas-container') as HTMLElement;
    if (!canvasContainer) return;

    const page = await this.pdf.getPage(this.currentPage);
    const viewport = page.getViewport({ scale: 1 });
    const containerWidth = canvasContainer.clientWidth;
    
    this.scale = (containerWidth - 20) / viewport.width; // 20px padding
    await this.renderPage(this.currentPage);
  }

  /**
   * Get current page number
   */
  public getCurrentPage(): number {
    return this.currentPage;
  }

  /**
   * Get total number of pages
   */
  public getTotalPages(): number {
    return this.pdf ? this.pdf.numPages : 0;
  }

  /**
   * Get current scale
   */
  public getScale(): number {
    return this.scale;
  }

  /**
   * Handle errors
   */
  private handleError(error: Error): void {
    console.error('PDF Viewer Error:', error);
    
    if (this.options.onError) {
      this.options.onError(error);
    }

    if (this.container) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'pdf-error';
      errorDiv.textContent = `Error loading PDF: ${error.message}`;
      this.container.appendChild(errorDiv);
    }
  }

  /**
   * Destroy the PDF viewer and clean up resources
   */
  public destroy(): void {
    if (this.renderTask) {
      this.renderTask.cancel();
      this.renderTask = null;
    }

    if (this.pdf) {
      this.pdf.destroy();
      this.pdf = null;
    }

    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }
}

export default PDF;
