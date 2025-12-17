import React, { useMemo, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useSetRecoilState } from 'recoil';
import { FileSources, LocalStorageKeys } from 'librechat-data-provider';
import type { ExtendedFile } from '~/common';
import { useDeleteFilesMutation } from '~/data-provider';
import {
  SidePanelProvider,
  PromptGroupsProvider,
  AssistantsMapContext,
  AgentsMapContext,
  SetConvoProvider,
  FileMapContext,
  ArtifactsPanelProvider,
  useArtifactsPanelContext,
} from '~/Providers';
import { SidePanelGroup } from '~/components/SidePanel';
import {
  useSetFilesToDelete,
  useAuthContext,
  useAssistantsMap,
  useAgentsMap,
  useFileMap,
} from '~/hooks';
import store from '~/store';

/**
 * =============================================================================
 * AppLayout - Shared Application Shell
 * =============================================================================
 * 
 * This is the root authenticated layout that provides shared panel infrastructure
 * for the entire application. It wraps all authenticated routes and provides:
 * 
 * 1. **SidePanelGroup**: Resizable panel layout with support for:
 *    - Push mode sources panel (opens beside content, resizable)
 *    - Artifacts panel (code preview, rich content)
 *    - Right navigation panel (settings, tools)
 * 
 * 2. **GlobalSourcesPanel**: Handles overlay and mobile modes:
 *    - Overlay mode: Slides over content with backdrop
 *    - Mobile: Bottom sheet with drag-to-resize
 * 
 * ## Architecture
 * 
 * ```
 * AppLayout (this file)
 * ├── SidePanelGroup (shared for all pages)
 * │   ├── [main content - Outlet]
 * │   ├── SourcesPanel (push mode - resizable)
 * │   ├── ArtifactsPanel
 * │   └── SidePanel (right nav - conditional)
 * └── GlobalSourcesPanel (overlay/mobile modes - inside context!)
 * 
 * Children of AppLayout:
 * ├── Root (ChatLayout) → /c/:id, /search, /files, /conversations, /agents
 * │   ├── LeftPanel, Nav, MobileNav
 * │   └── ChatView → Presentation wrapper
 * └── LeftPanelLayout → /bookmarks, /placeholder
 *     ├── LeftPanel
 *     └── Page content
 * ```
 * 
 * ## Why This Architecture?
 * 
 * Previously, each page (Presentation.tsx, Marketplace.tsx, LeftPanelLayout.tsx)
 * had its own SidePanelGroup, causing:
 * - Duplicate panel infrastructure
 * - Double panels when opening push mode from pages outside chat
 * - Inconsistent behavior across routes
 * 
 * With AppLayout:
 * - Single SidePanelGroup for entire app
 * - GlobalSourcesPanel is INSIDE the context (no double panels)
 * - Push mode works everywhere consistently
 * - Mobile bottom sheet works everywhere
 * 
 * ## Usage
 * 
 * In routes/index.tsx, wrap Root and LeftPanelLayout under AppLayout:
 * 
 * ```tsx
 * {
 *   element: <AppLayout />,
 *   children: [
 *     { element: <LeftPanelLayout />, children: [...] },
 *     { element: <Root />, children: [...] },
 *   ]
 * }
 * ```
 * 
 * ## Using Push Panels from Any Page
 * 
 * ```tsx
 * import { useSourcesPanel } from '~/components/ui/SidePanel';
 * 
 * function MyPage() {
 *   const { openPanel, closePanel } = useSourcesPanel();
 *   
 *   const handleOpen = () => {
 *     openPanel('My Panel', <MyContent />, 'push');
 *   };
 *   
 *   return <button onClick={handleOpen}>Open Panel</button>;
 * }
 * ```
 * 
 * @see SidePanelGroup - The resizable panel layout component
 * @see useSourcesPanel - Hook to open/close panels from any component
 * @see GlobalSourcesPanel - Handles overlay and mobile modes
 */

/**
 * Inner component that consumes the ArtifactsPanelContext.
 * This is separated to allow useArtifactsPanelContext to work (needs to be inside provider).
 */
