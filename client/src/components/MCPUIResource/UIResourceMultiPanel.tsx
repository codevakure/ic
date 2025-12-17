import React, { useState, useCallback, useMemo } from 'react';
import { ChevronLeft, LayoutList } from 'lucide-react';
import { UIResourceRenderer } from '@mcp-ui/client';
import type { UIResource } from 'librechat-data-provider';
import type { TAskFunction } from '~/common';
import { handleUIAction } from '~/utils';
import { useLocalize } from '~/hooks';
import { UIResourceListPanel } from './UIResourceListPanel';
import { cn } from '~/utils';

interface UIResourceMultiPanelProps {
  /** Array of UI resources to display */
  resources: UIResource[];
  /** Optional conversation ID for context */
  conversationId?: string;
  /** The ask function to submit messages */
  ask?: TAskFunction;
  /** Initial resource to display (by resourceId) */
  initialResourceId?: string;
}

/**
 * UIResourceMultiPanel - A combined panel that shows a list of UI resources
 * with the ability to switch between them, similar to Traces panel.
 * 
 * When there are multiple resources, shows a toggleable list sidebar.
 * When there's only one resource, shows it directly.
 */
export function UIResourceMultiPanel({
  resources,
  conversationId,
  ask,
  initialResourceId,
}: UIResourceMultiPanelProps) {
  const localize = useLocalize();
  
  // Track which resource is currently selected
  const [selectedResourceId, setSelectedResourceId] = useState<string | undefined>(
    initialResourceId || resources[0]?.resourceId
  );
  
  // Track whether the list sidebar is shown (only relevant when multiple resources)
  const [showList, setShowList] = useState(resources.length > 1);
  
  // Get the currently selected resource
  const selectedResource = useMemo(() => {
    return resources.find(r => r.resourceId === selectedResourceId) || resources[0];
  }, [resources, selectedResourceId]);
  
  // Handle UI actions
  const handleAction = useCallback(async (result: unknown) => {
    if (ask) {
      await handleUIAction(result, ask);
    } else {
      console.warn('MCP UI action triggered but ask() is not available');
    }
  }, [ask]);
  
  // Handle resource selection
  const handleSelect = useCallback((resource: UIResource) => {
    setSelectedResourceId(resource.resourceId);
    // On mobile or small panels, hide the list after selection
    if (window.innerWidth < 640) {
      setShowList(false);
    }
  }, []);
  
  // Toggle list visibility
  const toggleList = useCallback(() => {
    setShowList(prev => !prev);
  }, []);
  
  // Single resource - just render it directly
  if (resources.length <= 1) {
    if (!selectedResource) {
      return (
        <div className="flex h-full items-center justify-center p-4 text-text-secondary">
          {localize('com_ui_ui_resource_not_found', { 0: '' })}
        </div>
      );
    }
    
    return (
      <div className="flex h-full w-full flex-col overflow-hidden">
        <div className="h-full w-full [&>div]:h-full [&>div]:w-full [&_iframe]:h-full [&_iframe]:w-full [&_iframe]:min-h-[400px] [&_iframe]:border-0">
          <UIResourceRenderer
            resource={selectedResource}
            onUIAction={handleAction}
            htmlProps={{
              sandboxPermissions: 'allow-popups allow-popups-to-escape-sandbox',
            }}
          />
        </div>
      </div>
    );
  }
  
  // Multiple resources - show list + content layout
  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Toggle button for list (when collapsed) */}
      {!showList && (
        <div className="flex items-center gap-2 border-b border-border-light px-3 py-2 bg-surface-secondary">
          <button
            type="button"
            onClick={toggleList}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
          >
            <LayoutList className="h-4 w-4" />
            <span>Show All ({resources.length})</span>
          </button>
          {selectedResource && (
            <span className="text-sm text-text-primary font-medium truncate">
              {selectedResource.name || 'UI Resource'}
            </span>
          )}
        </div>
      )}
      
      {/* Main content area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* List sidebar (when shown) */}
        {showList && (
          <div className={cn(
            'flex flex-col border-r border-border-light bg-surface-primary',
            'w-64 flex-shrink-0 overflow-y-auto'
          )}>
            {/* Collapse button */}
            <div className="flex items-center justify-between border-b border-border-light px-3 py-2">
              <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                Resources
              </span>
              <button
                type="button"
                onClick={toggleList}
                className="rounded p-1 text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
                title="Hide list"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
            
            {/* Resource list */}
            <UIResourceListPanel
              resources={resources}
              selectedResourceId={selectedResourceId}
              onSelect={handleSelect}
            />
          </div>
        )}
        
        {/* Content area */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {selectedResource ? (
            <div className="h-full w-full [&>div]:h-full [&>div]:w-full [&_iframe]:h-full [&_iframe]:w-full [&_iframe]:min-h-[400px] [&_iframe]:border-0">
              <UIResourceRenderer
                resource={selectedResource}
                onUIAction={handleAction}
                htmlProps={{
                  sandboxPermissions: 'allow-popups allow-popups-to-escape-sandbox',
                }}
              />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center p-4 text-text-secondary">
              Select a resource to view
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default UIResourceMultiPanel;
