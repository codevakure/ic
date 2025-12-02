import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { Download, Maximize2, X, Loader2 } from 'lucide-react';
import { renderDocx, Excel, renderPptx, PDF } from '@librechat/doc-viewer';
import '@librechat/doc-viewer/styles';
import { cn } from '~/utils';

export type PreviewableFileType = 'pdf' | 'docx' | 'xlsx' | 'pptx';

interface DocPreviewPanelProps {
  /** File type to preview */
  fileType: PreviewableFileType;
  /** File content as ArrayBuffer */
  buffer: ArrayBuffer;
  /** Original filename */
  filename: string;
  /** Callback to close the panel */
  onClose?: () => void;
  /** Callback to set header actions (called on mount) */
  onSetHeaderActions?: (actions: React.ReactNode) => void;
  /** Initial page to scroll to (1-indexed) */
  initialPage?: number;
  /** Text content to highlight on the initial page (for PDF only) */
  highlightText?: string;
}

/**
 * Check if a file extension is previewable
 */
export function isPreviewableFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ['pdf', 'docx', 'xlsx', 'pptx'].includes(ext ?? '');
}

/**
 * Get the file type from filename
 */
export function getFileType(filename: string): PreviewableFileType | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (['pdf', 'docx', 'xlsx', 'pptx'].includes(ext ?? '')) {
    return ext as PreviewableFileType;
  }
  return null;
}

/**
 * Document preview content component
 * Renders documents using @librechat/doc-viewer
 */
