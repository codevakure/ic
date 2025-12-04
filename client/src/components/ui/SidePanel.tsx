import React, { useRef, useEffect, useState, useCallback, useContext, createContext } from 'react';
import { createPortal } from 'react-dom';
import { useRecoilState, useSetRecoilState } from 'recoil';
import { ArrowLeft, X } from 'lucide-react';
import { useMediaQuery } from '@ranger/client';
import store from '~/store';
import { cn } from '~/utils';

/**
 * Context to detect if we're inside SidePanelGroup.
 * When true, push mode is handled by SourcesPanel inside SidePanelGroup.
 * GlobalSourcesPanel should NOT render push mode panel in this case.
 */
const SidePanelGroupContext = createContext<boolean>(false);

/**
 * Provider to mark that we're inside SidePanelGroup.
 * Used by SidePanelGroup to indicate that SourcesPanel will handle push mode.
 */
export function SidePanelGroupProvider({ children }: { children: React.ReactNode }) {
  return (
    <SidePanelGroupContext.Provider value={true}>
      {children}
    </SidePanelGroupContext.Provider>
  );
}

/**
 * Hook to check if we're inside SidePanelGroup.
 * Returns true if SourcesPanel will handle push mode, false otherwise.
 */
export function useIsInsideSidePanelGroup() {
  return useContext(SidePanelGroupContext);
}

export interface SidePanelProps {
  /** Whether the panel is open */
  isOpen: boolean;
  /** Callback when panel should close */
  onClose: () => void;
  /** Panel title displayed in header */
  title: string;
  /** Content to render in the panel body */
  children: React.ReactNode;
  /** 
   * Display mode:
   * - 'overlay': Panel slides over content with backdrop (like a modal drawer)
   * - 'push': Panel pushes the main content (requires parent layout support)
   */
  mode?: 'overlay' | 'push';
  /** Width of the panel */
  width?: string;
  /** Additional className for the panel container */
  className?: string;
  /** Additional className for the content area */
  contentClassName?: string;
  /** Custom header content (replaces default header) */
  customHeader?: React.ReactNode;
  /** Whether to show the close button */
  showCloseButton?: boolean;
  /** Side to slide in from */
  side?: 'left' | 'right';
}

/**
 * A reusable side panel component that supports both overlay and push modes.
 * 
 * In overlay mode, the panel slides in from the side with a backdrop.
 * In push mode, it integrates with the global sources panel state to push content.
 * 
 * @example
 * // Overlay mode (default)
 * <SidePanel isOpen={isOpen} onClose={() => setIsOpen(false)} title="Sources">
 *   <SourcesList />
 * </SidePanel>
 * 
 * @example
 * // Push mode - use the hook instead
 * const { openSourcesPanel, closeSourcesPanel } = useSourcesPanel();
 * openSourcesPanel('Sources', <SourcesList />);
 */
