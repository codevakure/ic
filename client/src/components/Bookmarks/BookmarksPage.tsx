import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  Bookmark,
  BookmarkPlus,
  Search,
  Grid3X3,
  List,
  Pencil,
  Trash2,
  MessageSquare,
  ChevronRight,
} from 'lucide-react';
import {
  Spinner,
  OGDialogTrigger,
  Button,
  useToastContext,
  useMediaQuery,
} from '@ranger/client';
import type { TConversationTag, TConversation } from 'ranger-data-provider';
import {
  useConversationTagsQuery,
  useDeleteConversationTagMutation,
  useConversationsInfiniteQuery,
  useGetEndpointsQuery,
} from '~/data-provider';
import EndpointIcon from '~/components/Endpoints/EndpointIcon';
import { BookmarkContext } from '~/Providers/BookmarkContext';
import { useSourcesPanel } from '~/components/ui/SidePanel';
import { useDocumentTitle, useLocalize, useAuthContext, useLocalStorage } from '~/hooks';
import { useAgentsMapContext } from '~/Providers';
import BookmarkEditDialog from './BookmarkEditDialog';
import { NotificationSeverity } from '~/common';
import { cn } from '~/utils';

type ViewMode = 'grid' | 'list';

const removeDuplicates = (bookmarks: TConversationTag[]) => {
  const seen = new Set();
  return bookmarks.filter((bookmark) => {
    const duplicate = seen.has(bookmark._id);
    seen.add(bookmark._id);
    return !duplicate;
  });
};

// Color palette for bookmark cards
const getBookmarkColor = (index: number) => {
  const colors = [
    'from-blue-500/20 to-blue-600/10 border-blue-500/30',
    'from-purple-500/20 to-purple-600/10 border-purple-500/30',
    'from-green-500/20 to-green-600/10 border-green-500/30',
    'from-orange-500/20 to-orange-600/10 border-orange-500/30',
    'from-pink-500/20 to-pink-600/10 border-pink-500/30',
    'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30',
    'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30',
    'from-red-500/20 to-red-600/10 border-red-500/30',
  ];
  return colors[index % colors.length];
};

interface BookmarkCardProps {
  bookmark: TConversationTag;
  index: number;
  viewMode: ViewMode;
  isSelected: boolean;
  onSelect: (bookmark: TConversationTag) => void;
  onEdit: (bookmark: TConversationTag, e: React.MouseEvent) => void;
  onDelete: (tag: string, e: React.MouseEvent) => void;
}

const BookmarkCard: React.FC<BookmarkCardProps> = ({
  bookmark,
  index,
  viewMode,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}) => {
  if (viewMode === 'list') {
    return (
      <div
        onClick={() => onSelect(bookmark)}
        className={cn(
          'group flex cursor-pointer items-center justify-between rounded-lg border px-4 py-3 transition-all',
          isSelected
            ? 'border-green-500/50 bg-green-500/10'
            : 'border-border-light bg-surface-secondary hover:border-border-medium hover:bg-surface-hover',
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Bookmark className={cn('h-4 w-4 flex-shrink-0', isSelected ? 'text-green-500' : 'text-text-secondary')} />
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="truncate font-medium text-text-primary">{bookmark.tag}</span>
            <span className="flex-shrink-0 text-xs text-text-tertiary">
              {bookmark.count} {bookmark.count === 1 ? 'conversation' : 'conversations'}
            </span>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => onEdit(bookmark, e)}
              className="h-7 w-7 p-0 text-text-secondary hover:text-text-primary"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => onDelete(bookmark.tag, e)}
              className="h-7 w-7 p-0 text-text-secondary hover:text-red-500"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <ChevronRight className={cn('h-4 w-4 transition-colors', isSelected ? 'text-green-500' : 'text-text-tertiary')} />
        </div>
      </div>
    );
  }

  // Grid view - compact card
  return (
    <div
      onClick={() => onSelect(bookmark)}
      className={cn(
        'group relative flex cursor-pointer items-center justify-between rounded-lg border bg-gradient-to-br px-4 py-3 transition-all',
        'hover:shadow-md',
        isSelected ? 'ring-2 ring-green-500/50' : '',
        getBookmarkColor(index),
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className={cn(
          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg',
          isSelected ? 'bg-green-500/20' : 'bg-white/10',
        )}>
          <Bookmark className={cn('h-4 w-4', isSelected ? 'text-green-500' : 'text-text-primary')} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium text-text-primary">{bookmark.tag}</h3>
          <p className="text-xs text-text-secondary">
            {bookmark.count} {bookmark.count === 1 ? 'conversation' : 'conversations'}
          </p>
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-1">
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => onEdit(bookmark, e)}
            className="h-7 w-7 p-0 text-text-secondary hover:text-text-primary"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => onDelete(bookmark.tag, e)}
            className="h-7 w-7 p-0 text-text-secondary hover:text-red-500"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        <ChevronRight className={cn('h-4 w-4 flex-shrink-0 transition-colors', isSelected ? 'text-green-500' : 'text-text-tertiary')} />
      </div>
    </div>
  );
};

