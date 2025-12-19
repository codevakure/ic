import React, { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, RefreshCw, Settings2, CheckCircle2, XCircle, AlertCircle, Plug } from 'lucide-react';
import {
  Button,
  Spinner,
  useToastContext,
  MCPIcon,
  Microsoft365Icon,
  useMediaQuery,
} from '@ranger/client';
import { Constants, QueryKeys } from 'ranger-data-provider';
import { useUpdateUserPluginsMutation } from 'ranger-data-provider/react-query';
import type { TUpdateUserPlugins } from 'ranger-data-provider';
import ServerInitializationSection from '~/components/MCP/ServerInitializationSection';
import CustomUserVarsSection from '~/components/MCP/CustomUserVarsSection';
import { useLocalize, useMCPConnectionStatus, useDocumentTitle } from '~/hooks';
import { useGetStartupConfig } from '~/data-provider';
import { useSourcesPanel } from '~/components/ui/SidePanel';
import { cn } from '~/utils';

interface MCPServerDefinition {
  serverName: string;
  title: string;
  iconPath: string | null;
  config: {
    customUserVars?: Record<string, { title: string; description?: string }>;
    isOAuth?: boolean;
    startup?: boolean;
    [key: string]: unknown;
  };
}

// Color palette for connector cards
const getConnectorColor = (index: number, isConnected: boolean) => {
  if (isConnected) {
    return 'from-green-500/20 to-green-600/10 border-green-500/30';
  }
  const colors = [
    'from-blue-500/20 to-blue-600/10 border-blue-500/30',
    'from-purple-500/20 to-purple-600/10 border-purple-500/30',
    'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30',
    'from-orange-500/20 to-orange-600/10 border-orange-500/30',
    'from-pink-500/20 to-pink-600/10 border-pink-500/30',
    'from-indigo-500/20 to-indigo-600/10 border-indigo-500/30',
  ];
  return colors[index % colors.length];
};

// Get icon for MCP server based on name
const getServerIcon = (serverName: string): React.ReactNode => {
  const name = serverName.toLowerCase();
  if (name.includes('ms365') || name.includes('microsoft') || name.includes('sharepoint') || name.includes('outlook')) {
    return <Microsoft365Icon className="h-6 w-6" />;
  }
  return <MCPIcon className="h-6 w-6" />;
};

interface ConnectorCardProps {
  server: MCPServerDefinition;
  index: number;
  isConnected: boolean;
  connectionState: string;
  onSelect: (serverName: string) => void;
}

