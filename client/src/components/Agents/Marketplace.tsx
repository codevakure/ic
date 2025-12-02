import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRecoilState } from 'recoil';
import { useOutletContext } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import {
  TooltipAnchor,
  Button,
  NewChatIcon,
  useMediaQuery,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@librechat/client';
import { PermissionTypes, Permissions, QueryKeys } from 'librechat-data-provider';
import type t from 'librechat-data-provider';
import type { ContextType } from '~/common';
import { useDocumentTitle, useHasAccess, useLocalize, TranslationKeys } from '~/hooks';
import { useGetEndpointsQuery, useGetAgentCategoriesQuery } from '~/data-provider';
import MarketplaceAdminSettings from './MarketplaceAdminSettings';
import { SidePanelProvider, useChatContext } from '~/Providers';
import { SidePanelGroup } from '~/components/SidePanel';
import { OpenSidebar } from '~/components/Chat/Menus';
import { clearMessagesCache } from '~/utils';
import AgentDetail from './AgentDetail';
import SearchBar from './SearchBar';
import AgentGrid from './AgentGrid';
import store from '~/store';

interface AgentMarketplaceProps {
  className?: string;
}

/**
 * AgentMarketplace - Main component for browsing and discovering agents
 *
 * Provides tabbed navigation for different agent categories,
 * search functionality, and detailed agent view through a modal dialog.
 * Uses URL parameters for state persistence and deep linking.
 */
const AgentMarketplace: React.FC<AgentMarketplaceProps> = ({ className = '' }) => {
  const localize = useLocalize();
  const navigate = useNavigate();
  const { category } = useParams();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { conversation, newConversation } = useChatContext();

  const isSmallScreen = useMediaQuery('(max-width: 768px)');
  const { navVisible, setNavVisible } = useOutletContext<ContextType>();
  const [hideSidePanel, setHideSidePanel] = useRecoilState(store.hideSidePanel);

  // Get URL parameters
  const searchQuery = searchParams.get('q') || '';
  const selectedAgentId = searchParams.get('agent_id') || '';

  // Category filter state - default to 'all'
  const [selectedCategory, setSelectedCategory] = useState<string>(category || 'all');

  // Ref for the scrollable container to enable infinite scroll
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Local state
  const [isDetailOpen, setIsDetailOpen] = useState(false);
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
   * Handle agent card selection
   *
   * @param agent - The selected agent object
   */
  const handleAgentSelect = (agent: t.Agent) => {
    // Update URL with selected agent
    const newParams = new URLSearchParams(searchParams);
    newParams.set('agent_id', agent.id);
    setSearchParams(newParams);
    setSelectedAgent(agent);
    setIsDetailOpen(true);
  };

  /**
   * Handle closing the agent detail dialog
   */
  const handleDetailClose = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('agent_id');
    setSearchParams(newParams);
    setSelectedAgent(null);
    setIsDetailOpen(false);
  };

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
   *
   * @param query - The search query string
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

  /**
   * Handle new chat button click
   */

  const handleNewChat = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (e.button === 0 && (e.ctrlKey || e.metaKey)) {
      window.open('/c/new', '_blank');
      return;
    }
    clearMessagesCache(queryClient, conversation?.conversationId);
    queryClient.invalidateQueries([QueryKeys.messages]);
    newConversation();
  };

  // Check if a detail view should be open based on URL
  useEffect(() => {
    setIsDetailOpen(!!selectedAgentId);
  }, [selectedAgentId]);

  // Layout configuration for SidePanelGroup
  const defaultLayout = useMemo(() => {
    const resizableLayout = localStorage.getItem('react-resizable-panels:layout');
    return typeof resizableLayout === 'string' ? JSON.parse(resizableLayout) : undefined;
  }, []);

  const defaultCollapsed = useMemo(() => {
    const collapsedPanels = localStorage.getItem('react-resizable-panels:collapsed');
    return typeof collapsedPanels === 'string' ? JSON.parse(collapsedPanels) : true;
  }, []);

  const fullCollapse = useMemo(() => localStorage.getItem('fullPanelCollapse') === 'true', []);

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
  return (
    <div className={`relative flex w-full grow overflow-hidden bg-presentation ${className}`}>
      <SidePanelProvider>
        <SidePanelGroup
          defaultLayout={defaultLayout}
          fullPanelCollapse={fullCollapse}
          defaultCollapsed={defaultCollapsed}
        >
          <main className="flex h-full flex-col overflow-hidden" role="main">
            {/* Scrollable container */}
            <div
              ref={scrollContainerRef}
              className="scrollbar-gutter-stable relative flex h-full flex-col overflow-y-auto overflow-x-hidden"
            >
              {/* Sidebar toggle - minimal header */}
              {!navVisible && !isSmallScreen && (
                <div className="flex h-12 items-center px-4">
                  <div className="flex items-center gap-2">
                    <OpenSidebar setNavVisible={setNavVisible} />
                    <TooltipAnchor
                      description={localize('com_ui_new_chat')}
                      render={
                        <Button
                          size="icon"
                          variant="outline"
                          data-testid="agents-new-chat-button"
                          aria-label={localize('com_ui_new_chat')}
                          className="h-9 w-9 rounded-lg border-border-light hover:bg-surface-hover"
                          onClick={handleNewChat}
                        >
                          <NewChatIcon className="h-4 w-4" />
                        </Button>
                      }
                    />
                  </div>
                </div>
              )}

              {/* Main content area */}
              <div className="flex flex-1 flex-col gap-3 px-6 py-5 sm:px-8 lg:px-10">
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
              {/* Agent detail dialog */}
              {isDetailOpen && selectedAgent && (
                <AgentDetail
                  agent={selectedAgent}
                  isOpen={isDetailOpen}
                  onClose={handleDetailClose}
                />
              )}
            </div>
          </main>
        </SidePanelGroup>
      </SidePanelProvider>
    </div>
  );
};

export default AgentMarketplace;