interface ConversationsPanelContentProps {
  bookmarkTag: string;
  onClose: () => void;
}

const ConversationsPanelContent: React.FC<ConversationsPanelContentProps> = ({ bookmarkTag, onClose }) => {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { data: endpointsConfig } = useGetEndpointsQuery();
  const agentsMap = useAgentsMapContext();

  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage } =
    useConversationsInfiniteQuery(
      { tags: [bookmarkTag] },
      { enabled: true },
    );

  const conversations = useMemo(() => {
    return data?.pages.flatMap((page) => page.conversations) ?? [];
  }, [data]);

  // Infinite scroll
  const handleScroll = useCallback(() => {
    if (!scrollRef.current || isFetchingNextPage || !hasNextPage) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    if (scrollHeight - scrollTop - clientHeight < 200) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  useEffect(() => {
    const container = scrollRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  const handleConversationClick = (conversationId: string) => {
    onClose();
    navigate(`/c/${conversationId}`);
  };

  return (
    <div ref={scrollRef} className="flex h-full flex-col overflow-y-auto">
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner className="h-6 w-6" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center px-4">
          <MessageSquare className="mb-2 h-8 w-8 text-text-tertiary" />
          <p className="text-sm text-text-secondary">No conversations found</p>
        </div>
      ) : (
        <div className="flex flex-col">
          {conversations.map((convo: TConversation) => (
            <button
              key={convo.conversationId}
              onClick={() => handleConversationClick(convo.conversationId ?? '')}
              className="flex items-center gap-3 border-b border-border-light px-4 py-3 text-left transition-colors hover:bg-surface-hover"
            >
              <EndpointIcon
                conversation={convo}
                endpointsConfig={endpointsConfig}
                agentsMap={agentsMap}
                size={20}
                context="menu-item"
              />
              <div className="min-w-0 flex-1">
                <span className="line-clamp-1 text-sm font-medium text-text-primary">
                  {convo.title || 'Untitled'}
                </span>
                <span className="text-xs text-text-tertiary">
                  {formatDistanceToNow(new Date(convo.updatedAt), { addSuffix: true })}
                </span>
              </div>
            </button>
          ))}
          {isFetchingNextPage && (
            <div className="flex items-center justify-center py-4">
              <Spinner className="h-5 w-5" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * BookmarksPage - Standalone page for managing bookmarks
 * Uses useSourcesPanel hook for conversations panel (same as attachments/citations)
 */
const BookmarksPage: React.FC = () => {
  const localize = useLocalize();
  const { isAuthenticated } = useAuthContext();
  const { showToast } = useToastContext();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useLocalStorage<ViewMode>('bookmarksViewMode', 'grid');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedBookmark, setSelectedBookmark] = useState<TConversationTag | null>(null);
  const [editingBookmark, setEditingBookmark] = useState<TConversationTag | undefined>();

  // Use the same sources panel hook as attachments/citations
  const { openPanel, closePanel, isOpen, mode: panelMode } = useSourcesPanel();

  // Check if panel is pushed to adjust grid layout
  const isSmallScreen = useMediaQuery('(max-width: 767px)');
  const isPanelPushed = isOpen && panelMode === 'push' && !isSmallScreen;

  // Compute grid classes based on whether panel is pushed
  // When panel is open, reduce columns to account for reduced container width
  const gridClasses = useMemo(() => {
    if (isPanelPushed) {
      // Panel takes 40% width, so reduce column count significantly
      return 'grid auto-rows-fr grid-cols-1 gap-3 xs:grid-cols-2 md:grid-cols-2 lg:grid-cols-3';
    }
    // Default: up to 5 columns on extra large screens
    return 'grid auto-rows-fr grid-cols-1 gap-3 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';
  }, [isPanelPushed]);

  useDocumentTitle('Bookmarks | Ranger');

  const { data: bookmarks = [], isLoading } = useConversationTagsQuery({
    enabled: isAuthenticated,
  });

  const deleteMutation = useDeleteConversationTagMutation({
    onSuccess: () => {
      showToast({
        message: localize('com_ui_bookmarks_delete_success'),
        severity: NotificationSeverity.SUCCESS,
      });
      if (selectedBookmark) {
        setSelectedBookmark(null);
        closePanel();
      }
    },
    onError: () => {
      showToast({
        message: localize('com_ui_bookmarks_delete_error'),
        severity: NotificationSeverity.ERROR,
      });
    },
  });

  // Process bookmarks
  const processedBookmarks = useMemo(() => {
    const unique = removeDuplicates(bookmarks).sort((a, b) => a.position - b.position);
    if (!searchQuery) {
      return unique;
    }
    return unique.filter((b) => b.tag.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [bookmarks, searchQuery]);

  const handleSelect = useCallback((bookmark: TConversationTag) => {
    if (selectedBookmark?._id === bookmark._id && isOpen) {
      setSelectedBookmark(null);
      closePanel();
    } else {
      setSelectedBookmark(bookmark);
      // Open panel using the same hook as attachments/citations
      // Uses 'push' mode for resizable side panel with 40% width for bookmarks conversation list
      openPanel(
        bookmark.tag,
        <ConversationsPanelContent bookmarkTag={bookmark.tag} onClose={closePanel} />,
        'push',
        undefined, // no header actions
        40, // 40% width for bookmarks - provides enough space for conversation preview
      );
    }
  }, [selectedBookmark, isOpen, openPanel, closePanel]);

  const handleEdit = useCallback((bookmark: TConversationTag, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingBookmark(bookmark);
    setEditDialogOpen(true);
  }, []);

  const handleDelete = useCallback(
    (tag: string, e: React.MouseEvent) => {
      e.stopPropagation();
      deleteMutation.mutate(tag);
    },
    [deleteMutation],
  );

  const handleCreateNew = useCallback(() => {
    setEditingBookmark(undefined);
    setCreateDialogOpen(true);
  }, []);

  // Sync selected state with panel
  useEffect(() => {
    if (!isOpen && selectedBookmark) {
      setSelectedBookmark(null);
    }
  }, [isOpen, selectedBookmark]);

  return (
    <BookmarkContext.Provider value={{ bookmarks }}>
      <div className="flex h-full w-full flex-col overflow-hidden bg-presentation">
        <div
          ref={scrollContainerRef}
          className="scrollbar-gutter-stable flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-6 sm:px-6"
        >
          {/* Header section */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-tertiary">
                <Bookmark className="h-5 w-5 text-text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-text-primary sm:text-2xl">
                  {localize('com_ui_bookmarks')}
                </h1>
                <p className="text-sm text-text-secondary">
                  {processedBookmarks.length}{' '}
                  {processedBookmarks.length === 1 ? 'bookmark' : 'bookmarks'}
                </p>
              </div>
            </div>

            {/* Create new button */}
            <BookmarkEditDialog
              context="BookmarksPage"
              open={createDialogOpen}
              setOpen={setCreateDialogOpen}
            >
              <OGDialogTrigger asChild>
                <Button variant="default" className="gap-2" onClick={handleCreateNew}>
                  <BookmarkPlus className="h-4 w-4" />
                  <span className="hidden sm:inline">{localize('com_ui_bookmarks_new')}</span>
                  <span className="sm:hidden">New</span>
                </Button>
              </OGDialogTrigger>
            </BookmarkEditDialog>
          </div>

          {/* Search and View Toggle */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Search bar */}
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
              <input
                type="text"
                placeholder={localize('com_ui_bookmarks_filter')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-border-medium bg-surface-secondary py-2 pl-10 pr-4 text-sm text-text-primary placeholder-text-tertiary transition-colors focus:border-border-heavy focus:outline-none focus:ring-1 focus:ring-border-heavy"
              />
            </div>

            {/* View mode toggle */}
            <div className="flex items-center gap-1 self-start rounded-lg border border-border-light bg-surface-secondary p-1 sm:self-auto">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
                  viewMode === 'grid'
                    ? 'bg-surface-tertiary text-text-primary'
                    : 'text-text-secondary hover:text-text-primary',
                )}
              >
                <Grid3X3 className="h-4 w-4" />
                <span className="hidden sm:inline">Grid</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
                  viewMode === 'list'
                    ? 'bg-surface-tertiary text-text-primary'
                    : 'text-text-secondary hover:text-text-primary',
                )}
              >
                <List className="h-4 w-4" />
                <span className="hidden sm:inline">List</span>
              </button>
            </div>
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Spinner className="h-8 w-8" />
            </div>
          )}

          {/* Empty state */}
          {!isLoading && processedBookmarks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-tertiary">
                <Bookmark className="h-8 w-8 text-text-tertiary" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-text-primary">
                {searchQuery ? 'No bookmarks found' : localize('com_ui_no_bookmarks')}
              </h3>
              <p className="mb-6 max-w-sm text-sm text-text-secondary">
                {searchQuery
                  ? 'Try adjusting your search query'
                  : 'Create bookmarks to organize your conversations'}
              </p>
              {!searchQuery && (
                <BookmarkEditDialog
                  context="BookmarksPage"
                  open={createDialogOpen}
                  setOpen={setCreateDialogOpen}
                >
                  <OGDialogTrigger asChild>
                    <Button variant="outline" className="gap-2" onClick={handleCreateNew}>
                      <BookmarkPlus className="h-4 w-4" />
                      {localize('com_ui_bookmarks_new')}
                    </Button>
                  </OGDialogTrigger>
                </BookmarkEditDialog>
              )}
            </div>
          )}

          {/* Bookmarks grid/list */}
          {!isLoading && processedBookmarks.length > 0 && (
            <div
              className={cn(
                viewMode === 'grid'
                  ? gridClasses
                  : 'flex flex-col gap-2',
              )}
            >
              {processedBookmarks.map((bookmark, index) => (
                <BookmarkCard
                  key={bookmark._id}
                  bookmark={bookmark}
                  index={index}
                  viewMode={viewMode}
                  isSelected={selectedBookmark?._id === bookmark._id}
                  onSelect={handleSelect}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>

        {/* Edit dialog */}
        <BookmarkEditDialog
          context="BookmarksPage"
          open={editDialogOpen}
          setOpen={setEditDialogOpen}
          bookmark={editingBookmark}
        />
      </div>
    </BookmarkContext.Provider>
  );
};

export default BookmarksPage;
