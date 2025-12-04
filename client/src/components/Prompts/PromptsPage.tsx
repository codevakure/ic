import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  FileText,
  Plus,
  Search,
  Grid3X3,
  List,
  Trash2,
  ChevronRight,
  Terminal,
} from 'lucide-react';
import {
  Spinner,
  Button,
  useToastContext,
  useMediaQuery,
} from '@ranger/client';
import { PermissionTypes, Permissions, PermissionBits, ResourceType } from 'ranger-data-provider';
import type { TPromptGroup } from 'ranger-data-provider';
import { useDeletePromptGroup } from '~/data-provider';
import CategoryIcon from '~/components/Prompts/Groups/CategoryIcon';
import { useSourcesPanel } from '~/components/ui/SidePanel';
import {
  useDocumentTitle,
  useLocalize,
  useLocalStorage,
  useHasAccess,
  useResourcePermissions,
} from '~/hooks';
import { usePromptGroupsContext, PromptGroupsProvider } from '~/Providers';
import CreatePromptForm from './Groups/CreatePromptForm';
import PromptEditPanel from './PromptEditPanel';
import { NotificationSeverity } from '~/common';
import { cn } from '~/utils';

type ViewMode = 'grid' | 'list';

// Color palette for prompt cards
const getPromptColor = (index: number) => {
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

interface PromptCardProps {
  group: TPromptGroup;
  index: number;
  viewMode: ViewMode;
  isSelected: boolean;
  onSelect: (group: TPromptGroup) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}

const PromptCard: React.FC<PromptCardProps> = ({
  group,
  index,
  viewMode,
  isSelected,
  onSelect,
  onDelete,
}) => {
  const { hasPermission } = useResourcePermissions(ResourceType.PROMPTGROUP, group._id || '');
  const canDelete = hasPermission(PermissionBits.DELETE);
  const hasProduction = !!group.productionId;
  const versionCount = group.numberOfGenerations || 1;

  if (viewMode === 'list') {
    return (
      <div
        onClick={() => onSelect(group)}
        className={cn(
          'group flex cursor-pointer items-center justify-between rounded-lg border px-4 py-3 transition-all',
          isSelected
            ? 'border-border-heavy bg-surface-tertiary'
            : 'border-border-light bg-surface-secondary hover:border-border-medium hover:bg-surface-hover',
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <CategoryIcon
            category={group.category || ''}
            className={cn('h-4 w-4 flex-shrink-0', isSelected ? 'text-text-primary' : 'text-text-secondary')}
          />
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="truncate font-medium text-text-primary">{group.name}</span>
            {/* Version & Production badges */}
            <div className="flex flex-shrink-0 items-center gap-1.5">
              <span className="rounded bg-surface-tertiary px-1.5 py-0.5 text-[10px] font-medium text-text-secondary">
                v{versionCount}
              </span>
              {hasProduction && (
                <span className="rounded bg-green-500/20 px-1.5 py-0.5 text-[10px] font-medium text-green-500">
                  Prod
                </span>
              )}
            </div>
            {group.command && (
              <span className="flex items-center gap-1 flex-shrink-0 text-xs text-text-tertiary">
                <Terminal className="h-3 w-3" />
                /{group.command}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => onDelete(group._id || '', e)}
                className="h-7 w-7 p-0 text-text-secondary hover:text-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <ChevronRight className={cn('h-4 w-4 transition-colors', isSelected ? 'text-text-primary' : 'text-text-tertiary')} />
        </div>
      </div>
    );
  }

  // Grid view card
  return (
    <div
      onClick={() => onSelect(group)}
      className={cn(
        'group relative flex cursor-pointer flex-col rounded-lg border bg-gradient-to-br p-4 transition-all min-h-[100px]',
        'hover:shadow-md',
        isSelected ? 'ring-2 ring-border-heavy' : '',
        getPromptColor(index),
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={cn(
          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg',
          isSelected ? 'bg-surface-tertiary' : 'bg-white/10',
        )}>
          <CategoryIcon
            category={group.category || ''}
            className={cn('h-4 w-4', isSelected ? 'text-text-primary' : 'text-text-primary')}
          />
        </div>
        <div className="flex items-center gap-1">
          {/* Version & Production badges */}
          <span className="rounded bg-black/20 px-1.5 py-0.5 text-[10px] font-medium text-white/80">
            v{versionCount}
          </span>
          {hasProduction && (
            <span className="rounded bg-green-500/30 px-1.5 py-0.5 text-[10px] font-medium text-green-300">
              Prod
            </span>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => onDelete(group._id || '', e)}
              className="h-6 w-6 p-0 text-white/60 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
      <div className="mt-2 min-w-0 flex-1">
        <h3 className="truncate text-sm font-medium text-text-primary">{group.name}</h3>
        {group.oneliner && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-secondary">{group.oneliner}</p>
        )}
        {group.command && (
          <div className="mt-2 flex items-center gap-1 text-xs text-text-tertiary">
            <Terminal className="h-3 w-3" />
            <span>/{group.command}</span>
          </div>
        )}
      </div>
    </div>
  );
};

interface CreatePromptPanelContentProps {
  onClose: () => void;
}

const CreatePromptPanelContent: React.FC<CreatePromptPanelContentProps> = ({ onClose }) => {
  const handleSuccess = useCallback((_groupId: string) => {
    onClose();
  }, [onClose]);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <CreatePromptForm
        onSuccess={handleSuccess}
        onClose={onClose}
        isPanel={true}
      />
    </div>
  );
};

interface EditPromptPanelContentProps {
  groupId: string;
  onClose: () => void;
  onHeaderActionsChange?: (actions: React.ReactNode) => void;
}

const EditPromptPanelContent: React.FC<EditPromptPanelContentProps> = ({ groupId, onClose, onHeaderActionsChange }) => {
  return <PromptEditPanel groupId={groupId} onClose={onClose} onHeaderActionsChange={onHeaderActionsChange} />;
};

/**
 * PromptsPageInner - Inner component that uses the context
 */
const PromptsPageInner: React.FC = () => {
  const params = useParams();
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { promptGroups, groupsQuery, hasAccess, name, setName } = usePromptGroupsContext();

  const [viewMode, setViewMode] = useLocalStorage<ViewMode>('promptsViewMode', 'grid');
  const [selectedGroup, setSelectedGroup] = useState<TPromptGroup | null>(null);
  const [panelType, setPanelType] = useState<'create' | 'edit' | null>(null);

  // Use the same sources panel hook as BookmarksPage
  const { openPanel, closePanel, isOpen, mode: panelMode, updateHeaderActions } = useSourcesPanel();

  // Check if panel is pushed to adjust grid layout
  const isSmallScreen = useMediaQuery('(max-width: 767px)');
  const isPanelPushed = isOpen && panelMode === 'push' && !isSmallScreen;

  // Compute grid classes based on whether panel is pushed
  const gridClasses = useMemo(() => {
    if (isPanelPushed) {
      return 'grid auto-rows-fr grid-cols-1 gap-3 xs:grid-cols-2 md:grid-cols-2 lg:grid-cols-3';
    }
    return 'grid auto-rows-fr grid-cols-1 gap-3 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';
  }, [isPanelPushed]);

  useDocumentTitle(`${localize('com_ui_prompts')} | Ranger`);

  // Handle URL param for deep linking
  useEffect(() => {
    if (params.promptId && params.promptId !== 'new' && !selectedGroup) {
      // Find the group in the list or fetch it
      const group = promptGroups.find((g) => g._id === params.promptId);
      if (group) {
        handleSelect(group);
      }
    } else if (params.promptId === 'new' && panelType !== 'create') {
      handleCreateNew();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.promptId, promptGroups]);

  const deleteMutation = useDeletePromptGroup({
    onSuccess: () => {
      showToast({
        message: localize('com_ui_delete_success'),
        severity: NotificationSeverity.SUCCESS,
      });
      if (selectedGroup) {
        setSelectedGroup(null);
        closePanel();
        setPanelType(null);
      }
    },
    onError: () => {
      showToast({
        message: localize('com_ui_prompt_update_error'),
        severity: NotificationSeverity.ERROR,
      });
    },
  });

  const handleSelect = useCallback((group: TPromptGroup) => {
    if (selectedGroup?._id === group._id && isOpen && panelType === 'edit') {
      setSelectedGroup(null);
      closePanel();
      setPanelType(null);
    } else {
      setSelectedGroup(group);
      setPanelType('edit');
      openPanel(
        group.name,
        <EditPromptPanelContent 
          groupId={group._id || ''} 
          onClose={() => {
            closePanel();
            setSelectedGroup(null);
            setPanelType(null);
          }}
          onHeaderActionsChange={updateHeaderActions}
        />,
        'push',
        undefined,
        35,
      );
    }
  }, [selectedGroup, isOpen, panelType, openPanel, closePanel, updateHeaderActions]);

  const handleDelete = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      deleteMutation.mutate({ id });
    },
    [deleteMutation],
  );

  const handleCreateNew = useCallback(() => {
    setPanelType('create');
    setSelectedGroup(null);
    openPanel(
      localize('com_ui_create_prompt'),
      <CreatePromptPanelContent onClose={() => {
        closePanel();
        setPanelType(null);
      }} />,
      'push',
      undefined,
      35,
    );
  }, [openPanel, closePanel, localize]);

  // Sync selected state with panel
  useEffect(() => {
    if (!isOpen && (selectedGroup || panelType)) {
      setSelectedGroup(null);
      setPanelType(null);
    }
  }, [isOpen, selectedGroup, panelType]);

  const isLoading = groupsQuery.isLoading;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-presentation">
      <div
        ref={scrollContainerRef}
        className="scrollbar-gutter-stable flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-6 sm:px-6"
      >
        {/* Header section */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-tertiary">
              <FileText className="h-5 w-5 text-text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-text-primary sm:text-2xl">
                {localize('com_ui_prompts')}
              </h1>
              <p className="text-sm text-text-secondary">
                {promptGroups.length}{' '}
                {promptGroups.length === 1 ? localize('com_ui_prompt') : localize('com_ui_prompts')}
              </p>
            </div>
          </div>

          {/* Create new button */}
          {hasAccess && (
            <Button variant="default" className="gap-2" onClick={handleCreateNew}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">{localize('com_ui_create_prompt')}</span>
              <span className="sm:hidden">{localize('com_ui_new')}</span>
            </Button>
          )}
        </div>

        {/* Search and View Toggle */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Search bar */}
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              placeholder={localize('com_ui_search')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-border-medium bg-surface-secondary py-2 pl-10 pr-4 text-sm text-text-primary placeholder-text-tertiary transition-colors focus:border-border-heavy focus:outline-none focus:ring-1 focus:ring-border-heavy"
            />
          </div>

          {/* View mode toggle */}
          <div className="flex items-center gap-1 self-start rounded-lg border border-border-light bg-surface-secondary p-1 sm:self-auto">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
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
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
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
        {!isLoading && promptGroups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-tertiary">
              <FileText className="h-8 w-8 text-text-tertiary" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-text-primary">
              {name ? localize('com_ui_nothing_found') : localize('com_ui_no_results_found')}
            </h3>
            <p className="mb-6 max-w-sm text-sm text-text-secondary">
              {name
                ? localize('com_ui_no_results_found')
                : localize('com_ui_create_prompt')}
            </p>
            {!name && hasAccess && (
              <Button variant="outline" className="gap-2" onClick={handleCreateNew}>
                <Plus className="h-4 w-4" />
                {localize('com_ui_create_prompt')}
              </Button>
            )}
          </div>
        )}

        {/* Prompts grid/list */}
        {!isLoading && promptGroups.length > 0 && (
          <div
            className={cn(
              viewMode === 'grid'
                ? gridClasses
                : 'flex flex-col gap-2',
            )}
          >
            {promptGroups.map((group, index) => (
              <PromptCard
                key={group._id}
                group={group}
                index={index}
                viewMode={viewMode}
                isSelected={selectedGroup?._id === group._id}
                onSelect={handleSelect}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {/* Pagination - Load more */}
        {groupsQuery.hasNextPage && (
          <div className="flex justify-center py-4">
            <Button
              variant="outline"
              onClick={() => groupsQuery.fetchNextPage()}
              disabled={groupsQuery.isFetchingNextPage}
            >
              {groupsQuery.isFetchingNextPage ? (
                <Spinner className="h-4 w-4" />
              ) : (
                'Load more'
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * PromptsPage - Standalone page for managing prompts
 * Uses useSourcesPanel hook for edit panel (same as BookmarksPage)
 */
const PromptsPage: React.FC = () => {
  const hasAccess = useHasAccess({
    permissionType: PermissionTypes.PROMPTS,
    permission: Permissions.USE,
  });

  if (!hasAccess) {
    return null;
  }

  return (
    <PromptGroupsProvider>
      <PromptsPageInner />
    </PromptGroupsProvider>
  );
};

export default PromptsPage;
