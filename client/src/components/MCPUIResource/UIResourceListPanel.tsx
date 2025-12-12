import React from 'react';
import { Monitor, ChevronRight, Mail, Calendar, Users, FileText, Search, CheckSquare, MessageSquare } from 'lucide-react';
import type { UIResource } from 'ranger-data-provider';
import { cn } from '~/utils';

interface UIResourceListPanelProps {
  /** Array of UI resources to display in the list */
  resources: UIResource[];
  /** Currently selected resource ID */
  selectedResourceId?: string;
  /** Callback when a resource is selected */
  onSelect: (resource: UIResource) => void;
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
  
  // Messages
  if (uri.includes('message') || name.includes('message') || name.includes('compose')) {
    return MessageSquare;
  }
  
  // Default
  return Monitor;
}

/**
 * Get a display-friendly label from resource name or URI
 */
function getResourceLabel(resource: UIResource): string {
  if (resource.name) {
    return resource.name;
  }
  
  // Extract from URI as fallback
  const uri = resource.uri || '';
  const parts = uri.replace(/^ui:\/\//, '').split('/');
  if (parts.length > 0) {
    // Capitalize first letter and replace dashes/underscores with spaces
    return parts[0]
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  
  return 'UI Resource';
}

/**
 * UIResourceListPanel - A list view for switching between multiple MCP UI resources.
 * Similar to a folder tree view, allows users to select which UI resource to display.
 */
export function UIResourceListPanel({
  resources,
  selectedResourceId,
  onSelect,
}: UIResourceListPanelProps) {
  if (resources.length === 0) {
    return (
      <div className="flex items-center justify-center p-4 text-sm text-text-secondary">
        No UI resources available
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="border-b border-border-light px-4 py-3">
        <h3 className="text-sm font-semibold text-text-primary">
          UI Resources ({resources.length})
        </h3>
        <p className="mt-0.5 text-xs text-text-secondary">
          Select a resource to view
        </p>
      </div>
      
      {/* Resource list */}
      <div className="flex flex-col py-2">
        {resources.map((resource) => {
          const IconComponent = getResourceIcon(resource);
          const label = getResourceLabel(resource);
          const isSelected = resource.resourceId === selectedResourceId;
          
          return (
            <button
              key={resource.resourceId}
              type="button"
              onClick={() => onSelect(resource)}
              className={cn(
                'flex items-center gap-3 px-4 py-3 text-left transition-all duration-150',
                'hover:bg-surface-hover',
                isSelected && 'bg-surface-secondary border-l-2 border-l-brand-purple',
                !isSelected && 'border-l-2 border-l-transparent'
              )}
            >
              {/* Icon */}
              <div className={cn(
                'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg',
                isSelected ? 'bg-brand-purple/10' : 'bg-surface-tertiary'
              )}>
                <IconComponent 
                  className={cn(
                    'h-4 w-4',
                    isSelected ? 'text-brand-purple' : 'text-text-secondary'
                  )} 
                />
              </div>
              
              {/* Label */}
              <div className="flex-1 min-w-0">
                <span className={cn(
                  'block truncate text-sm',
                  isSelected ? 'font-medium text-text-primary' : 'text-text-primary'
                )}>
                  {label}
                </span>
              </div>
              
              {/* Selection indicator */}
              <ChevronRight 
                className={cn(
                  'h-4 w-4 flex-shrink-0 transition-transform',
                  isSelected ? 'text-brand-purple' : 'text-text-tertiary',
                  isSelected && 'rotate-90'
                )} 
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default UIResourceListPanel;
