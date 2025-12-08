import React, { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';

interface ArtifactsPanelContextValue {
  /** The DOM element where artifacts should be portaled to */
  portalTarget: HTMLElement | null;
  /** Register the portal target element (called by SidePanelGroup) */
  setPortalTarget: (element: HTMLElement | null) => void;
  /** Whether artifacts are currently visible */
  hasArtifacts: boolean;
  /** Set whether artifacts are visible (called by Presentation) */
  setHasArtifacts: (value: boolean) => void;
}

const ArtifactsPanelContext = createContext<ArtifactsPanelContextValue | undefined>(undefined);

interface ArtifactsPanelProviderProps {
  children: React.ReactNode;
}

/**
 * ArtifactsPanelProvider - Portal-based bridge for artifacts rendering
 * 
 * This provider enables artifacts to be rendered inside ChatContext (in Presentation)
 * while being displayed in the correct visual position (inside SidePanelGroup's panel).
 * 
 * Flow:
 * 1. SidePanelGroup registers a portal target element via setPortalTarget
 * 2. Presentation renders ArtifactsProvider + Artifacts via createPortal to that target
 * 3. Since portals maintain React context, artifacts have access to ChatContext
 * 
 * This solves the problem of:
 * - ArtifactsProvider needing ChatContext (for isSubmitting, latestMessage, etc.)
 * - Artifacts needing to be displayed in SidePanelGroup's resizable panel
 */
export function ArtifactsPanelProvider({ children }: ArtifactsPanelProviderProps) {
  const [portalTarget, setPortalTargetState] = useState<HTMLElement | null>(null);
  const [hasArtifacts, setHasArtifactsState] = useState(false);

  const setPortalTarget = useCallback((element: HTMLElement | null) => {
    setPortalTargetState(element);
  }, []);

  const setHasArtifacts = useCallback((value: boolean) => {
    setHasArtifactsState(value);
  }, []);

  const value = useMemo(
    () => ({ portalTarget, setPortalTarget, hasArtifacts, setHasArtifacts }),
    [portalTarget, setPortalTarget, hasArtifacts, setHasArtifacts],
  );

  return (
    <ArtifactsPanelContext.Provider value={value}>
      {children}
    </ArtifactsPanelContext.Provider>
  );
}

export function useArtifactsPanelContext() {
  const context = useContext(ArtifactsPanelContext);
  if (!context) {
    throw new Error('useArtifactsPanelContext must be used within ArtifactsPanelProvider');
  }
  return context;
}
