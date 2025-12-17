import React from 'react';
import { UIResourceRenderer } from '@mcp-ui/client';
import type { UIResource } from 'librechat-data-provider';
import { handleUIAction } from '~/utils';
import { getMCPAskRef } from '~/utils/mcpAskRef';
import { useLocalize } from '~/hooks';

interface MCPUIResourcePanelProps {
  /** The UI resource to render */
  resource: UIResource;
  /** Optional conversation ID for context */
  conversationId?: string;
}

/**
 * MCPUIResourcePanel - Renders the MCP UI resource content inside the push side panel.
 * This is the full view of the MCP UI resource with proper sizing for the panel.
 * 
 * IMPORTANT: This component is rendered OUTSIDE ChatContext.Provider (in the side panel).
 * To get the ask function, we use a global ref that's set by MCPUIResource component
 * which IS inside ChatContext.
 */
export function MCPUIResourcePanel({ resource }: MCPUIResourcePanelProps) {
  const localize = useLocalize();

  // Handle UI actions - get ask from global ref since we're outside ChatContext
  const handleAction = async (result: unknown) => {
    const ask = getMCPAskRef();
    console.log('[MCPUIResourcePanel] handleAction called - ask available:', !!ask, 'result:', result);
    if (ask) {
      await handleUIAction(result, ask);
    } else {
      console.error('[MCPUIResourcePanel] ask() NOT available! Make sure MCPUIResource is mounted.');
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
