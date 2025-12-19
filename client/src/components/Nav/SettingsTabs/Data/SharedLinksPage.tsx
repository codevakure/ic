import { useCallback, useState, useMemo, useEffect } from 'react';
import debounce from 'lodash/debounce';
import { Link } from 'react-router-dom';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type {
  ColumnDef,
  SortingState,
  ColumnFiltersState,
} from '@tanstack/react-table';
import { TrashIcon, MessageSquare, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { SharedLinkItem, SharedLinksListParams } from 'ranger-data-provider';
import {
  OGDialog,
  useToastContext,
  OGDialogTemplate,
  useMediaQuery,
  Spinner,
  Button,
  Label,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ranger/client';
import { useDeleteSharedLinkMutation, useSharedLinksQuery } from '~/data-provider';
import { useLocalize } from '~/hooks';
import { NotificationSeverity } from '~/common';
import { formatDate, cn } from '~/utils';

const PAGE_SIZE = 25;

const DEFAULT_PARAMS: SharedLinksListParams = {
  pageSize: PAGE_SIZE,
  isPublic: true,
  sortBy: 'createdAt',
  sortDirection: 'desc',
  search: '',
};

type Style = {
  width?: number | string;
  maxWidth?: number | string;
  minWidth?: number | string;
};

/**
 * SharedLinksPage - Displays shared links in a table matching the Files page design
 * For use in the Profile page settings tabs
 */
export default function SharedLinksPage() {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const isSmallScreen = useMediaQuery('(max-width: 768px)');
  const [queryParams, setQueryParams] = useState<SharedLinksListParams>(DEFAULT_PARAMS);
  const [deleteRow, setDeleteRow] = useState<SharedLinkItem | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Table state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, refetch, isLoading } =
    useSharedLinksQuery(queryParams, {
      enabled: true,
      staleTime: 0,
      cacheTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
    });

  const handleFilterChange = useCallback((value: string) => {
    const encodedValue = encodeURIComponent(value.trim());
    setQueryParams((prev) => ({
      ...prev,
      search: encodedValue,
    }));
  }, []);

  const debouncedFilterChange = useMemo(
    () => debounce(handleFilterChange, 300),
    [handleFilterChange],
  );

  useEffect(() => {
    return () => {
      debouncedFilterChange.cancel();
    };
  }, [debouncedFilterChange]);

  const allLinks = useMemo(() => {
    if (!data?.pages) {
      return [];
    }

    return data.pages.flatMap((page) => page.links.filter(Boolean));
  }, [data?.pages]);

  const deleteMutation = useDeleteSharedLinkMutation({
    onSuccess: async () => {
      setIsDeleteOpen(false);
      setDeleteRow(null);
      setIsDeleting(false);
      await refetch();
    },
    onError: (error) => {
      console.error('Delete error:', error);
      setIsDeleting(false);
      showToast({
        message: localize('com_ui_share_delete_error'),
        severity: NotificationSeverity.ERROR,
      });
    },
  });

  const handleDelete = useCallback(
    async (link: SharedLinkItem) => {
      if (!link.shareId) {
        showToast({
          message: localize('com_ui_no_valid_items'),
          severity: NotificationSeverity.WARNING,
        });
        return;
      }

      setIsDeleting(true);
      try {
        await deleteMutation.mutateAsync({ shareId: link.shareId });
        showToast({
          message: localize('com_ui_shared_link_delete_success'),
          severity: NotificationSeverity.SUCCESS,
        });
      } catch (error) {
        console.error('Failed to delete shared link:', error);
      }
    },
    [deleteMutation, showToast, localize],
  );

  const confirmDelete = useCallback(() => {
    if (deleteRow) {
      handleDelete(deleteRow);
    }
  }, [deleteRow, handleDelete]);

  const columns: ColumnDef<SharedLinkItem>[] = useMemo(
    () => [
      {
        accessorKey: 'title',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              className="-ml-3 h-8 hover:bg-surface-hover"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              {localize('com_ui_name')}
              {column.getIsSorted() === 'asc' && <ArrowUp className="ml-2 h-4 w-4" />}
              {column.getIsSorted() === 'desc' && <ArrowDown className="ml-2 h-4 w-4" />}
              {!column.getIsSorted() && <ArrowUpDown className="ml-2 h-4 w-4" />}
            </Button>
          );
        },
        cell: ({ row }) => {
          const { title, shareId } = row.original;
          return (
            <Link
              to={`/share/${shareId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-blue-500 hover:underline"
              title={title}
            >
              {title || localize('com_ui_untitled')}
            </Link>
          );
        },
      },
      {
        accessorKey: 'createdAt',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              className="-ml-3 h-8 hover:bg-surface-hover"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              {localize('com_ui_date')}
              {column.getIsSorted() === 'asc' && <ArrowUp className="ml-2 h-4 w-4" />}
              {column.getIsSorted() === 'desc' && <ArrowDown className="ml-2 h-4 w-4" />}
              {!column.getIsSorted() && <ArrowUpDown className="ml-2 h-4 w-4" />}
            </Button>
          );
        },
        cell: ({ row }) => formatDate(row.original.createdAt?.toString() ?? '', isSmallScreen),
      },
      {
        id: 'actions',
        header: () => (
          <span className="text-sm font-medium text-text-secondary">
            {localize('com_assistants_actions')}
          </span>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              className="h-8 w-8 p-0 hover:bg-surface-hover"
              onClick={() => {
                window.open(`/c/${row.original.conversationId}`, '_blank');
              }}
              aria-label={`${localize('com_ui_view_source')} - ${row.original.title || localize('com_ui_untitled')}`}
            >
              <MessageSquare className="size-4 text-text-secondary" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              className="h-8 w-8 p-0 hover:bg-surface-hover"
              onClick={() => {
                setDeleteRow(row.original);
                setIsDeleteOpen(true);
              }}
              aria-label={`${localize('com_ui_delete')} - ${row.original.title || localize('com_ui_untitled')}`}
            >
              <TrashIcon className="size-4 text-red-400" aria-hidden="true" />
            </Button>
          </div>
        ),
      },
    ],
    [isSmallScreen, localize],
  );

  const table = useReactTable({
    data: allLinks,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: {
      sorting,
      columnFilters,
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="size-8" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Search - matching Files page */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder={localize('com_ui_search')}
          value={(table.getColumn('title')?.getFilterValue() as string | undefined) ?? ''}
          onChange={(event) => {
            table.getColumn('title')?.setFilterValue(event.target.value);
            debouncedFilterChange(event.target.value);
          }}
          className="h-9 flex-1 rounded-md border-border-medium bg-transparent text-sm text-text-primary transition-colors placeholder:text-text-secondary focus:border-border-heavy focus:ring-0"
        />
      </div>

      {/* Table - matching Files page styling */}
      <div className="overflow-hidden rounded-md border border-border-light">
        <Table className="w-full min-w-[300px]">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-b border-border-light hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const style: Style = {};
                  if (header.id === 'title') {
                    style.width = isSmallScreen ? '50%' : '50%';
                  } else if (header.id === 'createdAt') {
                    style.width = isSmallScreen ? '30%' : '30%';
                  } else {
                    style.width = isSmallScreen ? '20%' : '20%';
                  }

                  return (
                    <TableHead
                      key={header.id}
                      className="h-10 whitespace-nowrap px-2 text-left text-sm font-medium text-text-secondary sm:px-4"
                      style={{ ...style }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="border-b border-border-light transition-colors last:border-b-0 hover:bg-surface-hover"
                >
                  {row.getVisibleCells().map((cell) => {
                    const style: Style = {};
                    if (cell.column.id === 'title') {
                      style.maxWidth = '300px';
                    }

                    return (
                      <TableCell
                        key={cell.id}
                        className="align-start overflow-x-auto px-2 py-1 text-xs text-text-primary sm:px-4 sm:py-2 sm:text-sm"
                        style={style}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-text-secondary">
                  {localize('com_files_no_results')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination - matching Files page */}
      <div className="flex items-center justify-end gap-2 pt-2">
        <div className="ml-2 flex-1 truncate text-xs text-text-secondary sm:ml-4 sm:text-sm">
          <span>
            {table.getFilteredRowModel().rows.length} results
          </span>
        </div>
        <div className="flex items-center space-x-1 pr-2 text-xs font-bold text-text-primary sm:text-sm">
          <span className="hidden sm:inline">{localize('com_ui_page')}</span>
          <span>{table.getState().pagination.pageIndex + 1}</span>
          <span>/</span>
          <span>{table.getPageCount() || 1}</span>
        </div>
        <Button
          className="select-none border-border-medium bg-transparent hover:bg-surface-hover"
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          {localize('com_ui_prev')}
        </Button>
        <Button
          className="select-none border-border-medium bg-transparent hover:bg-surface-hover"
          variant="outline"
          size="sm"
          onClick={() => {
            if (hasNextPage && !table.getCanNextPage()) {
              fetchNextPage();
            }
            table.nextPage();
          }}
          disabled={!table.getCanNextPage() && !hasNextPage}
        >
          {isFetchingNextPage ? <Spinner className="size-4" /> : localize('com_ui_next')}
        </Button>
      </div>

      {/* Delete Confirmation Dialog */}
      <OGDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <OGDialogTemplate
          showCloseButton={false}
          title={localize('com_ui_delete_shared_link')}
          className="max-w-[450px]"
          main={
            <div className="flex w-full flex-col items-center gap-2">
              <div className="grid w-full items-center gap-2">
                <Label htmlFor="dialog-confirm-delete" className="text-left text-sm font-medium">
                  {localize('com_ui_delete_confirm')} <strong>{deleteRow?.title}</strong>
                </Label>
              </div>
            </div>
          }
          selection={{
            selectHandler: confirmDelete,
            selectClasses: cn(
              'bg-red-700 dark:bg-red-600 hover:bg-red-800 dark:hover:bg-red-800 text-white',
              isDeleting && 'cursor-not-allowed opacity-80',
            ),
            selectText: isDeleting ? <Spinner /> : localize('com_ui_delete'),
          }}
        />
      </OGDialog>
    </div>
  );
}
