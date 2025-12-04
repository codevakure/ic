import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAuthContext } from '~/hooks';
import { LeftPanel } from '~/components/LeftPanel';
import { MobileHeader } from '~/components/Nav';

/**
 * =============================================================================
 * LeftPanelLayout - Standalone Page Layout
 * =============================================================================
 * 
 * Layout for pages that only need the left icon panel (no conversation sidebar).
 * Used for standalone pages like Placeholder, Bookmarks, etc.
 * 
 * ## Architecture
 * 
 * This layout is a child of AppLayout, which provides:
 * - SidePanelGroup (shared resizable panel infrastructure)
 * - GlobalSourcesPanel (overlay and mobile bottom sheet)
 * 
 * ```
 * AppLayout (provides SidePanelGroup + GlobalSourcesPanel)
 * └── LeftPanelLayout (this file)
 *     ├── LeftPanel (icon sidebar)
 *     └── Outlet (page content - fills main panel from SidePanelGroup)
 * ```
 * 
 * ## Push Panel Support
 * 
 * Because this is inside AppLayout's SidePanelGroup, pages can use:
 * 
 * ```tsx
 * const { openPanel, closePanel } = useSourcesPanel();
 * openPanel('My Panel', <Content />, 'push');
 * ```
 * 
 * The panel will push the content aside (resizable), not open as overlay.
 * 
 * ## Note on Right Nav Panel
 * 
 * AppLayout automatically hides the right nav panel for routes like
 * /bookmarks, /placeholder based on path detection. No need to pass
 * hideNavPanel here.
 * 
 * @see AppLayout - Parent layout providing panel infrastructure
 * @see useSourcesPanel - Hook to open panels from child pages
 */
export default function LeftPanelLayout() {
  const { isAuthenticated } = useAuthContext();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-full w-full bg-presentation">
      <LeftPanel />
      {/* Content area - receives full width from SidePanelGroup's main panel */}
      <div className="flex h-full w-full flex-col overflow-hidden">
        <MobileHeader />
        <Outlet />
      </div>
    </div>
  );
}
