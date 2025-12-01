import React, { memo, useCallback } from 'react';
import { MultiSelect, MCPIcon, Microsoft365Icon } from '@librechat/client';
import MCPServerStatusIcon from '~/components/MCP/MCPServerStatusIcon';
import MCPConfigDialog from '~/components/MCP/MCPConfigDialog';
import { useBadgeRowContext } from '~/Providers';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Microsoft365Icon,
};

function MCPSelectContent() {
  const { conversationId, mcpServerManager } = useBadgeRowContext();
  const {
    localize,
    isPinned,
    mcpValues,
    isInitializing,
    placeholderText,
    configuredServers,
    serverTitles,
    serverIcons,
    batchToggleServers,
    getConfigDialogProps,
    getServerStatusIconProps,
  } = mcpServerManager;

  // Get icon for selected servers (use first selected server's icon)
  const selectedIcon = mcpValues?.[0] && serverIcons[mcpValues[0]]
    ? iconMap[serverIcons[mcpValues[0]] as string] || MCPIcon
    : MCPIcon;

  const renderSelectedValues = useCallback(
    (values: string[], placeholder?: string) => {
      if (values.length === 0) {
        return placeholder || localize('com_ui_select') + '...';
      }
      if (values.length === 1) {
        return serverTitles[values[0]] || values[0];
      }
      return localize('com_ui_x_selected', { 0: values.length });
    },
    [localize, serverTitles],
  );

  const renderItemContent = useCallback(
    (serverName: string, defaultContent: React.ReactNode, isSelected: boolean) => {
      const statusIconProps = getServerStatusIconProps(serverName);
      const isServerInitializing = isInitializing(serverName);
      const displayTitle = serverTitles[serverName] || serverName;

      // Replace the server name with the display title in the default content
      const customContent = React.isValidElement(defaultContent) ? (
        <>
          {React.Children.map(defaultContent.props.children, (child) => {
            if (React.isValidElement(child) && child.type === 'span') {
              const props = child.props as { className?: string };
              if (props.className?.includes('truncate')) {
                return <span className="truncate">{displayTitle}</span>;
              }
            }
            return child;
          })}
        </>
      ) : defaultContent;

      /**
       Common wrapper for the main content (check mark + text).
       Ensures Check & Text are adjacent and the group takes available space.
        */
      const mainContentWrapper = (
        <button
          type="button"
          className={`flex flex-grow items-center rounded bg-transparent p-0 text-left transition-colors focus:outline-none ${
            isServerInitializing ? 'opacity-50' : ''
          }`}
          tabIndex={0}
          disabled={isServerInitializing}
        >
          {customContent}
        </button>
      );

      const statusIcon = statusIconProps && <MCPServerStatusIcon {...statusIconProps} />;

      if (statusIcon) {
        return (
          <div className="flex w-full items-center justify-between">
            {mainContentWrapper}
            <div className="ml-2 flex items-center">{statusIcon}</div>
          </div>
        );
      }

      return mainContentWrapper;
    },
    [getServerStatusIconProps, isInitializing, serverTitles],
  );

  if (!isPinned && mcpValues?.length === 0) {
    return null;
  }

  const configDialogProps = getConfigDialogProps();
  const SelectedIcon = selectedIcon;

  return (
    <>
      <MultiSelect
        items={configuredServers}
        selectedValues={mcpValues ?? []}
        setSelectedValues={batchToggleServers}
        renderSelectedValues={renderSelectedValues}
        renderItemContent={renderItemContent}
        placeholder={placeholderText}
        popoverClassName="min-w-fit"
        className="badge-icon min-w-fit"
        selectIcon={<SelectedIcon className="icon-md text-text-primary" />}
        selectItemsClassName="border border-blue-600/50 bg-blue-500/10 hover:bg-blue-700/10"
        selectClassName="group relative inline-flex items-center justify-center md:justify-start gap-1.5 rounded-full border border-border-medium text-sm font-medium transition-all md:w-full size-9 p-2 md:p-3 bg-transparent shadow-sm hover:bg-surface-hover hover:shadow-md active:shadow-inner"
      />
      {configDialogProps && (
        <MCPConfigDialog {...configDialogProps} conversationId={conversationId} />
      )}
    </>
  );
}

function MCPSelect() {
  const { mcpServerManager } = useBadgeRowContext();
  const { configuredServers } = mcpServerManager;

  if (!configuredServers || configuredServers.length === 0) {
    return null;
  }

  return <MCPSelectContent />;
}

export default memo(MCPSelect);
