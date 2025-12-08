import { useState, useRef, useCallback, useEffect, useMemo, memo } from 'react';
import throttle from 'lodash/throttle';
import { useRecoilValue } from 'recoil';
import { getConfigDefaults, SystemRoles } from 'ranger-data-provider';
import { ResizablePanel, ResizablePanelGroup, useMediaQuery } from '@ranger/client';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import { useSourcesPanel, SidePanelGroupProvider, GlobalSourcesPanel } from '~/components/ui/SidePanel';
import { useArtifactsPanelContext } from '~/Providers';
import { useGetStartupConfig } from '~/data-provider';
import { useAuthContext } from '~/hooks/AuthContext';
import ArtifactsPanel from './ArtifactsPanel';
import SourcesPanel from './SourcesPanel';
import { normalizeLayout } from '~/utils';
import SidePanel from './SidePanel';
import store from '~/store';

interface SidePanelProps {
  defaultLayout?: number[] | undefined;
  defaultCollapsed?: boolean;
  navCollapsedSize?: number;
  fullPanelCollapse?: boolean;
  /** Whether artifacts should be visible (content is rendered via portal from Presentation) */
  hasArtifacts?: boolean;
  children: React.ReactNode;
  /** Hide the right navigation side panel (for standalone pages like Bookmarks) */
  hideNavPanel?: boolean;
}

const defaultMinSize = 20;
const defaultInterface = getConfigDefaults().interface;

