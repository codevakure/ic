import React, { useCallback, useMemo } from 'react';
import { Monitor, Mail, Calendar, Users, FileText, Search, CheckSquare, MessageSquare } from 'lucide-react';
import type { UIResource } from 'ranger-data-provider';
import { useSourcesPanel } from '~/components/ui/SidePanel';
import { Watermark } from '~/components/ui/Watermark';
import { useLocalize } from '~/hooks';
import { MCPUIResourcePanel } from './MCPUIResourcePanel';

interface MCPUIResourceButtonProps {
  /** The UI resource to display */
  resource: UIResource;
  /** Optional conversation ID for context */
  conversationId?: string;
}

/**
 * Get icon component based on resource URI or name
 */
function getResourceIcon(resource: UIResource): React.ElementType {
  const uri = resource.uri?.toLowerCase() || '';
  const name = resource.name?.toLowerCase() || '';
  
  // Email/Outlook
  if (uri.includes('outlook') || uri.includes('email') || name.includes('email') || name.includes('inbox')) {
    return Mail;
  }
  
  // Calendar
  if (uri.includes('calendar') || name.includes('calendar') || name.includes('event')) {
    return Calendar;
  }
  
  // Teams
  if (uri.includes('teams') || name.includes('teams')) {
    return Users;
  }
  
  // SharePoint/OneDrive/Files
  if (uri.includes('sharepoint') || uri.includes('onedrive') || uri.includes('files') || 
      name.includes('files') || name.includes('sharepoint') || name.includes('onedrive')) {
    return FileText;
  }
  
  // Search
  if (uri.includes('search') || name.includes('search')) {
    return Search;
  }
  
  // Tasks/Todo
  if (uri.includes('tasks') || uri.includes('todo') || name.includes('tasks') || name.includes('todo')) {
    return CheckSquare;
  }
  
  // Messages/Compose
  if (uri.includes('message') || uri.includes('compose') || name.includes('message') || name.includes('compose') || name.includes('reply') || name.includes('draft')) {
    return MessageSquare;
  }
  
  // Default
  return Monitor;
}

/**
 * MCPUIResourceButton - A card-like button that appears in chat for MCP UI resources.
 * Similar to ArtifactButton, clicking it opens the MCP UI resource in the shared push side panel.
 */
export function MCPUIResourceButton({ resource, conversationId }: MCPUIResourceButtonProps) {
  const localize = useLocalize();
  const { openPanel, closePanel, isOpen, title } = useSourcesPanel();

  // Get resource name with smart fallback for display
  const resourceName = useMemo(() => {
    if (resource.name) return resource.name;
    
    // Extract from URI as fallback
    const uri = resource.uri || '';
    const parts = uri.replace(/^ui:\/\//, '').split('/');
    if (parts.length > 0 && parts[0]) {
      // Capitalize first letter and replace dashes/underscores with spaces
      const base = parts[0]
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      return base;
    }
    
    return localize('com_ui_ui_resources') || 'UI Resource';
  }, [resource, localize]);
  
  // Get appropriate icon
  const IconComponent = useMemo(() => getResourceIcon(resource), [resource]);
  
  // Use resourceId as unique identifier for panel state tracking
  // This ensures each UI resource card tracks its own panel state independently
  const uniquePanelTitle = `ui-resource-${resource.resourceId}`;
  // Display-friendly title for the panel header (without the ID)
  const displayTitle = 'UI Resource';
  
  // Check if THIS specific resource's panel is currently open
  const isThisPanelOpen = isOpen && title === uniquePanelTitle;

  const handleClick = useCallback(() => {
    if (isThisPanelOpen) {
      // Only close if THIS resource's panel is open (toggle behavior)
      closePanel();
      return;
    }

    // If a different panel is open or no panel is open, open this resource's panel
    // openPanel will automatically replace any existing panel content
    // Note: MCPUIResourcePanel gets ask() from useChatContext internally
    openPanel(
      uniquePanelTitle,
      <MCPUIResourcePanel resource={resource} conversationId={conversationId} />,
      'push',
      null,
      35,
      displayTitle,
    );
  }, [resource, conversationId, openPanel, closePanel, isThisPanelOpen, uniquePanelTitle]);

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
                <IconComponent className="h-8 w-8 text-text-secondary" />
              </div>

              <div className="flex-1 overflow-hidden text-left">
                <div className="truncate font-semibold text-text-primary">
                  {resourceName}
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

export default MCPUIResourceButton;
