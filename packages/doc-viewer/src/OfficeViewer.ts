/**
 * Unified interface for Office document viewers
 * Defines common methods for rendering, updating options, and downloading documents
 */

export interface OfficeViewer {
  render(root: HTMLElement, options: any): Promise<void>;

  updateOptions(options: any): void;

  download(fileName: string): Promise<void>;

  print(): void;

  updateVariable(): void;

  destroy(): void;
}