const DocPreviewContent = function DocPreviewContent({
  fileType,
  buffer,
  initialPage,
  highlightText,
}: {
  fileType: PreviewableFileType;
  buffer: ArrayBuffer;
  initialPage?: number;
  highlightText?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let viewer: any = null;

    const renderDocument = async () => {
      if (!containerRef.current || !buffer || buffer.byteLength === 0) {
        setError('Invalid file data');
        setIsLoading(false);
        return;
      }

      const container = containerRef.current;
      container.innerHTML = '';
      setIsLoading(true);
      setError(null);

      try {
        if (fileType === 'docx') {
          await renderDocx(buffer, container, undefined, {
            className: 'docx-preview-wrapper',
            inWrapper: true,
            ignoreWidth: true,
            ignoreHeight: true,
            ignoreFonts: false,
            breakPages: true,
            ignoreLastRenderedPageBreak: true,
            experimental: true,
            trimXmlDeclaration: true,
            useBase64URL: true,
            renderHeaders: true,
            renderFooters: true,
            renderFootnotes: true,
            renderEndnotes: true,
          });

          // Apply light mode styles and fit to container
          if (!cancelled && container) {
            const wrapper = container.querySelector('.docx-wrapper') as HTMLElement;
            if (wrapper) {
              wrapper.style.backgroundColor = '#ffffff';
              wrapper.style.color = '#000000';
              wrapper.style.maxWidth = '100%';
              wrapper.style.height = 'auto';
            }
          }
        } else if (fileType === 'xlsx') {
          // Set up container for Excel viewer
          container.style.width = '100%';
          container.style.height = '100%';
          container.style.position = 'relative';
          container.style.overflow = 'hidden';
          container.style.backgroundColor = '#ffffff';

          // Get actual container height for Excel
          const containerHeight = container.clientHeight || container.parentElement?.clientHeight || 600;

          viewer = new Excel(buffer, 'file.xlsx', {
            height: containerHeight,
            showFormulaBar: false,
            showSheetTabBar: true,
            embed: true,
            locale: 'en_US',
            backgroundColor: '#ffffff',
            cellBackgroundColor: '#ffffff',
            editable: false,
          });

          await viewer.loadExcel();

          if (!cancelled) {
            await viewer.render(container);
            
            // Ensure proper sizing after render
            const excelRoot = container.querySelector('.ov-excel-root') as HTMLElement;
            if (excelRoot) {
              excelRoot.style.width = '100%';
              excelRoot.style.height = '100%';
            }
          }
        } else if (fileType === 'pptx') {
          container.style.width = '100%';
          container.style.height = '100%';
          container.style.display = 'flex';
          container.style.justifyContent = 'center';
          container.style.alignItems = 'center';
          container.style.backgroundColor = '#f5f5f5';
          container.style.overflow = 'auto';

          // Calculate dimensions to fit container while maintaining aspect ratio
          const containerWidth = container.clientWidth || 800;
          const containerHeight = container.clientHeight || 600;
          
          // Standard PowerPoint aspect ratio is 16:9
          const aspectRatio = 16 / 9;
          let slideWidth = containerWidth * 0.9; // 90% of container width
          let slideHeight = slideWidth / aspectRatio;
          
          // If height exceeds container, scale by height instead
          if (slideHeight > containerHeight * 0.9) {
            slideHeight = containerHeight * 0.9;
            slideWidth = slideHeight * aspectRatio;
          }

          const pptxPreviewer = renderPptx(container, {
            width: Math.floor(slideWidth),
            height: Math.floor(slideHeight),
          });

          if (!cancelled) {
            await pptxPreviewer.preview(buffer);
          }
        } else if (fileType === 'pdf') {
          // Set up PDF.js worker
          try {
            const pdfjsLib = (window as any).pdfjsLib || {};
            const version = pdfjsLib.version || '4.10.377';
            if (pdfjsLib.GlobalWorkerOptions) {
              pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.mjs`;
            }
          } catch (e) {
            // Ignore if pdfjsLib is not available
          }

          // Clone the buffer to prevent it from being consumed/transferred
          const pdfBuffer = buffer.slice(0);

          viewer = new PDF(container, {});
          viewerRef.current = viewer;
          await viewer.renderFile(pdfBuffer);

          // Navigate to initial page and highlight text after rendering
          if (!cancelled && initialPage && initialPage > 0 && viewer.goToPage) {
            console.log(`[DocPreviewPanel] Navigating to page ${initialPage}, highlightText length: ${highlightText?.length || 0}`);
            if (highlightText) {
              console.log(`[DocPreviewPanel] Highlight text preview: "${highlightText.substring(0, 150)}..."`);
            }
            // Small delay to ensure DOM is ready
            setTimeout(async () => {
              if (!cancelled && viewerRef.current?.goToPage) {
                viewerRef.current.goToPage(initialPage);
                
                // Highlight the chunk text if provided
                if (highlightText && viewerRef.current?.highlightText) {
                  // Give a bit more time for the page to render before highlighting
                  setTimeout(async () => {
                    if (!cancelled && viewerRef.current?.highlightText) {
                      console.log(`[DocPreviewPanel] Calling highlightText(${initialPage}, "${highlightText.substring(0, 50)}...")`);
                      await viewerRef.current.highlightText(initialPage, highlightText);
                    }
                  }, 300);
                }
              }
            }, 100);
          }
        }

        if (!cancelled) {
          setIsLoading(false);
        }
      } catch (err) {
        console.error('[DocPreview] Render error:', err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to render document');
          setIsLoading(false);
        }
      }
    };

    renderDocument();

    return () => {
      cancelled = true;
      if (viewer && typeof viewer.destroy === 'function') {
        try {
          viewer.destroy();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      // Additional cleanup for container
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      viewerRef.current = null;
    };
  }, [fileType, buffer, initialPage, highlightText]);

  return (
    <div className="relative h-full w-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-primary">
          <Loader2 className="h-8 w-8 animate-spin text-text-secondary" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-primary">
          <div className="text-center text-red-500">
            <p className="text-sm font-medium">Failed to load document</p>
            <p className="mt-1 text-xs">{error}</p>
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        className={cn(
          'doc-viewer h-full w-full overflow-auto',
          isLoading && 'invisible',
        )}
        style={{ minHeight: '400px' }}
      />
    </div>
  );
};

/**
 * Fullscreen modal for document preview - styled like Artifacts fullscreen
 * Uses overlay buttons (close top-right, download bottom-right) instead of header
 */
const FullscreenModal = memo(function FullscreenModal({
  isOpen,
  onClose,
  fileType,
  buffer,
  filename,
  onDownload,
  initialPage,
  highlightText,
}: {
  isOpen: boolean;
  onClose: () => void;
  fileType: PreviewableFileType;
  buffer: ArrayBuffer;
  filename: string;
  onDownload: () => void;
  initialPage?: number;
  highlightText?: string;
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Small delay to trigger CSS transition
      const timer = setTimeout(() => setIsVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Fullscreen content */}
      <div
        className={cn(
          'fixed inset-0 z-[9999] flex h-screen w-screen items-center justify-center bg-surface-primary-alt transition-opacity duration-300',
          isVisible ? 'opacity-100' : 'opacity-0',
        )}
        role="dialog"
        aria-modal="true"
        aria-label={`Full screen preview of ${filename}`}
      >
        <DocPreviewContent fileType={fileType} buffer={buffer} initialPage={initialPage} highlightText={highlightText} />
      </div>

      {/* Overlay Close button - top right */}
      <button
        className="fixed right-4 top-4 z-[10000] rounded-full bg-surface-tertiary/80 p-2.5 text-text-secondary backdrop-blur-sm transition-colors hover:bg-surface-tertiary hover:text-text-primary"
        onClick={onClose}
        aria-label="Exit fullscreen"
      >
        <X size={20} />
      </button>

      {/* Overlay Download button - bottom right with solid background */}
      <button
        className="fixed bottom-4 right-4 z-[10000] rounded-full bg-surface-tertiary p-2.5 text-text-secondary shadow-lg transition-colors hover:bg-surface-hover hover:text-text-primary"
        onClick={onDownload}
        aria-label="Download file"
      >
        <Download size={20} />
      </button>
    </>,
    document.body,
  );
});

/**
 * Document Preview Panel
 * 
 * This component is designed to be used with the useSourcesPanel hook
 * to display document previews in the side panel.
 * 
 * Features:
 * - Supports PDF, DOCX, XLSX, PPTX
 * - Fullscreen mode
 * - Download button
 * 
 * @example
 * ```tsx
 * import { useSourcesPanel } from '~/components/ui/SidePanel';
 * import { DocPreviewPanel, createDocPreviewHeaderActions, isPreviewableFile, getFileType } from './DocPreviewPanel';
 * 
 * const { openPanel } = useSourcesPanel();
 * 
 * // When user clicks a file - see Attachment.tsx for full example
 * ```
 */

/**
 * Creates header actions for document preview
 * This is a helper to create the header actions with the fullscreen trigger
 */
export function createDocPreviewHeaderActions(
  buffer: ArrayBuffer,
  filename: string,
  onFullscreen: () => void,
): React.ReactNode {
  const handleDownload = () => {
    try {
      const blob = new Blob([buffer]);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  return (
    <>
      <button
        onClick={handleDownload}
        className="rounded-full p-1 text-text-secondary transition-colors hover:bg-surface-tertiary hover:text-text-primary"
        aria-label="Download file"
        title="Download"
      >
        <Download className="h-4 w-4" />
      </button>
      <button
        onClick={onFullscreen}
        className="rounded-full p-1 text-text-secondary transition-colors hover:bg-surface-tertiary hover:text-text-primary"
        aria-label="Open in full screen"
        title="Full screen"
      >
        <Maximize2 className="h-4 w-4" />
      </button>
    </>
  );
}

export const DocPreviewPanel = memo(function DocPreviewPanel({
  fileType,
  buffer,
  filename,
  onClose,
  onSetHeaderActions,
  initialPage,
  highlightText,
}: DocPreviewPanelProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleDownload = useCallback(() => {
    try {
      const blob = new Blob([buffer]);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  }, [buffer, filename]);

  const openFullscreen = useCallback(() => {
    setIsFullscreen(true);
  }, []);

  const closeFullscreen = useCallback(() => {
    setIsFullscreen(false);
  }, []);

  // Set header actions on mount
  useEffect(() => {
    if (onSetHeaderActions) {
      onSetHeaderActions(createDocPreviewHeaderActions(buffer, filename, openFullscreen));
    }
  }, [buffer, filename, openFullscreen, onSetHeaderActions]);

  return (
    <div className="flex h-full flex-col">
      {/* Preview Content */}
      <div className="flex-1 overflow-hidden">
        <DocPreviewContent key={`${fileType}-${buffer.byteLength}`} fileType={fileType} buffer={buffer} initialPage={initialPage} highlightText={highlightText} />
      </div>

      {/* Fullscreen Modal */}
      <FullscreenModal
        isOpen={isFullscreen}
        onClose={closeFullscreen}
        fileType={fileType}
        buffer={buffer}
        filename={filename}
        onDownload={handleDownload}
        initialPage={initialPage}
        highlightText={highlightText}
      />
    </div>
  );
});

export default DocPreviewPanel;
