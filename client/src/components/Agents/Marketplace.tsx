import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRecoilState } from 'recoil';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import { ChevronDown, Link, MessageSquare } from 'lucide-react';
import {
  Button,
  useMediaQuery,
  useToastContext,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@librechat/client';
import {
  PermissionTypes,
  Permissions,
  QueryKeys,
  Constants,
  EModelEndpoint,
  PermissionBits,
  LocalStorageKeys,
  AgentListResponse,
} from 'librechat-data-provider';
import type t from 'librechat-data-provider';
import { useDocumentTitle, useHasAccess, useLocalize, TranslationKeys, useDefaultConvo, useNewConvo } from '~/hooks';
import { useGetEndpointsQuery, useGetAgentCategoriesQuery } from '~/data-provider';
import { useSourcesPanel } from '~/components/ui/SidePanel';
import MarketplaceAdminSettings from './MarketplaceAdminSettings';
import { renderAgentAvatar, clearMessagesCache } from '~/utils';
import SearchBar from './SearchBar';
import AgentGrid from './AgentGrid';
import store from '~/store';

interface AgentMarketplaceProps {
  className?: string;
}

interface SupportContact {
  name?: string;
  email?: string;
}

interface AgentWithSupport extends t.Agent {
  support_contact?: SupportContact;
}

/**
 * AgentDetailPanel - Push panel content for agent details
 */
const AgentDetailPanel: React.FC<{
  agent: AgentWithSupport;
  onClose: () => void;
}> = ({ agent, onClose }) => {
  const localize = useLocalize();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToastContext();
  const getDefaultConversation = useDefaultConvo();
  const { newConversation } = useNewConvo();

  /**
   * Navigate to chat with the selected agent
   */
  const handleStartChat = useCallback(() => {
    if (agent) {
      // Update both VIEW and EDIT caches to ensure agent is available in agentsMap
      const viewKeys = [QueryKeys.agents, { requiredPermission: PermissionBits.VIEW }];
      const editKeys = [QueryKeys.agents, { requiredPermission: PermissionBits.EDIT }];
      
      // Update VIEW cache (used by useAgentsMap for Landing page)
      const viewListResp = queryClient.getQueryData<AgentListResponse>(viewKeys);
      if (viewListResp != null) {
        if (!viewListResp.data.some((a) => a.id === agent.id)) {
          const currentAgents = [agent, ...JSON.parse(JSON.stringify(viewListResp.data))];
          queryClient.setQueryData<AgentListResponse>(viewKeys, { ...viewListResp, data: currentAgents });
        }
      }
      
      // Update EDIT cache (used by other components)
      const editListResp = queryClient.getQueryData<AgentListResponse>(editKeys);
      if (editListResp != null) {
        if (!editListResp.data.some((a) => a.id === agent.id)) {
          const currentAgents = [agent, ...JSON.parse(JSON.stringify(editListResp.data))];
          queryClient.setQueryData<AgentListResponse>(editKeys, { ...editListResp, data: currentAgents });
        }
      }

      localStorage.setItem(`${LocalStorageKeys.AGENT_ID_PREFIX}0`, agent.id);

      clearMessagesCache(queryClient, undefined);
      queryClient.invalidateQueries([QueryKeys.messages]);

      /** Template with agent configuration */
      const template = {
        conversationId: Constants.NEW_CONVO as string,
        endpoint: EModelEndpoint.agents,
        agent_id: agent.id,
        title: localize('com_agents_chat_with', { name: agent.name || localize('com_ui_agent') }),
      };

      const currentConvo = getDefaultConversation({
        conversation: { ...template },
        preset: template,
      });

      // Use newConversation to set up the chat - now works because providers are shared in AppLayout
      newConversation({
        template: currentConvo,
        preset: template,
      });

      // Close the panel and navigate to chat
      onClose();
      navigate('/c/new');
    }
  }, [agent, queryClient, localize, getDefaultConversation, newConversation, onClose, navigate]);

  /**
   * Copy the agent's shareable link to clipboard
   */
  const handleCopyLink = useCallback(() => {
    const baseUrl = new URL(window.location.origin);
    const chatUrl = `${baseUrl.origin}/c/new?agent_id=${agent.id}`;
    navigator.clipboard
      .writeText(chatUrl)
      .then(() => {
        showToast({
          message: localize('com_agents_link_copied'),
        });
      })
      .catch(() => {
        showToast({
          message: localize('com_agents_link_copy_failed'),
        });
      });
  }, [agent.id, showToast, localize]);

  /**
   * Format contact information with mailto links when appropriate
   */
  const formatContact = () => {
    if (!agent?.support_contact) return null;

    const { name, email } = agent.support_contact;

    if (name && email) {
      return (
        <a href={`mailto:${email}`} className="text-green-500 hover:underline">
          {name}
        </a>
      );
    }

    if (email) {
      return (
        <a href={`mailto:${email}`} className="text-green-500 hover:underline">
          {email}
        </a>
      );
    }

    if (name) {
      return <span>{name}</span>;
    }

    return null;
  };

  return (
    <div className="flex h-full flex-col">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Agent avatar - centered */}
        <div className="flex justify-center pt-6">
          {renderAgentAvatar(agent, { size: 'xl' })}
        </div>

        {/* Agent name */}
        <div className="mt-4 text-center">
          <h2 className="text-xl font-bold text-text-primary">
            {agent?.name || localize('com_agents_loading')}
          </h2>
        </div>

        {/* Contact info */}
        {agent?.support_contact && formatContact() && (
          <div className="mt-2 text-center text-sm text-text-secondary">
            {localize('com_agents_contact')}: {formatContact()}
          </div>
        )}

        {/* Description */}
        <div className="mt-6 px-6">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
            {agent?.description}
          </p>
        </div>

        {/* 
          DEVELOPER NOTE: Copy link functionality is temporarily disabled.
          The deep linking feature for sharing agent links is not yet fully implemented.
          This will be re-enabled once the agent sharing/linking feature is complete.
          See: handleCopyLink function and com_agents_copy_link localization key
        */}
        {/* Copy link button - temporarily disabled
        <div className="mt-6 px-6">
          <button
            onClick={handleCopyLink}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border-light bg-surface-secondary px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            <Link className="h-4 w-4" />
            {localize('com_agents_copy_link')}
          </button>
        </div>
        */}
      </div>

      {/* Fixed footer with Start Chat button */}
      <div className="flex-shrink-0 border-t border-border-light bg-surface-primary p-4">
        <Button
          onClick={handleStartChat}
          className="w-full gap-2"
          disabled={!agent}
        >
          <MessageSquare className="h-4 w-4" />
          {localize('com_agents_start_chat')}
        </Button>
      </div>
    </div>
  );
};