function AppLayoutInner() {
  const { isAuthenticated } = useAuthContext();
  const location = useLocation();
  const previousPathRef = useRef(location.pathname);
  
  // Shared context data - available to all child routes (Root + LeftPanelLayout)
  const assistantsMap = useAssistantsMap({ isAuthenticated });
  const agentsMap = useAgentsMap({ isAuthenticated });
  const fileMap = useFileMap({ isAuthenticated });
  
  // Get hasArtifacts from context - Presentation tells us when artifacts should be visible
  // The actual artifacts are rendered via portal from Presentation (maintaining ChatContext)
  const { hasArtifacts, setHasArtifacts } = useArtifactsPanelContext();
  
  const setSourcesPanelState = useSetRecoilState(store.sourcesPanelState);
  const setArtifactsVisible = useSetRecoilState(store.artifactsVisibility);

  const setFilesToDelete = useSetFilesToDelete();

  /**
   * Auto-close panels on route navigation.
   * 
   * Close the panel when:
   * - Navigating between different conversations (e.g., /c/abc -> /c/xyz)
   * - Navigating away from chat entirely (e.g., /c/abc -> /prompts)
   * 
   * Keep panel open when:
   * - First message creates conversation (e.g., /c/new -> /c/abc123)
   *   This allows MCP UI resources to stay visible during streaming.
   * 
   * This ensures each conversation's artifacts/UI resources can properly initialize.
   */
  useEffect(() => {
    // Only close if the path actually changed (not on initial mount)
    if (previousPathRef.current !== location.pathname) {
      const wasNew = previousPathRef.current === '/c/new';
      const isInChat = location.pathname.startsWith('/c/');
      const wasInChat = previousPathRef.current?.startsWith('/c/');
      
      // Don't close when going from /c/new to /c/<id> (conversation creation during streaming)
      // Close in all other cases (switching conversations, leaving chat, etc.)
      const isConversationCreation = wasNew && isInChat && location.pathname !== '/c/new';
      
      if (!isConversationCreation) {
        setSourcesPanelState((prev) => ({
          ...prev,
          isOpen: false,
        }));
        // Restore artifacts visibility when sources panel closes via navigation
        setArtifactsVisible(true);
      }
      
      // Reset artifacts when navigating away from chat routes
      // This prevents the artifacts panel from taking up space on non-chat pages
      if (wasInChat && !isInChat) {
        setHasArtifacts(false);
      }
      
      previousPathRef.current = location.pathname;
    }
  }, [location.pathname, setSourcesPanelState, setArtifactsVisible, setHasArtifacts]);

  const { mutateAsync } = useDeleteFilesMutation({
    onSuccess: () => {
      setFilesToDelete({});
    },
    onError: (error) => {
      console.error('Error deleting temporary files:', error);
    },
  });

  // Cleanup temporary files on mount
  useEffect(() => {
    const filesToDelete = localStorage.getItem(LocalStorageKeys.FILES_TO_DELETE);
    const map = JSON.parse(filesToDelete ?? '{}') as Record<string, ExtendedFile>;
    const files = Object.values(map)
      .filter(
        (file) =>
          file.filepath != null && file.source && !(file.embedded ?? false) && file.temp_file_id,
      )
      .map((file) => ({
        file_id: file.file_id,
        filepath: file.filepath as string,
        source: file.source as FileSources,
        embedded: !!(file.embedded ?? false),
      }));

    if (files.length === 0) {
      return;
    }
    mutateAsync({ files });
  }, [mutateAsync]);

  // Panel layout configuration from localStorage
  const defaultLayout = useMemo(() => {
    const resizableLayout = localStorage.getItem('react-resizable-panels:layout');
    return typeof resizableLayout === 'string' ? JSON.parse(resizableLayout) : undefined;
  }, []);
  
  const defaultCollapsed = useMemo(() => {
    const collapsedPanels = localStorage.getItem('react-resizable-panels:collapsed');
    return typeof collapsedPanels === 'string' ? JSON.parse(collapsedPanels) : true;
  }, []);
  
  const fullCollapse = useMemo(() => localStorage.getItem('fullPanelCollapse') === 'true', []);

  /**
   * Determine if we should hide the right nav panel.
   * Pages like /bookmarks, /placeholder, /files, /agents don't need the right nav.
   * 
   * This is determined by route path - standalone pages hide the nav.
   */
  const shouldHideNavPanel = useMemo(() => {
    const standaloneRoutes = ['/bookmarks', '/placeholder', '/files', '/agents'];
    return standaloneRoutes.some(route => location.pathname.startsWith(route));
  }, [location.pathname]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <SetConvoProvider>
      <FileMapContext.Provider value={fileMap}>
        <AssistantsMapContext.Provider value={assistantsMap}>
          <AgentsMapContext.Provider value={agentsMap}>
            <PromptGroupsProvider>
              <SidePanelProvider>
                <div className="relative flex h-full w-full flex-1 overflow-hidden">
                  <SidePanelGroup
                    defaultLayout={defaultLayout}
                    fullPanelCollapse={fullCollapse}
                    defaultCollapsed={defaultCollapsed}
                    hasArtifacts={hasArtifacts}
                    hideNavPanel={shouldHideNavPanel}
                  >
                    {/* Main content area - child layouts render here */}
                    <Outlet />
                  </SidePanelGroup>
                </div>
              </SidePanelProvider>
            </PromptGroupsProvider>
          </AgentsMapContext.Provider>
        </AssistantsMapContext.Provider>
      </FileMapContext.Provider>
    </SetConvoProvider>
  );
}

/**
 * AppLayout - Root component that provides ArtifactsPanelProvider.
 * 
 * This wrapper ensures that:
 * 1. ArtifactsPanelProvider is at the top level
 * 2. Presentation (inside ChatContext) can register its artifacts element
 * 3. SidePanelGroup can consume that artifacts element
 * 
 * This architecture allows artifacts to work correctly with ChatContext
 * (for isSubmitting, latestMessage, tab switching) while still being
 * displayed in the shared SidePanelGroup at the AppLayout level.
 */
export default function AppLayout() {
  const { isAuthenticated } = useAuthContext();
  
  if (!isAuthenticated) {
    return null;
  }

  return (
    <ArtifactsPanelProvider>
      <AppLayoutInner />
    </ArtifactsPanelProvider>
  );
}