const ConnectorCard: React.FC<ConnectorCardProps> = ({
  server,
  index,
  isConnected,
  connectionState,
  onSelect,
}) => {
  const localize = useLocalize();
  
  const getStatusIcon = () => {
    if (isConnected) {
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
    if (connectionState === 'error') {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
    return <AlertCircle className="h-4 w-4 text-yellow-500" />;
  };

  const getStatusText = () => {
    if (isConnected) {
      return 'Connected';
    }
    if (connectionState === 'error') {
      return localize('com_ui_error');
    }
    return 'Not Connected';
  };

  return (
    <div
      onClick={() => onSelect(server.serverName)}
      className={cn(
        'group relative flex cursor-pointer flex-col rounded-xl border bg-gradient-to-br p-4 transition-all',
        'hover:shadow-lg hover:scale-[1.02] hover:-translate-y-0.5',
        getConnectorColor(index, isConnected),
      )}
    >
      {/* Header with icon and status */}
      <div className="flex items-start justify-between mb-3">
        <div className={cn(
          'flex h-12 w-12 items-center justify-center rounded-xl',
          isConnected ? 'bg-green-500/20' : 'bg-white/10',
        )}>
          {getServerIcon(server.serverName)}
        </div>
        <div className={cn(
          'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
          isConnected
            ? 'bg-green-500/20 text-green-600 dark:text-green-400'
            : connectionState === 'error'
              ? 'bg-red-500/20 text-red-600 dark:text-red-400'
              : 'bg-surface-tertiary text-text-secondary',
        )}>
          {getStatusIcon()}
          <span>{getStatusText()}</span>
        </div>
      </div>

      {/* Title */}
      <h3 className="text-base font-semibold text-text-primary mb-1">
        {server.title}
      </h3>

      {/* Description */}
      <p className="text-xs text-text-secondary mb-3 line-clamp-2">
        {server.config.isOAuth
          ? 'OAuth authentication required'
          : server.config.customUserVars && Object.keys(server.config.customUserVars).length > 0
            ? `${Object.keys(server.config.customUserVars).length} configuration field${Object.keys(server.config.customUserVars).length > 1 ? 's' : ''}`
            : 'Click to configure'}
      </p>

      {/* Action hint */}
      <div className="mt-auto flex items-center gap-2 text-xs text-text-tertiary">
        <Settings2 className="h-3.5 w-3.5" />
        <span className="group-hover:text-text-secondary transition-colors">
          Configure
        </span>
      </div>
    </div>
  );
};

/**
 * ConnectorDetailPanel - Push panel content for connector configuration
 */
const ConnectorDetailPanel: React.FC<{
  server: MCPServerDefinition;
  connectionStatus: Record<string, { connectionState: string; requiresOAuth?: boolean }> | undefined;
  onSave: (serverName: string, authData: Record<string, string>) => void;
  onRevoke: (serverName: string) => void;
  isSubmitting: boolean;
  conversationId?: string | null;
  onClose: () => void;
}> = ({ server, connectionStatus, onSave, onRevoke, isSubmitting, conversationId, onClose }) => {
  const localize = useLocalize();
  const serverStatus = connectionStatus?.[server.serverName];
  const isConnected = serverStatus?.connectionState === 'connected';

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border-light p-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3">
          <div className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg',
            isConnected ? 'bg-green-500/20' : 'bg-surface-tertiary',
          )}>
            {getServerIcon(server.serverName)}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{server.title}</h2>
            <div className="flex items-center gap-1.5 text-sm">
              {isConnected ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  <span className="text-green-600 dark:text-green-400">
                    Connected
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />
                  <span className="text-text-secondary">
                    Not Connected
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Custom User Variables */}
        {server.config.customUserVars && Object.keys(server.config.customUserVars).length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-text-primary">
              Configuration
            </h3>
            <CustomUserVarsSection
              serverName={server.serverName}
              fields={server.config.customUserVars}
              onSave={(authData) => onSave(server.serverName, authData)}
              onRevoke={() => onRevoke(server.serverName)}
              isSubmitting={isSubmitting}
            />
          </div>
        )}

        {/* OAuth / Initialization */}
        <ServerInitializationSection
          sidePanel={false}
          conversationId={conversationId}
          serverName={server.serverName}
          requiresOAuth={serverStatus?.requiresOAuth || false}
          hasCustomUserVars={
            server.config.customUserVars &&
            Object.keys(server.config.customUserVars).length > 0
          }
        />
      </div>
    </div>
  );
};

/**
 * ConnectorsPage - Main page for managing MCP connector settings
 * Following the same pattern as AgentsPage and BookmarksPage
 */