/**
 * AgentMarketplace - Main component for browsing and discovering agents
 *
 * Provides tabbed navigation for different agent categories,
 * search functionality, and detailed agent view through a push panel.
 * Uses URL parameters for state persistence and deep linking.
 */
const AgentMarketplace: React.FC<AgentMarketplaceProps> = ({ className = '' }) => {
  const localize = useLocalize();
  const navigate = useNavigate();
  const { category } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { openPanel, closePanel, isOpen } = useSourcesPanel();

  const isSmallScreen = useMediaQuery('(max-width: 768px)');
  const [hideSidePanel, setHideSidePanel] = useRecoilState(store.hideSidePanel);

  // Get URL parameters
  const searchQuery = searchParams.get('q') || '';
  const selectedAgentId = searchParams.get('agent_id') || '';

  // Category filter state - default to 'all'
  const [selectedCategory, setSelectedCategory] = useState<string>(category || 'all');

  // Ref for the scrollable container to enable infinite scroll
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Local state for selected agent
  const [selectedAgent, setSelectedAgent] = useState<t.Agent | null>(null);

  // Set page title
  useDocumentTitle(`${localize('com_agents_marketplace')} | LibreChat`);

  // Ensure right sidebar is always visible in marketplace
  useEffect(() => {
    setHideSidePanel(false);

    // Also try to force expand via localStorage
    localStorage.setItem('hideSidePanel', 'false');
    localStorage.setItem('fullPanelCollapse', 'false');
  }, [setHideSidePanel, hideSidePanel]);

  // Ensure endpoints config is loaded first (required for agent queries)
  useGetEndpointsQuery();

  // Fetch categories using existing query pattern
  const categoriesQuery = useGetAgentCategoriesQuery({
    staleTime: 1000 * 60 * 15, // 15 minutes - categories rarely change
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  // Sync category from URL
  useEffect(() => {
    if (category && category !== selectedCategory) {
      setSelectedCategory(category);
    } else if (!category && selectedCategory !== 'all') {
      setSelectedCategory('all');
    }
  }, [category, selectedCategory]);

  /**
   * Handle closing the agent detail panel
   */
  const handleDetailClose = useCallback(() => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('agent_id');
    setSearchParams(newParams);
    setSelectedAgent(null);
    closePanel();
  }, [searchParams, setSearchParams, closePanel]);

  /**
   * Handle agent card selection - opens push panel
   */
  const handleAgentSelect = useCallback((agent: t.Agent) => {
    // Update URL with selected agent
    const newParams = new URLSearchParams(searchParams);
    newParams.set('agent_id', agent.id);
    setSearchParams(newParams);
    setSelectedAgent(agent);

    // Open push panel with agent details
    openPanel(
      agent.name || localize('com_ui_agent'),
      <AgentDetailPanel agent={agent} onClose={handleDetailClose} />,
      'push',
    );
  }, [searchParams, setSearchParams, openPanel, localize, handleDetailClose]);

  /**
   * Handle category filter change from dropdown
   */
  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);

    // Update URL
    const currentSearchParams = searchParams.toString();
    const searchParamsStr = currentSearchParams ? `?${currentSearchParams}` : '';
    if (value === 'all') {
      navigate(`/agents${searchParamsStr}`);
    } else {
      navigate(`/agents/${value}${searchParamsStr}`);
    }
  };

  /**
   * Handle search query changes
   */
  const handleSearch = (query: string) => {
    const newParams = new URLSearchParams(searchParams);

    if (query.trim()) {
      newParams.set('q', query.trim());
    } else {
      newParams.delete('q');
    }

    // Preserve current category when searching
    if (selectedCategory === 'all') {
      navigate(`/agents${newParams.toString() ? `?${newParams.toString()}` : ''}`);
    } else {
      navigate(
        `/agents/${selectedCategory}${newParams.toString() ? `?${newParams.toString()}` : ''}`,
      );
    }
  };

  // Sync selected state with panel - close panel clears selection
  useEffect(() => {
    if (!isOpen && selectedAgent) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('agent_id');
      setSearchParams(newParams);
      setSelectedAgent(null);
    }
  }, [isOpen, selectedAgent, searchParams, setSearchParams]);

  // Open panel if agent_id is in URL on mount
  useEffect(() => {
    if (selectedAgentId && !selectedAgent && !isOpen) {
      // We need to wait for agent data to load - this will be handled by AgentGrid
      // For now, we just track that we want to open the panel
    }
  }, [selectedAgentId, selectedAgent, isOpen]);

  const hasAccessToMarketplace = useHasAccess({
    permissionType: PermissionTypes.MARKETPLACE,
    permission: Permissions.USE,
  });

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    if (!hasAccessToMarketplace) {
      timeoutId = setTimeout(() => {
        navigate('/c/new');
      }, 1000);
    }
    return () => {
      clearTimeout(timeoutId);
    };
  }, [hasAccessToMarketplace, navigate]);

  if (!hasAccessToMarketplace) {
    return null;
  }
  
  /**
   * Marketplace now renders as child of AppLayout's SidePanelGroup.
   * No need for its own SidePanelGroup - panel infrastructure comes from parent.
   * 
   * This enables consistent panel behavior across all routes:
   * - Push mode sources panel (resizable)
   * - Overlay mode panels
   * - Mobile bottom sheet
   */
  return (
    <div className={`relative flex w-full grow overflow-hidden bg-presentation ${className}`}>
      <main className="flex h-full w-full flex-col overflow-hidden" role="main">
        {/* Scrollable container */}
        <div
          ref={scrollContainerRef}
          className="scrollbar-gutter-stable relative flex h-full flex-col overflow-y-auto overflow-x-hidden"
        >
          {/* Main content area */}
          <div className="flex flex-1 flex-col gap-2 px-6 pb-5 pt-6">
            {/* Header row - Title + Search + Admin */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-text-primary">
                  {localize('com_agents_marketplace')}
                </h1>
                <p className="text-sm text-text-secondary">
                  {localize('com_agents_marketplace_subtitle')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <SearchBar value={searchQuery} onSearch={handleSearch} />
                <MarketplaceAdminSettings iconSize="h-5 w-5" buttonSize="h-9 w-9" />
              </div>
            </div>

            {/* Category tabs row */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              {/* All tab */}
              <button
                onClick={() => handleCategoryChange('all')}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-surface-submit text-white'
                    : 'border border-border-medium bg-surface-secondary text-text-primary hover:bg-surface-hover'
                }`}
              >
                {localize('com_agents_all')}
              </button>
              {/* Display first 5 categories as tabs */}
              {categoriesQuery.data
                ?.filter((cat) => cat.value !== 'promoted')
                .slice(0, 5)
                .map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => handleCategoryChange(cat.value)}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                      selectedCategory === cat.value
                        ? 'bg-surface-submit text-white'
                        : 'border border-border-medium bg-surface-secondary text-text-primary hover:bg-surface-hover'
                    }`}
                  >
                    {cat.label?.startsWith('com_')
                      ? localize(cat.label as TranslationKeys)
                      : cat.label}
                  </button>
                ))}
              {/* More dropdown for remaining categories */}
              {categoriesQuery.data &&
                categoriesQuery.data.filter((cat) => cat.value !== 'promoted').length > 5 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="flex items-center gap-1 rounded-full border border-border-medium bg-surface-secondary px-4 py-1.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-hover"
                      >
                        {categoriesQuery.data.filter((cat) => cat.value !== 'promoted').length -
                          5}{' '}
                        more
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="border-border-medium bg-surface-primary"
                    >
                      {categoriesQuery.data
                        ?.filter((cat) => cat.value !== 'promoted')
                        .slice(5)
                        .map((cat) => (
                          <DropdownMenuItem
                            key={cat.value}
                            onClick={() => handleCategoryChange(cat.value)}
                            className={`cursor-pointer ${
                              selectedCategory === cat.value
                                ? 'bg-surface-submit text-white'
                                : 'text-text-primary hover:bg-surface-hover'
                            }`}
                          >
                            {cat.label?.startsWith('com_')
                              ? localize(cat.label as TranslationKeys)
                              : cat.label}
                          </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
            </div>

            {/* Agent grid */}
            <AgentGrid
              key={`grid-${selectedCategory}`}
              category={selectedCategory}
              searchQuery={searchQuery}
              onSelectAgent={handleAgentSelect}
              scrollElementRef={scrollContainerRef}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default AgentMarketplace;
