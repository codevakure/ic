import React, { useEffect, useRef } from 'react';
import { useConversationUIResources } from '~/hooks/Messages/useConversationUIResources';
import { useMessagesConversation, useMessagesOperations } from '~/Providers';
import { useChatContext } from '~/Providers/ChatContext';
import { useSourcesPanel } from '~/components/ui/SidePanel';
import { setMCPAskRef } from '~/utils/mcpAskRef';
import { MCPUIResourceButton } from './MCPUIResourceButton';
import { MCPUIResourcePanel } from './MCPUIResourcePanel';
import { useLocalize } from '~/hooks';

interface MCPUIResourceProps {
  node: {
    properties: {
      resourceId: string;
    };
  };
}

/**
 * Component that renders an MCP UI resource as a card button in the chat.
 * Auto-opens in the side panel when first generated during an active conversation.
 * Does NOT auto-open when switching between conversations (to avoid flashing).
 * Clicking the card toggles the side panel visibility.
 * 
 * Similar to Artifacts, but for MCP UI resources.
 */
export function MCPUIResource(props: MCPUIResourceProps) {
  const { resourceId } = props.node.properties;
  const localize = useLocalize();
  const { conversation } = useMessagesConversation();
  const { ask } = useMessagesOperations();
  const { isSubmitting } = useChatContext();
  const { openPanel } = useSourcesPanel();
  
  // Update the global ask ref so MCPUIResourcePanel can access it
  // This component is inside ChatContext, so ask is available here
  useEffect(() => {
    if (ask) {
      setMCPAskRef(ask);
    }
  }, [ask]);
  
  // Track if this component instance has auto-opened (per mount)
  const hasAutoOpenedRef = useRef(false);
  // Track if isSubmitting was true when we first mounted
  const wasSubmittingOnMountRef = useRef(isSubmitting);

  const conversationResourceMap = useConversationUIResources(
    conversation?.conversationId ?? undefined,
  );

  const uiResource = conversationResourceMap.get(resourceId ?? '');
  
  // Use resourceId as unique identifier for panel state tracking
  const uniquePanelTitle = `ui-resource-${resourceId}`;
  // Display-friendly title for the panel header (without the ID)
  const displayTitle = 'UI Resource';

  // Auto-open the side panel ONLY when:
  // 1. The resource data is available
  // 2. We haven't already auto-opened this instance
  // 3. We were submitting when this component mounted (meaning this is a fresh generation, not loading existing conversation)
  useEffect(() => {
    if (!uiResource || !resourceId) {
      return;
    }

    if (hasAutoOpenedRef.current) {
      return;
    }

    // Only auto-open if we were submitting when mounted - this means the resource
    // is being generated now, not loaded from an existing conversation
    if (!wasSubmittingOnMountRef.current) {
      return;
    }

    hasAutoOpenedRef.current = true;

    openPanel(
      uniquePanelTitle,
      <MCPUIResourcePanel 
        resource={uiResource} 
        conversationId={conversation?.conversationId ?? undefined}
      />,
      'push',
      null,
      35,
      displayTitle,
    );
  }, [uiResource, resourceId, openPanel, conversation?.conversationId, uniquePanelTitle, displayTitle]);

  if (!uiResource) {
    return (
      <span className="inline-flex items-center rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
        {localize('com_ui_ui_resource_not_found', {
          0: resourceId ?? '',
        })}
      </span>
    );
  }

  // Render the card button - clicking it opens/closes the side panel
  return (
    <MCPUIResourceButton 
      resource={uiResource} 
      conversationId={conversation?.conversationId ?? undefined}
    />
  );
}
