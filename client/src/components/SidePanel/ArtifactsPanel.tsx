import { useRef, useEffect, memo, useCallback } from 'react';
import { ResizableHandleAlt, ResizablePanel } from '@ranger/client';
import type { ImperativePanelHandle } from 'react-resizable-panels';

interface ArtifactsPanelProps {
  /** Callback to register the portal target element */
  onPortalTargetMount: (element: HTMLDivElement | null) => void;
  /** Whether artifacts are visible (content rendered via portal from Presentation) */
  hasArtifacts: boolean;
  currentLayout: number[];
  minSizeMain: number;
  shouldRender: boolean;
  onRenderChange: (shouldRender: boolean) => void;
}

/**
 * ArtifactsPanel component - memoized to prevent unnecessary re-renders
 * 
 * This component provides the resizable panel container for artifacts.
 * The actual artifact content is rendered via React Portal from Presentation
 * to maintain ChatContext access while displaying in this panel.
 */
const ArtifactsPanel = memo(function ArtifactsPanel({
  onPortalTargetMount,
  hasArtifacts,
  currentLayout,
  minSizeMain,
  shouldRender,
  onRenderChange,
}: ArtifactsPanelProps) {
  const artifactsPanelRef = useRef<ImperativePanelHandle>(null);

  useEffect(() => {
    if (hasArtifacts) {
      onRenderChange(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          artifactsPanelRef.current?.expand();
        });
      });
    } else if (shouldRender) {
      onRenderChange(false);
    }
  }, [hasArtifacts, shouldRender, onRenderChange]);

  // Callback ref to register/unregister portal target
  const portalTargetCallbackRef = useCallback((node: HTMLDivElement | null) => {
    onPortalTargetMount(node);
  }, [onPortalTargetMount]);

  if (!shouldRender) {
    return null;
  }

  return (
    <>
      {hasArtifacts && (
        <ResizableHandleAlt withHandle className="bg-border-medium text-text-primary" />
      )}
      <ResizablePanel
        ref={artifactsPanelRef}
        defaultSize={hasArtifacts ? currentLayout[1] : 0}
        minSize={minSizeMain}
        maxSize={70}
        collapsible={true}
        collapsedSize={0}
        order={2}
        id="artifacts-panel"
      >
        {/* Portal target - artifacts are rendered here via portal from Presentation */}
        <div 
          ref={portalTargetCallbackRef} 
          className="h-full min-w-[400px] overflow-hidden"
        />
      </ResizablePanel>
    </>
  );
});

ArtifactsPanel.displayName = 'ArtifactsPanel';

export default ArtifactsPanel;
