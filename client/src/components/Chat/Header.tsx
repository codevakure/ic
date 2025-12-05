import { useMemo } from 'react';
import { useMediaQuery } from '@librechat/client';
import { useOutletContext } from 'react-router-dom';
import { getConfigDefaults, PermissionTypes, Permissions } from 'librechat-data-provider';
import type { ContextType } from '~/common';
import ModelSelector from './Menus/Endpoints/ModelSelector';
import { PresetsMenu, HeaderNewChat, OpenSidebar, FilesButton } from './Menus';
// TODO: [Work/Web Toggle] - Uncomment when ready to implement Work/Web mode switching
// import WorkWebToggle from './WorkWebToggle';
import { useGetStartupConfig } from '~/data-provider';
import ExportAndShareMenu from './ExportAndShareMenu';
import BookmarkMenu from './Menus/BookmarkMenu';
import { TemporaryChat } from './TemporaryChat';
import AddMultiConvo from './AddMultiConvo';
import { useHasAccess } from '~/hooks';
import { AnimatePresence, motion } from 'framer-motion';

const defaultInterface = getConfigDefaults().interface;

export default function Header() {
  const { data: startupConfig } = useGetStartupConfig();
  const { navVisible, setNavVisible } = useOutletContext<ContextType>();

  const interfaceConfig = useMemo(
    () => startupConfig?.interface ?? defaultInterface,
    [startupConfig],
  );

  // Check if Intent Analyzer model routing is enabled (Auto Mode)
  const isAutoModeEnabled = useMemo(() => {
    const intentAnalyzer = startupConfig?.intentAnalyzer;
    // Auto mode is enabled when modelRouting is true AND at least one endpoint is enabled
    const hasEnabledEndpoint = intentAnalyzer?.endpoints && 
      Object.values(intentAnalyzer.endpoints).some(ep => (ep as { enabled?: boolean })?.enabled === true);
    return intentAnalyzer?.modelRouting === true && hasEnabledEndpoint;
  }, [startupConfig]);

  const hasAccessToBookmarks = useHasAccess({
    permissionType: PermissionTypes.BOOKMARKS,
    permission: Permissions.USE,
  });

  const hasAccessToMultiConvo = useHasAccess({
    permissionType: PermissionTypes.MULTI_CONVO,
    permission: Permissions.USE,
  });

  const isSmallScreen = useMediaQuery('(max-width: 768px)');

  return (
    <div className="sticky top-0 z-10 flex h-12 w-full items-center justify-between bg-header-primary px-1 sm:px-2 py-1 font-semibold text-text-primary dark:bg-gray-800">
      <div className="hide-scrollbar flex w-full items-center justify-between gap-1 overflow-x-auto">
        <div className="mx-1 flex items-center">
          <AnimatePresence initial={false}>
            {!navVisible && (
              <motion.div
                className={`flex items-center gap-1`}
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 'auto', opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                key="header-buttons"
              >
                <OpenSidebar setNavVisible={setNavVisible} className="max-md:hidden" />
                <HeaderNewChat />
              </motion.div>
            )}
          </AnimatePresence>

          <div className={navVisible ? 'flex items-center gap-1' : 'ml-2 flex items-center gap-1'}>
            {/* When LLM Router is enabled, don't show model selector or auto indicator - routing is automatic */}
            {!isAutoModeEnabled && (
              <ModelSelector startupConfig={startupConfig} />
            )}
            {!isAutoModeEnabled && interfaceConfig.presets === true && interfaceConfig.modelSelect && <PresetsMenu />}
            {hasAccessToBookmarks === true && <BookmarkMenu />}
            {hasAccessToMultiConvo === true && <AddMultiConvo />}
            {isSmallScreen && (
              <>
                <FilesButton />
                <ExportAndShareMenu
                  isSharedButtonEnabled={startupConfig?.sharedLinksEnabled ?? false}
                />
                <TemporaryChat />
              </>
            )}
          </div>
        </div>

        {/*
          * ============================================================================
          * TODO: [Work/Web Toggle] - FUTURE FEATURE
          * ============================================================================
          * This toggle is designed to switch between "Web" mode (general web search)
          * and "Work" mode (Microsoft 365/enterprise integrations like Outlook, SharePoint).
          * 
          * When implementing:
          * 1. Uncomment the import: import WorkWebToggle from './WorkWebToggle';
          * 2. Uncomment the JSX below
          * 3. Wire up the searchMode state in useMCPServerManager.ts to filter
          *    ms365-mcp based on the toggle state
          * 4. Filter ephemeralAgent.mcp in useChatFunctions.ts based on searchMode
          * 
          * Component location: ./WorkWebToggle.tsx
          * State atom: store/misc.ts -> searchMode (persisted to localStorage)
          * ============================================================================
          */}
        {/* Work/Web Toggle - Positioned absolutely, centered horizontally
        <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center">
          <div className="pointer-events-auto">
            <WorkWebToggle />
          </div>
        </div>
        */}

        {!isSmallScreen && (
          <div className="flex items-center gap-1">
            <FilesButton />
            <ExportAndShareMenu
              isSharedButtonEnabled={startupConfig?.sharedLinksEnabled ?? false}
            />
            <TemporaryChat />
          </div>
        )}
      </div>
      {/* Empty div for spacing */}
      <div />
    </div>
  );
}
