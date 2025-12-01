import { useState, useRef, useCallback, useEffect, useMemo, memo } from 'react';
import throttle from 'lodash/throttle';
import { useRecoilValue } from 'recoil';
import { getConfigDefaults } from 'librechat-data-provider';
import { ResizablePanel, ResizablePanelGroup, useMediaQuery } from '@librechat/client';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import { useSourcesPanel } from '~/components/ui/SidePanel';
import { useGetStartupConfig } from '~/data-provider';
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
  artifacts?: React.ReactNode;
  children: React.ReactNode;
}

const defaultMinSize = 20;
const defaultInterface = getConfigDefaults().interface;

const SidePanelGroup = memo(
  ({
    defaultLayout = [97, 3],
    defaultCollapsed = false,
    fullPanelCollapse = false,
    navCollapsedSize = 3,
    artifacts,
    children,
  }: SidePanelProps) => {
    const { data: startupConfig } = useGetStartupConfig();
    const interfaceConfig = useMemo(
      () => startupConfig?.interface ?? defaultInterface,
      [startupConfig],
    );

    const panelRef = useRef<ImperativePanelHandle>(null);
    const [minSize, setMinSize] = useState(defaultMinSize);
    const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
    const [fullCollapse, setFullCollapse] = useState(fullPanelCollapse);
    const [collapsedSize, setCollapsedSize] = useState(navCollapsedSize);
    const [shouldRenderArtifacts, setShouldRenderArtifacts] = useState(artifacts != null);
    const [shouldRenderSources, setShouldRenderSources] = useState(false);

    const isSmallScreen = useMediaQuery('(max-width: 767px)');
    const hideSidePanel = useRecoilValue(store.hideSidePanel);
    
    // Get sources panel state to include in layout calculations
    const { isOpen: sourcesOpen, mode: sourcesMode } = useSourcesPanel();
    const sourcesActive = sourcesOpen && sourcesMode === 'push' && !isSmallScreen;

    const calculateLayout = useCallback(() => {
      // When sources panel is active (push mode), calculate layout like artifacts (50/50 split)
      if (sourcesActive && artifacts == null) {
        const navSize = 0;
        const remainingSpace = 100 - navSize;
        const newMainSize = Math.floor(remainingSpace / 2);
        const sourcesSize = remainingSpace - newMainSize;
        return [newMainSize, sourcesSize, navSize];
      }
      if (artifacts == null) {
        const navSize = defaultLayout.length === 2 ? defaultLayout[1] : defaultLayout[2];
        return [100 - navSize, navSize];
      } else {
        const navSize = 0;
        const remainingSpace = 100 - navSize;
        const newMainSize = Math.floor(remainingSpace / 2);
        const artifactsSize = remainingSpace - newMainSize;
        return [newMainSize, artifactsSize, navSize];
      }
    }, [artifacts, defaultLayout, sourcesActive]);

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
      if (artifacts != null || sourcesActive) {
        return 15;
      }
      return 30;
    }, [artifacts, sourcesActive]);

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

    return (
      <>
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
              artifacts={artifacts}
              currentLayout={currentLayout}
              minSizeMain={minSizeMain}
              shouldRender={shouldRenderArtifacts}
              onRenderChange={setShouldRenderArtifacts}
            />
          )}

          {!isSmallScreen && (
            <SourcesPanel
              currentLayout={currentLayout}
              defaultSize={currentLayout[1] || 50}
              minSize={minSizeMain}
              maxSize={70}
              order={2}
              shouldRender={shouldRenderSources}
              onRenderChange={setShouldRenderSources}
            />
          )}

          {!hideSidePanel && interfaceConfig.sidePanel === true && (
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
        {artifacts != null && isSmallScreen && (
          <div className="fixed inset-0 z-[100]">{artifacts}</div>
        )}
        {!hideSidePanel && interfaceConfig.sidePanel === true && (
          <button
            aria-label="Close right side panel"
            className={`nav-mask ${!isCollapsed ? 'active' : ''}`}
            onClick={handleClosePanel}
          />
        )}
      </>
    );
  },
);

SidePanelGroup.displayName = 'SidePanelGroup';

export default SidePanelGroup;
