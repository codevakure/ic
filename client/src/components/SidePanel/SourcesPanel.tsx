import { useRef, useEffect, useState, memo } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { ResizableHandleAlt, ResizablePanel } from '@librechat/client';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import { useSourcesPanel } from '~/components/ui/SidePanel';
import { cn } from '~/utils';

interface SourcesPanelProps {
  currentLayout: number[];
  defaultSize: number;
  minSize: number;
  maxSize: number;
  order: number;
  shouldRender: boolean;
  onRenderChange: (shouldRender: boolean) => void;
}

/**
 * SourcesPanel component - renders as a ResizablePanel inside the layout
 * Similar to ArtifactsPanel, pushes main content but not the right side panel
 * 
 * This component is used internally by SidePanelGroup and should not be used directly.
 * To open the sources panel, use the `useSourcesPanel` hook:
 * 
 * @example
 * ```tsx
 * import { useSourcesPanel } from '~/components/ui/SidePanel';
 * 
 * function MyComponent() {
 *   const { openPanel, closePanel } = useSourcesPanel();
 *   
 *   const handleClick = () => {
 *     openPanel(
 *       'My Panel Title',
 *       <div>My content here</div>,
 *       'push' // or 'overlay'
 *     );
 *   };
 *   
 *   return <button onClick={handleClick}>Open Panel</button>;
 * }
 * ```
 */
const SourcesPanel = memo(function SourcesPanel({
  defaultSize,
  minSize,
  maxSize,
  order,
  shouldRender,
  onRenderChange,
}: SourcesPanelProps) {
  const sourcesPanelRef = useRef<ImperativePanelHandle>(null);
  const { isOpen, title, content, mode, closePanel } = useSourcesPanel();
  const [isVisible, setIsVisible] = useState(false);

  // Only use this panel for push mode on desktop
  const shouldShow = isOpen && mode === 'push';

  useEffect(() => {
    if (shouldShow) {
      onRenderChange(true);
      // Delay visibility for animation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          sourcesPanelRef.current?.expand();
          // Small delay before showing content for smooth animation
          setTimeout(() => setIsVisible(true), 50);
        });
      });
    } else if (shouldRender && !shouldShow) {
      setIsVisible(false);
      sourcesPanelRef.current?.collapse();
      // Delay hiding to allow collapse animation
      setTimeout(() => {
        onRenderChange(false);
      }, 300);
    }
  }, [shouldShow, shouldRender, onRenderChange]);

  if (!shouldRender) {
    return null;
  }

  return (
    <>
      {shouldShow && (
        <ResizableHandleAlt withHandle className="bg-border-medium text-text-primary" />
      )}
      <ResizablePanel
        ref={sourcesPanelRef}
        defaultSize={shouldShow ? defaultSize : 0}
        minSize={minSize}
        maxSize={maxSize}
        collapsible={true}
        collapsedSize={0}
        order={order}
        id="sources-panel"
      >
        <div className="h-full min-w-[400px] overflow-hidden">
          <div 
            className={cn(
              'flex h-full w-full flex-col bg-surface-primary shadow-[8px_0_24px_-12px_rgba(0,0,0,0.25)] transition-all duration-300 ease-in-out',
              isVisible 
                ? 'scale-100 opacity-100 blur-0' 
                : 'scale-105 opacity-0 blur-sm',
            )}
          >
            {/* Header */}
            <div className="flex flex-shrink-0 items-center justify-between border-b border-border-light px-4 py-3">
              <div className="flex items-center gap-2">
                <button
                  className="text-text-secondary hover:text-text-primary"
                  onClick={closePanel}
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <h3 className="text-base font-medium text-text-primary">{title}</h3>
              </div>
              <button
                className="rounded-full p-1 text-text-secondary transition-colors hover:bg-surface-tertiary hover:text-text-primary"
                onClick={closePanel}
                aria-label="Close panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">{content}</div>
          </div>
        </div>
      </ResizablePanel>
    </>
  );
});

SourcesPanel.displayName = 'SourcesPanel';

export default SourcesPanel;
