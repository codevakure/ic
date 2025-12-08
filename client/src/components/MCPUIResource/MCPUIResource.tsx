import React, { useEffect, useRef } from 'react';
import { useSourcesPanel } from '~/components/ui/SidePanel';
import { useConversationUIResources } from '~/hooks/Messages/useConversationUIResources';
import { useMessagesConversation, useMessagesOperations } from '~/Providers';
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
 * When the resource is first detected, it automatically opens in the push side panel.
 * Clicking the card toggles the side panel visibility.
 * 
 * Similar to Artifacts, but for MCP UI resources.
 */
export function MCPUIResource(props: MCPUIResourceProps) {
  const { resourceId } = props.node.properties;
  const localize = useLocalize();
  const { conversation } = useMessagesConversation();
  const { ask } = useMessagesOperations();
  const { openPanel } = useSourcesPanel();
  
  // Track if this component instance has auto-opened (per mount)
  const hasAutoOpenedRef = useRef(false);

  const conversationResourceMap = useConversationUIResources(
    conversation?.conversationId ?? undefined,
  );

  const uiResource = conversationResourceMap.get(resourceId ?? '');
  
  // Get resource name with fallback
  const resourceName = uiResource?.name || localize('com_ui_ui_resources') || 'UI Resources';

  // Auto-open the side panel when the UI resource data becomes available
  // This component only mounts when a UI resource marker is detected in markdown
  // So we just need to open once when uiResource data is ready
  useEffect(() => {
    // Wait for resource data to be available
    if (!uiResource || !resourceId) {
      return;
    }

    // Only auto-open once per component instance
    if (hasAutoOpenedRef.current) {
      return;
    }

    hasAutoOpenedRef.current = true;

    // Auto-open the panel
    openPanel(
      String(resourceName),
      <MCPUIResourcePanel 
        resource={uiResource} 
        conversationId={conversation?.conversationId ?? undefined}
        ask={ask}
      />,
      'push',
      null,
      40,
    );
  }, [uiResource, resourceId, openPanel, conversation?.conversationId, resourceName, ask]);

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
      ask={ask}
    />
  );
}
