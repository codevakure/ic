import React, { useCallback } from 'react';
import { Monitor } from 'lucide-react';
import type { UIResource } from 'ranger-data-provider';
import type { TAskFunction } from '~/common';
import { useSourcesPanel } from '~/components/ui/SidePanel';
import { Watermark } from '~/components/ui/Watermark';
import { useLocalize } from '~/hooks';
import { MCPUIResourcePanel } from './MCPUIResourcePanel';

interface MCPUIResourceButtonProps {
  /** The UI resource to display */
  resource: UIResource;
  /** Optional conversation ID for context */
  conversationId?: string;
  /** The ask function to submit messages - passed to panel */
  ask?: TAskFunction;
}

/**
 * MCPUIResourceButton - A card-like button that appears in chat for MCP UI resources.
 * Similar to ArtifactButton, clicking it opens the MCP UI resource in the shared push side panel.
 */
export function MCPUIResourceButton({ resource, conversationId, ask }: MCPUIResourceButtonProps) {
  const localize = useLocalize();
  const { openPanel, closePanel, isOpen, title } = useSourcesPanel();

  // Get resource name with fallback - no explicit type to allow localize inference
  const resourceName = resource.name || localize('com_ui_ui_resources') || 'UI Resources';

  // Check if this resource's panel is currently open
  const isPanelOpen = isOpen && title === resource.name;

  const handleClick = useCallback(() => {
    if (isPanelOpen) {
      // Close if already open
      closePanel();
      return;
    }

    // Open the MCP UI resource in the push side panel with 30% width
    openPanel(
      String(resourceName),
      <MCPUIResourcePanel resource={resource} conversationId={conversationId} ask={ask} />,
      'push',
      null,
      33,
    );
  }, [resource, conversationId, openPanel, closePanel, isPanelOpen, resourceName, ask]);

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
              <div className="flex-shrink-0">
                <Monitor className="h-8 w-8 text-text-secondary" />
              </div>

              <div className="flex-1 overflow-hidden text-left">
                <div className="truncate font-semibold text-text-primary">
                  {String(resourceName)}
                </div>
                <div className="truncate text-sm text-text-secondary">
                  {isPanelOpen
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

export default MCPUIResourceButton;
