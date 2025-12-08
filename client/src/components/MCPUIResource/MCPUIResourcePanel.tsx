import React from 'react';
import { UIResourceRenderer } from '@mcp-ui/client';
import type { UIResource } from 'librechat-data-provider';
import type { TAskFunction } from '~/common';
import { handleUIAction } from '~/utils';
import { useLocalize } from '~/hooks';

interface MCPUIResourcePanelProps {
  /** The UI resource to render */
  resource: UIResource;
  /** Optional conversation ID for context */
  conversationId?: string;
  /** The ask function to submit messages - passed from parent that has access to context */
  ask?: TAskFunction;
}

/**
 * MCPUIResourcePanel - Renders the MCP UI resource content inside the push side panel.
 * This is the full view of the MCP UI resource with proper sizing for the panel.
 * 
 * Note: Uses useChatContext directly instead of useMessagesOperations because
 * the side panel is rendered outside MessagesViewProvider but inside ChatContext.
 */
export function MCPUIResourcePanel({ resource, ask }: MCPUIResourcePanelProps) {
  const localize = useLocalize();

  // Handle UI actions - only if ask is available (passed from parent component)
  const handleAction = async (result: unknown) => {
    if (ask) {
      await handleUIAction(result, ask);
    } else {
      console.warn('MCP UI action triggered but ask() is not available - was not passed from parent');
    }
  };

  if (!resource) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-text-secondary">
        {localize('com_ui_ui_resource_not_found', { 0: '' })}
      </div>
    );
  }

  try {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden">
        {/* Container that fills the panel - UIResourceRenderer will render iframe inside */}
        <div className="h-full w-full [&>div]:h-full [&>div]:w-full [&_iframe]:h-full [&_iframe]:w-full [&_iframe]:min-h-[400px] [&_iframe]:border-0">
          <UIResourceRenderer
            resource={resource}
            onUIAction={handleAction}
            htmlProps={{
              sandboxPermissions: 'allow-popups allow-popups-to-escape-sandbox',
            }}
          />
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error rendering UI resource in panel:', error);
    return (
      <div className="flex h-full items-center justify-center p-4">
        <span className="inline-flex items-center rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-600">
          {localize('com_ui_ui_resource_error', { 0: resource.name })}
        </span>
      </div>
    );
  }
}

export default MCPUIResourcePanel;
