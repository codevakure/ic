import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { MessageSquare, Search } from 'lucide-react';
import { Spinner } from '@ranger/client';
import { useConversationsInfiniteQuery } from '~/data-provider';
import { useDocumentTitle, useLocalize, useAuthContext } from '~/hooks';
import { PageContainer } from '~/components/Layout';
import { groupConversationsByDate } from '~/utils';
import { cn } from '~/utils';

// Extended type for conversation data returned by backend
interface ConversationItem {
  conversationId: string | null;
  endpoint: string | null;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  user?: string;
}

type DateFilter = 'all' | 'today' | 'week' | 'month';

const dateFilterLabels: Record<DateFilter, string> = {
  all: 'All time',
  today: 'Today',
  week: 'Past 7 days',
  month: 'Past 30 days',
};

/**
 * ConversationHistoryPage - Full page for viewing all conversation history
 */
const ConversationHistoryPage: React.FC = () => {
  const localize = useLocalize();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useDocumentTitle('Conversation History | Ranger');

  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage } =
    useConversationsInfiniteQuery(
      {
        search: searchQuery || undefined,
      },
      {
        enabled: isAuthenticated,
        staleTime: 30000,
      },
    );

  // Get all conversations from paginated data
  const allConversations = useMemo(() => {
    return data ? (data.pages.flatMap((page) => page.conversations) as ConversationItem[]) : [];
  }, [data]);

  // Filter conversations by date
  const filteredConversations = useMemo(() => {
    if (dateFilter === 'all') {
      return allConversations;
    }

    const now = new Date();
    const cutoffDate = new Date();

    switch (dateFilter) {
      case 'today':
        cutoffDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        cutoffDate.setDate(now.getDate() - 30);
        break;
      default:
        return allConversations;
    }

    return allConversations.filter((convo) => new Date(convo.updatedAt) >= cutoffDate);
  }, [allConversations, dateFilter]);

  const groupedConversations = useMemo(() => {
    return groupConversationsByDate(filteredConversations as any);
  }, [filteredConversations]);

  // Infinite scroll handler
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || isFetchingNextPage || !hasNextPage) {
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    if (scrollHeight - scrollTop - clientHeight < 200) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  const handleConversationClick = (conversationId: string) => {
    navigate(`/c/${conversationId}`);
  };

  const totalConversations = allConversations.length;

  return (
    <PageContainer ref={scrollContainerRef}>
      {/* Header section */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Conversations</h1>
        <span className="text-sm text-text-secondary">
          {totalConversations}
          {hasNextPage ? '+' : ''} total
        </span>
      </div>

      {/* Filters and Search in one row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Filter tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'today', 'week', 'month'] as DateFilter[]).map((filter) => (
            <button
              key={filter}
              onClick={() => setDateFilter(filter)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                dateFilter === filter
                  ? 'bg-surface-submit text-white'
                  : 'border border-border-medium bg-surface-secondary text-text-primary hover:bg-surface-hover',
              )}
            >
              {dateFilterLabels[filter]}
            </button>
          ))}
        </div>

        {/* Search bar */}
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-full border border-border-medium bg-surface-secondary py-1.5 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-tertiary focus:border-text-primary focus:outline-none"
          />
        </div>
      </div>

      {/* Conversations list */}
      <div className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner className="h-8 w-8 text-text-primary" />
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MessageSquare className="mb-4 h-12 w-12 text-text-tertiary" />
            <h3 className="text-lg font-medium text-text-primary">No conversations found</h3>
            <p className="mt-1 text-sm text-text-secondary">
              {searchQuery
                ? 'Try a different search term.'
                : 'Start a new chat to see your conversations here.'}
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {groupedConversations.map(([groupName, convos]) => (
              <div key={groupName}>
                {/* Group header */}
                <h3 className="font-semibold text-text-primary">
                  {localize(groupName as any) || groupName}
                </h3>

                {/* Conversation rows */}
                <div className="divide-y divide-border-light">
                  {(convos as ConversationItem[]).map((conversation) => (
                    <ConversationRow
                      key={conversation.conversationId}
                      conversation={conversation}
                      onClick={() => handleConversationClick(conversation.conversationId!)}
                    />
                  ))}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isFetchingNextPage && (
              <div className="flex items-center justify-center py-4">
                <Spinner className="h-5 w-5 text-text-secondary" />
                <span className="ml-2 text-sm text-text-secondary">Loading more...</span>
              </div>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  );
};

interface ConversationRowProps {
  conversation: ConversationItem;
  onClick: () => void;
}

const ConversationRow: React.FC<ConversationRowProps> = ({ conversation, onClick }) => {
  const formatShortDate = (dateString: string) => {
    return format(new Date(dateString), 'M/d');
  };

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between px-2 py-4 text-left transition-colors hover:bg-surface-hover"
    >
      {/* Left content */}
      <div className="min-w-0 flex-1 pr-4">
        {/* Title */}
        <h4 className="truncate text-sm font-medium text-text-primary">
          {conversation.title || 'New Chat'}
        </h4>

        {/* Subtitle - time ago */}
        <p className="mt-1 truncate text-xs text-text-secondary">
          {formatDistanceToNow(new Date(conversation.updatedAt), { addSuffix: true })}
        </p>
      </div>

      {/* Right side - date */}
      <span className="flex-shrink-0 text-sm text-text-secondary">
        {formatShortDate(conversation.updatedAt)}
      </span>
    </button>
  );
};

export default ConversationHistoryPage;
