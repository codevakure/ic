import { DocumentViewer } from '../core/DocumentViewer';
import type { DocumentMetadata, SearchResult, ViewerOptions } from '../core/types';

/**
 * PowerPoint-specific options
 */
export interface PPTXOptions extends Partial<ViewerOptions> {
  /**
   * Active slide index
   */
  activeSlide?: number;

  /**
   * Show slide notes
   */
  showNotes?: boolean;

  /**
   * Render mode: 'enhanced' for better text formatting (default), 'simple' for basic text
   */
  renderMode?: 'enhanced' | 'simple';

  /**
   * Slide width (default: 960px)
   */
  slideWidth?: number;

  /**
   * Slide height (default: 540px)
   */
  slideHeight?: number;
}

/**
 * PowerPoint Document Viewer
 * Enhanced OOXML parsing with better text formatting and layout
 */
export class PPTXViewer extends DocumentViewer {
  private zipParser: any = null;
  private packageParser: any = null;
  private slideElements: HTMLElement[] = [];
  private slideCount: number = 0;
  private slides: Document[] = [];

  constructor(container: HTMLElement, options: PPTXOptions = {}) {
    super(container, {
      ...options,
      renderMode: options.renderMode || 'enhanced',
      slideWidth: options.slideWidth || 960,
      slideHeight: options.slideHeight || 540,
    });
  }

