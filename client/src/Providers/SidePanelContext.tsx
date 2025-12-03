import React, { createContext, useContext, useMemo } from 'react';
import type { EModelEndpoint } from 'librechat-data-provider';
import { useChatContext } from './ChatContext';

interface SidePanelContextValue {
  endpoint?: EModelEndpoint | null;
}

const SidePanelContext = createContext<SidePanelContextValue | undefined>(undefined);

/**
 * SidePanelProvider - Provides side panel context with optional ChatContext dependency
 * 
 * This provider is used in AppLayout which wraps ALL authenticated routes,
 * not just chat routes where ChatContext.Provider exists. Therefore we must
 * make ChatContext optional to avoid errors on non-chat routes like:
 * - /bookmarks
 * - /agents
 * - /files
 * - /placeholder
 */
export function SidePanelProvider({ children }: { children: React.ReactNode }) {
  // ChatContext is optional - may not exist on non-chat routes (bookmarks, agents, etc.)
  const chatContext = useChatContext();
  const conversation = chatContext?.conversation;

  /** Context value only created when endpoint changes */
  const contextValue = useMemo<SidePanelContextValue>(
    () => ({
      endpoint: conversation?.endpoint,
    }),
    [conversation?.endpoint],
  );

  return <SidePanelContext.Provider value={contextValue}>{children}</SidePanelContext.Provider>;
}

export function useSidePanelContext() {
  const context = useContext(SidePanelContext);
  if (!context) {
    throw new Error('useSidePanelContext must be used within SidePanelProvider');
  }
  return context;
}