export function SidePanel({
  isOpen,
  onClose,
  title,
  children,
  mode = 'overlay',
  width = 'w-full max-w-md',
  className,
  contentClassName,
  customHeader,
  showCloseButton = true,
  side = 'right',
}: SidePanelProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  // Handle open/close animations
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      // Small delay to trigger CSS transition
      const timer = setTimeout(() => setIsVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      // Wait for animation to complete before unmounting
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle escape key
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

  // Handle backdrop click for overlay mode
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  if (!shouldRender) {
    return null;
  }

  const translateClass = side === 'right' 
    ? (isVisible ? 'translate-x-0' : 'translate-x-full')
    : (isVisible ? 'translate-x-0' : '-translate-x-full');

  const panelContent = (
    <div
      className={cn(
        'flex h-full flex-col bg-surface-primary',
        mode === 'overlay' && 'shadow-xl',
        width,
        className,
      )}
    >
      {/* Header */}
      {customHeader ?? (
        <div className="flex items-center justify-between border-b border-border-light px-4 py-3">
          <h3 className="text-base font-medium text-text-primary">{title}</h3>
          {showCloseButton && (
            <button
              className="rounded-full p-1 text-text-secondary transition-colors hover:bg-surface-tertiary hover:text-text-primary"
              onClick={onClose}
              aria-label="Close panel"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Content */}
      <div className={cn('flex-1 overflow-y-auto', contentClassName)}>{children}</div>
    </div>
  );

  // Push mode: render inline (parent controls layout)
  if (mode === 'push') {
    return (
      <div
        className={cn(
          'h-full border-l border-border-medium transition-all duration-300 ease-in-out',
          isVisible ? 'w-auto opacity-100' : 'w-0 overflow-hidden opacity-0',
        )}
      >
        {panelContent}
      </div>
    );
  }

  // Overlay mode: render via portal with backdrop
  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[100] transition-opacity duration-300',
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none',
      )}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="side-panel-title"
    >
      {/* Backdrop */}
      <div
        className={cn(
          'absolute inset-0 bg-black/30 transition-opacity duration-300',
          isVisible ? 'opacity-100' : 'opacity-0',
        )}
      />

      {/* Panel */}
      <div
        className={cn(
          'absolute inset-y-0 flex flex-col transition-transform duration-300 ease-in-out',
          side === 'right' ? 'right-0' : 'left-0',
          translateClass,
        )}
      >
        {panelContent}
      </div>
    </div>,
    document.body,
  );
}

import type { SourcesPanelMode } from '~/store/misc';

/**
 * Hook to manage the global sources/content panel state.
 * 
 * This hook provides a way to open a side panel that can either:
 * - **Push mode**: Pushes the main chat content aside (like Artifacts preview)
 * - **Overlay mode**: Slides over the content with a backdrop
 * 
 * On mobile devices, both modes render as a bottom sheet with drag-to-resize.
 * 
 * ## Usage
 * 
 * ```tsx
 * import { useSourcesPanel } from '~/components/ui/SidePanel';
 * 
 * function MyComponent() {
 *   const { openPanel, closePanel, isOpen } = useSourcesPanel();
 *   
 *   const handleOpenSources = () => {
 *     openPanel(
 *       'Sources',                    // Panel title
 *       <SourcesList sources={...} />, // Panel content (React node)
 *       'push'                         // Mode: 'push' or 'overlay' (default: 'overlay')
 *     );
 *   };
 *   
 *   return (
 *     <button onClick={handleOpenSources}>
 *       View Sources
 *     </button>
 *   );
 * }
 * ```
 * 
 * ## Modes
 * 
 * ### Push Mode (`'push'`)
 * - Panel appears beside the chat, pushing content to make room
 * - Does NOT affect the right side panel (settings/nav)
 * - Resizable with drag handle
 * - Best for: detailed content that users want to reference while chatting
 * 
 * ### Overlay Mode (`'overlay'`)
 * - Panel slides over content with semi-transparent backdrop
 * - Click backdrop to close
 * - Best for: quick views, modals, temporary content
 * 
 * ## Mobile Behavior
 * Both modes render as a draggable bottom sheet on mobile (≤868px):
 * - Drag handle at top to resize
 * - Swipe down to close
 * - Dynamic backdrop blur based on sheet height
 * 
 * ## Return Values
 * - `isOpen`: boolean - Whether the panel is currently open
 * - `title`: string - Current panel title
 * - `content`: ReactNode - Current panel content
 * - `mode`: 'push' | 'overlay' - Current display mode
 * - `openPanel(title, content, mode?, headerActions?)`: Function to open the panel
 * - `closePanel()`: Function to close the panel
 * 
 * @returns Panel state and control functions
 */
export function useSourcesPanel() {
  const [panelState, setPanelState] = useRecoilState(store.sourcesPanelState);
  const setArtifactsVisible = useSetRecoilState(store.artifactsVisibility);

  const openPanel = useCallback(
    (
      title: string,
      content: React.ReactNode,
      mode: SourcesPanelMode = 'overlay',
      headerActions?: React.ReactNode,
      width: number = 30,
    ) => {
      // Close artifacts panel when opening sources panel
      setArtifactsVisible(false);
      
      setPanelState({
        isOpen: true,
        title,
        content,
        mode,
        headerActions: headerActions ?? null,
        width,
      });
    },
    [setPanelState, setArtifactsVisible],
  );

  const closePanel = useCallback(() => {
    setPanelState((prev) => ({
      ...prev,
      isOpen: false,
    }));
  }, [setPanelState]);

  const updateHeaderActions = useCallback((headerActions: React.ReactNode) => {
    setPanelState((prev) => ({
      ...prev,
      headerActions: headerActions ?? null,
    }));
  }, [setPanelState]);

  return {
    isOpen: panelState.isOpen,
    title: panelState.title,
    content: panelState.content,
    mode: panelState.mode,
    headerActions: panelState.headerActions,
    width: panelState.width ?? 30,
    openPanel,
    closePanel,
    updateHeaderActions,
  };
}

/**
 * Hook to manage local side panel state (for overlay mode)
 */
export function useSidePanel(initialOpen = false) {
  const [isOpen, setIsOpen] = useState(initialOpen);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return {
    isOpen,
    open,
    close,
    toggle,
    setIsOpen,
  };
}

/**
 * Global Sources Panel component for overlay mode and mobile bottom sheet.
 * 
 * - Push mode on desktop: Handled by SourcesPanel inside SidePanelGroup (with draggable resize)
 * - Overlay mode: Panel slides over content (rendered via portal)
 * - Mobile: Always renders as a bottom sheet via portal
 * 
 * This should be rendered at the layout level (e.g., in Presentation.tsx, LeftPanelLayout.tsx)
 * 
 * Note: LeftPanelLayout uses SidePanelGroup with hideNavPanel=true to get the same
 * push panel functionality as the chat view.
 */
export function GlobalSourcesPanel() {
  const { isOpen, title, content, mode, headerActions, closePanel } = useSourcesPanel();
  const isInsideSidePanelGroup = useIsInsideSidePanelGroup();
  const isMobile = useMediaQuery('(max-width: 868px)');
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  
  // Mobile bottom sheet state
  const [height, setHeight] = useState(70);
  const [isDragging, setIsDragging] = useState(false);
  const [blurAmount, setBlurAmount] = useState(0);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(70);

  const MAX_BLUR_AMOUNT = 32;
  const MAX_BACKDROP_OPACITY = 0.3;

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      const delay = isMobile ? 50 : 10;
      const timer = setTimeout(() => setIsVisible(true), delay);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
        setHeight(70);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isMobile]);

  // Calculate blur for mobile backdrop
  useEffect(() => {
    if (!isMobile) {
      setBlurAmount(0);
      return;
    }

    const minHeightForBlur = 40;
    const maxHeightForBlur = 80;

    if (height <= minHeightForBlur) {
      setBlurAmount(0);
    } else if (height >= maxHeightForBlur) {
      setBlurAmount(MAX_BLUR_AMOUNT);
    } else {
      const progress = (height - minHeightForBlur) / (maxHeightForBlur - minHeightForBlur);
      setBlurAmount(Math.round(progress * MAX_BLUR_AMOUNT));
    }
  }, [height, isMobile]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleClose = useCallback(() => {
    if (isMobile) {
      setIsClosing(true);
      setIsVisible(false);
      setTimeout(() => {
        closePanel();
        setIsClosing(false);
        setHeight(70);
      }, 250);
    } else {
      closePanel();
    }
  }, [isMobile, closePanel]);

  // Mobile drag handlers
  const handleDragStart = useCallback((e: React.PointerEvent) => {
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartHeight.current = height;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [height]);

  const handleDragMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;

    const deltaY = dragStartY.current - e.clientY;
    const viewportHeight = window.innerHeight;
    const deltaPercentage = (deltaY / viewportHeight) * 100;
    const newHeight = Math.max(10, Math.min(90, dragStartHeight.current + deltaPercentage));

    setHeight(newHeight);
  }, [isDragging]);

  const handleDragEnd = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;

    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    // Snap to positions based on final height
    if (height < 25) {
      handleClose();
    } else if (height > 80) {
      setHeight(90);
    } else if (height < 50) {
      setHeight(40);
    } else {
      setHeight(70);
    }
  }, [isDragging, height, handleClose]);

  if (!shouldRender) {
    return null;
  }

  // Desktop Push mode: If inside SidePanelGroup, SourcesPanel handles it with resizable panels
  // GlobalSourcesPanel only handles overlay mode and mobile bottom sheet
  if (!isMobile && mode === 'push' && isInsideSidePanelGroup) {
    return null;
  }

  const backdropOpacity =
    blurAmount > 0
      ? (Math.min(blurAmount, MAX_BLUR_AMOUNT) / MAX_BLUR_AMOUNT) * MAX_BACKDROP_OPACITY
      : 0;

  // Mobile: Bottom sheet via portal
  if (isMobile) {
    return createPortal(
      <>
        {/* Backdrop with dynamic blur */}
        <div
          className={cn(
            'fixed inset-0 z-[99] bg-black will-change-[opacity,backdrop-filter]',
            isVisible && !isClosing
              ? 'transition-all duration-300'
              : 'pointer-events-none opacity-0 backdrop-blur-none transition-opacity duration-150',
            blurAmount < 8 && isVisible && !isClosing ? 'pointer-events-none' : '',
          )}
          style={{
            opacity: isVisible && !isClosing ? backdropOpacity : 0,
            backdropFilter: isVisible && !isClosing ? `blur(${blurAmount}px)` : 'none',
            WebkitBackdropFilter: isVisible && !isClosing ? `blur(${blurAmount}px)` : 'none',
          }}
          onClick={blurAmount >= 8 ? handleClose : undefined}
          aria-hidden="true"
        />

        {/* Bottom sheet panel */}
        <div
          className={cn(
            'fixed inset-x-0 bottom-0 z-[100] flex flex-col overflow-hidden rounded-t-[20px] bg-surface-primary shadow-[0_-10px_60px_rgba(0,0,0,0.35)]',
            isVisible && !isClosing
              ? 'translate-y-0 opacity-100'
              : 'translate-y-full opacity-0',
            isDragging ? '' : 'transition-all duration-300',
          )}
          style={{ height: `${height}vh` }}
        >
          {/* Drag handle */}
          <div
            className="flex flex-shrink-0 cursor-grab items-center justify-center pb-1.5 pt-2.5 active:cursor-grabbing"
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
            onPointerCancel={handleDragEnd}
          >
            <div className="h-1 w-12 rounded-full bg-border-xheavy opacity-40 transition-all duration-200 active:opacity-60" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between border-b border-border-light px-4 py-2">
            <div className="flex min-w-0 flex-1 items-center">
              <button
                className="mr-2 flex-shrink-0 text-text-secondary hover:text-text-primary"
                onClick={handleClose}
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <h3 className="max-w-[200px] truncate text-sm font-medium text-text-primary">{title}</h3>
            </div>
            <button
              className="flex-shrink-0 rounded-full p-1 text-text-secondary transition-colors hover:bg-surface-tertiary hover:text-text-primary"
              onClick={handleClose}
              aria-label="Close panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">{content}</div>
        </div>
      </>,
      document.body,
    );
  }

  // Desktop Overlay mode: Right side panel via portal (slides over content)
  return createPortal(
    <>
      {/* Semi-transparent backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-[98] bg-black/20 transition-opacity duration-300',
          isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Panel sliding from right */}
      <div
        className={cn(
          'fixed inset-y-0 right-0 z-[99] flex w-[400px] max-w-[90vw] flex-col border-l border-border-medium bg-surface-primary shadow-[-8px_0_24px_-12px_rgba(0,0,0,0.25)] transition-transform duration-300 ease-in-out',
          isVisible ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-light px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center">
            <button
              className="mr-2 flex-shrink-0 text-text-secondary hover:text-text-primary"
              onClick={handleClose}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h3 className="max-w-[280px] truncate text-base font-medium text-text-primary">{title}</h3>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            {headerActions}
            <button
              className="rounded-full p-1 text-text-secondary transition-colors hover:bg-surface-tertiary hover:text-text-primary"
              onClick={handleClose}
              aria-label="Close panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">{content}</div>
      </div>
    </>,
    document.body,
  );
}

export default SidePanel;