  /**
   * Render PowerPoint document from ArrayBuffer
   */
  async renderFile(data: ArrayBuffer): Promise<void> {
    try {
      this.reportProgress(10);

      // Clear container
      this.container.innerHTML = '';

      // Create slides container
      const slidesContainer = document.createElement('div');
      slidesContainer.className = `${this.options.classPrefix}pptx-slides`;
      slidesContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 20px;
        gap: 20px;
        width: 100%;
        background: #f5f5f5;
      `;

      this.reportProgress(30);

      // Parse PPTX structure
      await this.parsePPTX(data);

      this.reportProgress(60);

      // Render slides
      await this.renderSlides(slidesContainer);

      this.container.appendChild(slidesContainer);

      this.reportProgress(100);
      this.emitLoad();
    } catch (error) {
      console.error('PPTX render error:', error);
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Parse PPTX structure
   */
  private async parsePPTX(data: ArrayBuffer): Promise<void> {
    const { ZipParser } = await import('../parsers/zip/ZipParser');
    const { PackageParser } = await import('../parsers/ooxml/PackageParser');

    this.zipParser = new ZipParser();
    await this.zipParser.parse(data);

    this.reportProgress(40);

    this.packageParser = new PackageParser(this.zipParser);
    await this.packageParser.parse();

    this.reportProgress(50);

    // Parse slides
    const slideFiles = this.zipParser.getFilesByPattern(/ppt\/slides\/slide\d+\.xml$/);
    this.slideCount = slideFiles.length;

    for (const file of slideFiles) {
      const slideXml = this.zipParser.getFileAsXml(file.name);
      if (slideXml) {
        this.slides.push(slideXml);
      }
    }
  }

  /**
   * Render all slides
   */
  private async renderSlides(container: HTMLElement): Promise<void> {
    for (let i = 0; i < this.slides.length; i++) {
      const slideXml = this.slides[i];
      if (!slideXml) continue;

      const slideElement = this.options.renderMode === 'enhanced' 
        ? this.renderSlideEnhanced(slideXml, i + 1)
        : this.renderSlideSimple(slideXml, i + 1);
      
      this.slideElements.push(slideElement);
      container.appendChild(slideElement);
    }
  }

  /**
   * Render slide with enhanced formatting
   */
  private renderSlideEnhanced(slideXml: Document, slideNumber: number): HTMLElement {
    const slide = document.createElement('div');
    slide.className = `${this.options.classPrefix}pptx-slide`;
    slide.dataset.slideNumber = String(slideNumber);
    slide.style.cssText = `
      width: ${this.options.slideWidth}px;
      height: ${this.options.slideHeight}px;
      background: white;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      padding: 40px;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      overflow: auto;
      position: relative;
    `;

    // Extract structured text with formatting hints
    const textBlocks = this.extractTextBlocks(slideXml);
    
    for (const block of textBlocks) {
      const blockEl = document.createElement('div');
      blockEl.style.cssText = `
        margin-bottom: 20px;
        ${block.isTitle ? 'font-size: 32px; font-weight: bold; margin-bottom: 30px;' : 'font-size: 18px;'}
        line-height: 1.6;
        color: #222;
      `;
      blockEl.textContent = block.text;
      slide.appendChild(blockEl);
    }

    // Add slide number indicator
    const slideNumEl = document.createElement('div');
    slideNumEl.style.cssText = `
      position: absolute;
      bottom: 10px;
      right: 10px;
      font-size: 12px;
      color: #999;
    `;
    slideNumEl.textContent = `${slideNumber} / ${this.slideCount}`;
    slide.appendChild(slideNumEl);

    return slide;
  }

  /**
   * Extract text blocks with formatting hints from slide XML
   */
  private extractTextBlocks(slideXml: Document): Array<{text: string, isTitle: boolean}> {
    const blocks: Array<{text: string, isTitle: boolean}> = [];
    
    // Try to identify title shape (usually first shape or type='title')
    const shapes = slideXml.querySelectorAll('p\\:sp');
    let isFirstShape = true;
    
    for (let i = 0; i < shapes.length; i++) {
      const shape = shapes[i];
      if (!shape) continue;
      
      const textElements = shape.querySelectorAll('a\\:t, t');
      if (textElements.length === 0) continue;
      
      const textParts: string[] = [];
      for (let j = 0; j < textElements.length; j++) {
        const textEl = textElements[j];
        const text = textEl?.textContent;
        if (text) textParts.push(text);
      }
      
      if (textParts.length > 0) {
        blocks.push({
          text: textParts.join(' '),
          isTitle: isFirstShape
        });
        isFirstShape = false;
      }
    }
    
    return blocks;
  }

  /**
   * Render single slide (simple mode - basic text extraction)
   */
  private renderSlideSimple(slideXml: Document, slideNumber: number): HTMLElement {
    const slide = document.createElement('div');
    slide.className = `${this.options.classPrefix}pptx-slide`;
    slide.dataset.slideNumber = String(slideNumber);
    slide.style.cssText = `
      width: ${this.options.slideWidth}px;
      height: ${this.options.slideHeight}px;
      background: white;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      padding: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      white-space: pre-wrap;
      font-size: 18px;
      line-height: 1.6;
      overflow: auto;
    `;

    // Extract text content
    const textElements = slideXml.querySelectorAll('a\\:t, t');
    const textContent: string[] = [];

    for (let i = 0; i < textElements.length; i++) {
      const textEl = textElements[i];
      if (!textEl) continue;
      const text = textEl.textContent;
      if (text) textContent.push(text);
    }

    slide.textContent = textContent.join('\n');

    return slide;
  }

  /**
   * Get document metadata
   */
  getMetadata(): DocumentMetadata {
    return {
      pageCount: this.slideCount,
    };
  }

  /**
   * Search in document
   */
  async search(query: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    
    if (!query) return results;

    const normalizedQuery = query.toLowerCase();

    for (let i = 0; i < this.slideElements.length; i++) {
      const slideEl = this.slideElements[i];
      if (!slideEl) continue;
      const text = slideEl.textContent || '';
      
      if (text.toLowerCase().includes(normalizedQuery)) {
        results.push({
          text: query,
          pageNumber: i + 1,
          position: { x: 0, y: 0 },
          context: text.substring(0, 200),
        });
      }
    }

    return results;
  }

  /**
   * Go to slide
   */
  goToSlide(slideNumber: number): void {
    const slideElement = this.container.querySelector(
      `[data-slide-number="${slideNumber}"]`
    );
    
    if (slideElement) {
      slideElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /**
   * Cleanup resources
   */
  protected cleanup(): void {
    if (this.zipParser && typeof this.zipParser.clear === 'function') {
      this.zipParser.clear();
    }
    this.zipParser = null;
    this.packageParser = null;
    this.slideElements = [];
    this.slides = [];
    this.slideCount = 0;
  }
}
