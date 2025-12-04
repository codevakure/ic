import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import type { ContextType } from '~/common';
import { useSearchEnabled, useAuthContext } from '~/hooks';
import { useUserTermsQuery, useGetStartupConfig } from '~/data-provider';
import { TermsAndConditionsModal } from '~/components/ui';
import { LeftPanel } from '~/components/LeftPanel';
import { Nav, MobileHeader } from '~/components/Nav';
import { useHealthCheck } from '~/data-provider';
import { Banner } from '~/components/Banners';

/**
 * =============================================================================
 * Root - Chat Layout Component
 * =============================================================================
 * 
 * This is the main authenticated chat layout that provides:
 * - Left icon panel (LeftPanel)
 * - Conversation sidebar (Nav)
 * - Mobile navigation (MobileNav)
 * - Context providers for assistants, agents, files, prompt groups
 * - Terms and conditions modal
 * - Banner support
 * 
 * ## Architecture
 * 
 * Root is a child of AppLayout, which provides shared panel infrastructure:
 * 
 * ```
 * AppLayout (provides SidePanelGroup + GlobalSourcesPanel)
 * └── Root (this file - ChatLayout)
 *     ├── Context Providers (SetConvo, FileMap, AssistantsMap, AgentsMap, PromptGroups)
 *     ├── Banner
 *     ├── LeftPanel (icon sidebar)
 *     ├── Nav (conversation sidebar - collapsible)
 *     ├── MobileNav
 *     └── Outlet → ChatRoute, Search, FilesPage, ConversationsPage, AgentsPage
 * ```
 * 
 * ## Routes Under Root
 * 
 * - `/c/:conversationId` - Chat view
 * - `/search` - Search page
 * - `/files` - Files page
 * - `/conversations` - Conversation history
 * - `/agents` - Agent marketplace
 * 
 * ## Using Panels from Chat Routes
 * 
 * All routes under Root can use the shared panel infrastructure:
 * 
 * ```tsx
 * import { useSourcesPanel } from '~/components/ui/SidePanel';
 * 
 * function MyChatComponent() {
 *   const { openPanel, closePanel } = useSourcesPanel();
 *   
 *   // Push mode - panel opens beside chat, resizable
 *   openPanel('Sources', <SourcesContent />, 'push');
 *   
 *   // Overlay mode - panel slides over content
 *   openPanel('Quick View', <Content />, 'overlay');
 * }
 * ```
 * 
 * @see AppLayout - Parent layout providing panel infrastructure
 * @see LeftPanel - Icon sidebar component
 * @see Nav - Conversation sidebar component
 */
export default function Root() {
  const [showTerms, setShowTerms] = useState(false);
  const [bannerHeight, setBannerHeight] = useState(0);
  const [navVisible, setNavVisible] = useState(() => {
    const savedNavVisible = localStorage.getItem('navVisible');
    return savedNavVisible !== null ? JSON.parse(savedNavVisible) : true;
  });

  const { isAuthenticated, logout } = useAuthContext();

  // Global health check - runs once per authenticated session
  useHealthCheck(isAuthenticated);

  const { data: config } = useGetStartupConfig();
  const { data: termsData } = useUserTermsQuery({
    enabled: isAuthenticated && config?.interface?.termsOfService?.modalAcceptance === true,
  });

  useSearchEnabled(isAuthenticated);

  useEffect(() => {
    if (termsData) {
      setShowTerms(!termsData.termsAccepted);
    }
  }, [termsData]);

  const handleAcceptTerms = () => {
    setShowTerms(false);
  };

  const handleDeclineTerms = () => {
    setShowTerms(false);
    logout('/login?redirect=false');
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <Banner onHeightChange={setBannerHeight} />
      {/* 
        Height calculation: Banner is positioned at top of Root's content area.
        Root is rendered inside AppLayout's SidePanelGroup, which already handles
        the outer layout. We just need to subtract banner height from full height.
      */}
      <div className="flex h-full w-full" style={bannerHeight > 0 ? { height: `calc(100% - ${bannerHeight}px)` } : undefined}>
        <div className="relative z-0 flex h-full w-full overflow-hidden">
          <LeftPanel />
          <Nav navVisible={navVisible} setNavVisible={setNavVisible} />
          <div className="relative flex h-full max-w-full flex-1 flex-col overflow-hidden">
            <MobileHeader showMenu onMenuClick={() => setNavVisible(!navVisible)} />
            <Outlet context={{ navVisible, setNavVisible } satisfies ContextType} />
          </div>
        </div>
      </div>
      {config?.interface?.termsOfService?.modalAcceptance === true && (
        <TermsAndConditionsModal
          open={showTerms}
          onOpenChange={setShowTerms}
          onAccept={handleAcceptTerms}
          onDecline={handleDeclineTerms}
          title={config.interface.termsOfService.modalTitle}
          modalContent={config.interface.termsOfService.modalContent}
        />
      )}
    </>
  );
}
