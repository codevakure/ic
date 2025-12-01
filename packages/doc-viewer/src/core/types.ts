/**
 * Document types supported by the viewer
 */
export enum DocumentType {
  WORD = 'word',
  EXCEL = 'excel',
  POWERPOINT = 'powerpoint',
  PDF = 'pdf',
  UNKNOWN = 'unknown',
}

/**
 * Base render options for all viewers
 */
export interface RenderOptions {
  /**
   * CSS class prefix for generated elements
   */
  classPrefix?: string;

  /**
   * Enable text selection
   */
  enableSelection?: boolean;

  /**
   * Enable copy functionality
   */
  enableCopy?: boolean;

  /**
   * Show toolbar
   */
  showToolbar?: boolean;

  /**
   * Debug mode
   */
  debug?: boolean;
}

/**
 * Viewer options
 */
export interface ViewerOptions extends RenderOptions {
  /**
   * Container element
   */
  container: HTMLElement;

  /**
   * Document type
   */
  type?: DocumentType;

  /**
   * Custom error handler
   */
  onError?: (error: Error) => void;

  /**
   * Load callback
   */
  onLoad?: () => void;

  /**
   * Progress callback
   */
  onProgress?: (progress: number) => void;

  /**
   * Render mode - varies by viewer type
   */
  renderMode?: string;

  /**
   * Slide width for PPTX
   */
  slideWidth?: number;

  /**
   * Slide height for PPTX
   */
  slideHeight?: number;
}

/**
 * Document metadata
 */
export interface DocumentMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  created?: Date;
  modified?: Date;
  pageCount?: number;
  fileSize?: number;
}

/**
 * Search result
 */
export interface SearchResult {
  text: string;
  pageNumber: number;
  position: { x: number; y: number };
  context: string;
}

/**
 * Base viewer interface
 */
export interface IViewer {
  /**
   * Render document from ArrayBuffer
   */
  renderFile(data: ArrayBuffer): Promise<void>;

  /**
   * Render document from URL
   */
  renderURL(url: string): Promise<void>;

  /**
   * Destroy viewer and cleanup resources
   */
  destroy(): void;

  /**
   * Get document metadata
   */
  getMetadata(): DocumentMetadata;

  /**
   * Search in document
   */
  search(query: string): Promise<SearchResult[]>;
}
