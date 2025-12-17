import React, { useMemo, useCallback, useRef, useEffect } from 'react';
import { Monitor } from 'lucide-react';
import { useConversationUIResources } from '~/hooks/Messages/useConversationUIResources';
import { useMessagesConversation, useMessagesOperations } from '~/Providers';
import { useChatContext } from '~/Providers/ChatContext';
import { useSourcesPanel } from '~/components/ui/SidePanel';
import { Watermark } from '~/components/ui/Watermark';
import { UIResourceMultiPanel } from './UIResourceMultiPanel';
import { useLocalize } from '~/hooks';
import type { UIResource } from 'librechat-data-provider';

interface MCPUIResourceCarouselProps {
  node: {
    properties: {
      resourceIds?: string[];
    };
  };
}

/**
 * Component that renders multiple MCP UI resources as a single combined card.
 * Clicking the card opens a panel with a list view to switch between resources.
 * Works in both main app and share view.
 */
export function MCPUIResourceCarousel(props: MCPUIResourceCarouselProps) {
  const localize = useLocalize();
  const { conversation } = useMessagesConversation();
  const { ask } = useMessagesOperations();
  const { isSubmitting } = useChatContext();
  const { openPanel, closePanel, isOpen, title } = useSourcesPanel();
  
  // Track if this component instance has auto-opened (per mount)
  const hasAutoOpenedRef = useRef(false);
  // Track if isSubmitting was true when we first mounted
  const wasSubmittingOnMountRef = useRef(isSubmitting);

  const conversationResourceMap = useConversationUIResources(
    conversation?.conversationId ?? undefined,
  );

  const uiResources = useMemo(() => {
    const { resourceIds = [] } = props.node.properties;
    return resourceIds.map((id) => conversationResourceMap.get(id)).filter(Boolean) as UIResource[];
  }, [props.node.properties, conversationResourceMap]);

  // Generate a unique panel title for this set of resources
  const resourceIds = props.node.properties.resourceIds || [];
  const uniquePanelTitle = `ui-resources-${resourceIds.join('-').slice(0, 20)}`;
  // Display-friendly title for the panel header
  const displayTitle = uiResources.length === 1 ? 'UI Resource' : 'UI Resources';
  
  // Check if THIS panel is currently open
  const isThisPanelOpen = isOpen && title === uniquePanelTitle;
  
  // Get combined display name for the card
  const cardTitle = useMemo(() => {
    if (uiResources.length === 0) return localize('com_ui_ui_resources') || 'UI Resources';
    if (uiResources.length === 1) return uiResources[0].name || localize('com_ui_ui_resources') || 'UI Resource';
    
    // Try to find a common prefix/category
    const firstResource = uiResources[0];
    if (firstResource?.name) {
      // Check if all resources share a common type indicator
      const types = uiResources.map(r => {
        const name = r.name || '';
        if (name.includes('Email') || name.includes('Inbox')) return 'Email';
        if (name.includes('Teams')) return 'Teams';
        if (name.includes('Calendar')) return 'Calendar';
        if (name.includes('Files') || name.includes('SharePoint')) return 'Files';
        return null;
      }).filter(Boolean);
      
      const uniqueTypes = [...new Set(types)];
      if (uniqueTypes.length === 1 && uniqueTypes[0]) {
        return `${uniqueTypes[0]} (${uiResources.length})`;
      }
    }
    
    return `${localize('com_ui_ui_resources') || 'UI Resources'} (${uiResources.length})`;
  }, [uiResources, localize]);
  
  const handleClick = useCallback(() => {
    if (isThisPanelOpen) {
      closePanel();
      return;
    }

    openPanel(
      uniquePanelTitle,
      <UIResourceMultiPanel
        resources={uiResources}
        conversationId={conversation?.conversationId}
        ask={ask}
      />,
      'push',
      null,
      uiResources.length > 1 ? 45 : 33, // Wider panel when multiple resources
      displayTitle,
    );
  }, [uiResources, conversation?.conversationId, openPanel, closePanel, isThisPanelOpen, uniquePanelTitle, displayTitle, ask]);

  // Auto-open when resources are first generated
  useEffect(() => {
    if (uiResources.length === 0) return;
    if (hasAutoOpenedRef.current) return;
    if (!wasSubmittingOnMountRef.current) return;

    hasAutoOpenedRef.current = true;

    openPanel(
      uniquePanelTitle,
      <UIResourceMultiPanel
        resources={uiResources}
        conversationId={conversation?.conversationId}
        ask={ask}
      />,
      'push',
      null,
      uiResources.length > 1 ? 45 : 33,
      displayTitle,
    );
  }, [uiResources, openPanel, conversation?.conversationId, uniquePanelTitle, displayTitle, ask]);

  if (uiResources.length === 0) {
    return null;
  }

  // Render as a single combined card
  return (
    <div className="group relative my-4 max-w-xs rounded-xl text-sm text-text-primary">
      <button
        type="button"
        onClick={handleClick}
        className="relative w-full overflow-hidden rounded-xl border border-border-medium bg-transparent transition-all duration-300 hover:shadow-lg hover:shadow-black/10 dark:hover:shadow-white/10"
      >
        <div className="relative w-full p-4 pr-20">
          <div className="relative flex flex-row items-center justify-between gap-4">
            {/* Left section with icon and content */}
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex-shrink-0 relative">
                <Monitor className="h-8 w-8 text-text-secondary" />
                {/* Badge for multiple resources */}
                {uiResources.length > 1 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-purple text-[10px] font-bold text-white">
                    {uiResources.length}
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-hidden text-left">
                <div className="truncate font-semibold text-text-primary">
                  {cardTitle}
                </div>
                <div className="truncate text-sm text-text-secondary">
                  {isThisPanelOpen
                    ? localize('com_ui_click_to_close')
                    : localize('com_ui_artifact_click')}
                </div>
              </div>
            </div>

            {/* Watermark logo on the right */}
            <div className="absolute -right-16 top-[70%] -translate-y-[30%]">
              <Watermark
                width={80}
                height={80}
                className="opacity-50 transition-all duration-300 group-hover:scale-110 group-hover:opacity-80"
              />
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}