export default function ConnectorsPage() {
  const localize = useLocalize();
  const queryClient = useQueryClient();
  const { showToast } = useToastContext();
  const { openPanel, closePanel, isOpen: panelOpen, mode: panelMode } = useSourcesPanel();
  
  // Detect if panel is open in push mode to adjust grid layout
  const isSmallScreen = useMediaQuery('(max-width: 767px)');
  const isPanelPushed = panelOpen && panelMode === 'push' && !isSmallScreen;

  useDocumentTitle(localize('com_nav_setting_mcp') || 'Connector Settings');

  const { data: startupConfig, isLoading: startupConfigLoading } = useGetStartupConfig();
  const { connectionStatus } = useMCPConnectionStatus({
    enabled: !!startupConfig?.mcpServers && Object.keys(startupConfig.mcpServers).length > 0,
  });

  const updateUserPluginsMutation = useUpdateUserPluginsMutation({
    onSuccess: async () => {
      showToast({ message: localize('com_nav_mcp_vars_updated'), status: 'success' });

      await Promise.all([
        queryClient.invalidateQueries([QueryKeys.mcpTools]),
        queryClient.invalidateQueries([QueryKeys.mcpAuthValues]),
        queryClient.invalidateQueries([QueryKeys.mcpConnectionStatus]),
      ]);
    },
    onError: (error: unknown) => {
      console.error('Error updating MCP auth:', error);
      showToast({
        message: localize('com_nav_mcp_vars_update_error'),
        status: 'error',
      });
    },
  });

  const mcpServerDefinitions = useMemo<MCPServerDefinition[]>(() => {
    if (!startupConfig?.mcpServers) {
      return [];
    }
    return Object.entries(startupConfig.mcpServers)
      .filter(([, config]) => {
        const cfg = config as MCPServerDefinition['config'];
        return (
          (cfg.customUserVars && Object.keys(cfg.customUserVars).length > 0) ||
          cfg.isOAuth ||
          cfg.startup === false
        );
      })
      .map(([serverName, config]) => ({
        serverName,
        title: (config as { title?: string }).title || serverName,
        iconPath: null,
        config: {
          ...config,
          customUserVars: (config as MCPServerDefinition['config']).customUserVars ?? {},
        },
      }));
  }, [startupConfig?.mcpServers]);

  const handleConfigSave = useCallback(
    (targetName: string, authData: Record<string, string>) => {
      const payload: TUpdateUserPlugins = {
        pluginKey: `${Constants.mcp_prefix}${targetName}`,
        action: 'install',
        auth: authData,
      };
      updateUserPluginsMutation.mutate(payload);
    },
    [updateUserPluginsMutation],
  );

  const handleConfigRevoke = useCallback(
    (targetName: string) => {
      const payload: TUpdateUserPlugins = {
        pluginKey: `${Constants.mcp_prefix}${targetName}`,
        action: 'uninstall',
        auth: {},
      };
      updateUserPluginsMutation.mutate(payload);
    },
    [updateUserPluginsMutation],
  );

  const handleServerSelect = useCallback(
    (serverName: string) => {
      const server = mcpServerDefinitions.find((s) => s.serverName === serverName);
      if (!server) return;

      openPanel(
        server.title,
        <ConnectorDetailPanel
          server={server}
          connectionStatus={connectionStatus}
          onSave={handleConfigSave}
          onRevoke={handleConfigRevoke}
          isSubmitting={updateUserPluginsMutation.isLoading}
          conversationId={null}
          onClose={closePanel}
        />,
        'push',
      );
    },
    [mcpServerDefinitions, connectionStatus, handleConfigSave, handleConfigRevoke, updateUserPluginsMutation.isLoading, openPanel, closePanel],
  );

  if (startupConfigLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  // Compute grid classes based on whether panel is pushed
  // When panel is open, reduce columns to account for reduced container width
  const gridClasses = useMemo(() => {
    if (isPanelPushed) {
      // Panel takes ~30% width, so reduce column count by one level
      return 'grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3';
    }
    // Default: 4 columns on large screens
    return 'grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
  }, [isPanelPushed]);

  return (
    <div className="relative flex w-full grow overflow-hidden bg-presentation">
      <main className="flex h-full w-full flex-col overflow-hidden" role="main">
        {/* Scrollable container */}
        <div className="scrollbar-gutter-stable relative flex h-full flex-col overflow-y-auto overflow-x-hidden">
          {/* Main content area */}
          <div className="flex flex-1 flex-col gap-2 px-6 pb-5 pt-6">
            {/* Header row - Title */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-text-primary">
                  {localize('com_nav_setting_mcp')}
                </h1>
                <p className="text-sm text-text-secondary">
                  Manage your external service connections
                </p>
              </div>
            </div>

            {/* Connector grid */}
            <div className="space-y-4 pt-2">
              {mcpServerDefinitions.length === 0 ? (
                <div className="py-12 text-center">
                  <h3 className="mb-2 text-lg font-medium text-text-primary">
                    No Connectors Available
                  </h3>
                  <p className="text-sm text-text-secondary">
                    {localize('com_sidepanel_mcp_no_servers_with_vars')}
                  </p>
                </div>
              ) : (
                <div className={gridClasses}>
                  {mcpServerDefinitions.map((server, index) => {
                    const serverStatus = connectionStatus?.[server.serverName];
                    const isConnected = serverStatus?.connectionState === 'connected';
                    
                    return (
                      <ConnectorCard
                        key={server.serverName}
                        server={server}
                        index={index}
                        isConnected={isConnected}
                        connectionState={serverStatus?.connectionState || 'disconnected'}
                        onSelect={handleServerSelect}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