const SidePanelGroup = memo(
  ({
    defaultLayout = [97, 3],
    defaultCollapsed = false,
    fullPanelCollapse = false,
    navCollapsedSize = 3,
    hasArtifacts = false,
    children,
    hideNavPanel = false,
  }: SidePanelProps) => {
    const { data: startupConfig } = useGetStartupConfig();
    const { user } = useAuthContext();
    const interfaceConfig = useMemo(
      () => startupConfig?.interface ?? defaultInterface,
      [startupConfig],
    );
    
    // Get the portal target setter from context
    const { setPortalTarget } = useArtifactsPanelContext();
    
    // Callback to handle portal target mount/unmount
    const handlePortalTargetMount = useCallback((element: HTMLDivElement | null) => {
      setPortalTarget(element);
    }, [setPortalTarget]);

    // Hide side panel for non-admin users
    const shouldHideSidePanel = user?.role !== SystemRoles.ADMIN;

    const panelRef = useRef<ImperativePanelHandle>(null);
    const [minSize, setMinSize] = useState(defaultMinSize);
    const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
    const [fullCollapse, setFullCollapse] = useState(fullPanelCollapse);
    const [collapsedSize, setCollapsedSize] = useState(navCollapsedSize);
    const [shouldRenderArtifacts, setShouldRenderArtifacts] = useState(hasArtifacts);
    const [shouldRenderSources, setShouldRenderSources] = useState(false);

    const isSmallScreen = useMediaQuery('(max-width: 767px)');
    const hideSidePanel = useRecoilValue(store.hideSidePanel);
    
    // Get sources panel state to include in layout calculations
    const { isOpen: sourcesOpen, mode: sourcesMode, width: sourcesWidth } = useSourcesPanel();
    const sourcesActive = sourcesOpen && sourcesMode === 'push' && !isSmallScreen;

    const calculateLayout = useCallback(() => {
      // When sources panel is active (push mode), use dynamic width
      if (sourcesActive && !hasArtifacts) {
        const navSize = 0;
        const panelWidth = sourcesWidth ?? 30; // Use configured width or default to 30%
        const mainSize = 100 - navSize - panelWidth;
        return [mainSize, panelWidth, navSize];
      }
      if (!hasArtifacts) {
        const navSize = defaultLayout.length === 2 ? defaultLayout[1] : defaultLayout[2];
        return [100 - navSize, navSize];
      } else {
        const navSize = 0;
        const remainingSpace = 100 - navSize;
        const artifactsSize = 40; // 40% for artifacts panel
        const newMainSize = remainingSpace - artifactsSize;
        return [newMainSize, artifactsSize, navSize];
      }
    }, [hasArtifacts, defaultLayout, sourcesActive, sourcesWidth]);

    const currentLayout = useMemo(() => normalizeLayout(calculateLayout()), [calculateLayout]);

    const throttledSaveLayout = useMemo(
      () =>
        throttle((sizes: number[]) => {
          const normalizedSizes = normalizeLayout(sizes);
          localStorage.setItem('react-resizable-panels:layout', JSON.stringify(normalizedSizes));
        }, 350),
      [],
    );

    useEffect(() => {
      if (isSmallScreen) {
        setIsCollapsed(true);
        setCollapsedSize(0);
        setMinSize(defaultMinSize);
        setFullCollapse(true);
        localStorage.setItem('fullPanelCollapse', 'true');
        panelRef.current?.collapse();
        return;
      } else {
        setIsCollapsed(defaultCollapsed);
        setCollapsedSize(navCollapsedSize);
        setMinSize(defaultMinSize);
      }
    }, [isSmallScreen, defaultCollapsed, navCollapsedSize, fullPanelCollapse]);

    const minSizeMain = useMemo(() => {
      if (hasArtifacts || sourcesActive) {
        return 15;
      }
      return 30;
    }, [hasArtifacts, sourcesActive]);

    /** Memoized close button handler to prevent re-creating it */
    const handleClosePanel = useCallback(() => {
      setIsCollapsed(() => {
        localStorage.setItem('fullPanelCollapse', 'true');
        setFullCollapse(true);
        setCollapsedSize(0);
        setMinSize(0);
        return false;
      });
      panelRef.current?.collapse();
    }, []);
    
    // Update shouldRenderArtifacts when hasArtifacts changes
    useEffect(() => {
      if (hasArtifacts) {
        setShouldRenderArtifacts(true);
      }
    }, [hasArtifacts]);

    return (
      <SidePanelGroupProvider>
        <ResizablePanelGroup
          direction="horizontal"
          onLayout={(sizes) => throttledSaveLayout(sizes)}
          className="relative h-full w-full flex-1 overflow-auto bg-presentation"
        >
          <ResizablePanel
            defaultSize={currentLayout[0]}
            minSize={minSizeMain}
            order={1}
            id="messages-view"
          >
            {children}
          </ResizablePanel>

          {!isSmallScreen && (
            <ArtifactsPanel
              onPortalTargetMount={handlePortalTargetMount}
              hasArtifacts={hasArtifacts}
              currentLayout={currentLayout}
              minSizeMain={minSizeMain}
              shouldRender={shouldRenderArtifacts}
              onRenderChange={setShouldRenderArtifacts}
            />
          )}

          {!isSmallScreen && (
            <SourcesPanel
              currentLayout={currentLayout}
              defaultSize={sourcesWidth ?? 30}
              minSize={minSizeMain}
              maxSize={70}
              order={2}
              shouldRender={shouldRenderSources}
              onRenderChange={setShouldRenderSources}
            />
          )}

          {!hideNavPanel && !hideSidePanel && !shouldHideSidePanel && interfaceConfig.sidePanel === true && (
            <SidePanel
              panelRef={panelRef}
              minSize={minSize}
              setMinSize={setMinSize}
              isCollapsed={isCollapsed}
              setIsCollapsed={setIsCollapsed}
              collapsedSize={collapsedSize}
              setCollapsedSize={setCollapsedSize}
              fullCollapse={fullCollapse}
              setFullCollapse={setFullCollapse}
              interfaceConfig={interfaceConfig}
              hasArtifacts={shouldRenderArtifacts}
              defaultSize={currentLayout[currentLayout.length - 1]}
            />
          )}
        </ResizablePanelGroup>
        {hasArtifacts && isSmallScreen && (
          <div 
            className="fixed inset-0 z-[100]" 
            ref={handlePortalTargetMount} 
          />
        )}
        {!hideNavPanel && !hideSidePanel && !shouldHideSidePanel && interfaceConfig.sidePanel === true && (
          <button
            aria-label="Close right side panel"
            className={`nav-mask ${!isCollapsed ? 'active' : ''}`}
            onClick={handleClosePanel}
          />
        )}
        {/* 
          GlobalSourcesPanel is rendered INSIDE SidePanelGroupProvider context.
          This ensures:
          - Push mode on desktop: Returns null (SourcesPanel handles it)
          - Overlay mode: Renders slide-over panel via portal
          - Mobile: Renders bottom sheet via portal
        */}
        <GlobalSourcesPanel />
      </SidePanelGroupProvider>
    );
  },
);

SidePanelGroup.displayName = 'SidePanelGroup';

export default SidePanelGroup;
