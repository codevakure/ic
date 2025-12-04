/**
 * Admin Data Table Component
 * 
 * Reusable data table following the Files page pattern.
 * Uses @tanstack/react-table with Ranger styling.
 */
import * as React from 'react';
import { ListFilter, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
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
  VisibilityState,
  ColumnFiltersState,
  PaginationState,
} from '@tanstack/react-table';
import {
  Input,
  Table,
  Button,
  Spinner,
  TableRow,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@ranger/client';
import { cn } from '~/utils';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  searchPlaceholder?: string;
  searchColumn?: string;
  onRowClick?: (row: TData) => void;
  pageSize?: number;
  showColumnFilter?: boolean;
  showSearch?: boolean;
  emptyMessage?: string;
  className?: string;
  // Server-side pagination
  serverPagination?: {
    page: number;
    totalPages: number;
    total: number;
    onPageChange: (page: number) => void;
  };
}

type Style = { width?: number | string; maxWidth?: number | string; minWidth?: number | string };

export function AdminDataTable<TData, TValue>({
  columns,
  data,
  isLoading = false,
  searchPlaceholder = 'Search...',
  searchColumn,
  onRowClick,
  pageSize = 10,
  showColumnFilter = true,
  showSearch = true,
  emptyMessage = 'No results found.',
  className,
  serverPagination,
}: DataTableProps<TData, TValue>) {
  const [rowSelection, setRowSelection] = React.useState({});
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = React.useState('');
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    getPaginationRowModel: serverPagination ? undefined : getPaginationRowModel(),
    onRowSelectionChange: setRowSelection,
    onPaginationChange: serverPagination ? undefined : setPagination,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination: serverPagination ? undefined : pagination,
      globalFilter,
    },
    manualPagination: !!serverPagination,
    pageCount: serverPagination?.totalPages,
  });

  const handleSearch = (value: string) => {
    if (searchColumn) {
      table.getColumn(searchColumn)?.setFilterValue(value);
    } else {
      setGlobalFilter(value);
    }
  };

  const searchValue = searchColumn
    ? (table.getColumn(searchColumn)?.getFilterValue() as string | undefined) ?? ''
    : globalFilter;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Toolbar */}
      {(showSearch || showColumnFilter) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {showSearch && (
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
              <Input
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(event) => handleSearch(event.target.value)}
                className="border-border-medium pl-9 placeholder:text-text-secondary"
              />
              {searchValue && (
                <button
                  onClick={() => handleSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
          {showColumnFilter && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="ml-auto border border-border-medium">
                  <ListFilter className="mr-2 h-4 w-4" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="z-[1001] dark:border-gray-700 dark:bg-gray-850"
              >
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="cursor-pointer capitalize dark:text-white dark:hover:bg-gray-800"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(Boolean(value))}
                    >
                      {column.id.replace(/_/g, ' ')}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}

      {/* Table */}
      <div className="relative overflow-hidden rounded-lg border border-border-light">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface-primary/50">
            <Spinner className="h-6 w-6" />
          </div>
        )}
        <div className="max-h-[500px] overflow-auto">
          <Table className="w-full min-w-[600px] border-separate border-spacing-0">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const style: Style = { minWidth: '100px' };
                    return (
                      <TableHead
                        key={header.id}
                        className="sticky top-0 border-b border-border-medium bg-surface-primary-alt px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary"
                        style={style}
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
                    data-state={row.getIsSelected() && 'selected'}
                    onClick={() => onRowClick?.(row.original)}
                    className={cn(
                      'border-b border-border-light text-text-primary transition-colors last:border-b-0',
                      onRowClick && 'cursor-pointer hover:bg-surface-hover'
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className="px-4 py-3 text-sm"
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center text-text-secondary"
                  >
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-2">
        <div className="text-sm text-text-secondary">
          {serverPagination ? (
            <>
              Showing {Math.min((serverPagination.page - 1) * pageSize + 1, serverPagination.total)} to{' '}
              {Math.min(serverPagination.page * pageSize, serverPagination.total)} of {serverPagination.total}
            </>
          ) : (
            <>
              {table.getFilteredSelectedRowModel().rows.length} of{' '}
              {table.getFilteredRowModel().rows.length} row(s) selected.
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {serverPagination ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => serverPagination.onPageChange(serverPagination.page - 1)}
                disabled={serverPagination.page <= 1}
                className="border-border-medium"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-text-secondary">
                Page {serverPagination.page} of {serverPagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => serverPagination.onPageChange(serverPagination.page + 1)}
                disabled={serverPagination.page >= serverPagination.totalPages}
                className="border-border-medium"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="border-border-medium"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-text-secondary">
                Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="border-border-medium"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Column Header with sorting
interface SortableHeaderProps {
  column: {
    toggleSorting: (desc?: boolean) => void;
    getIsSorted: () => false | 'asc' | 'desc';
  };
  children: React.ReactNode;
}

export const SortableHeader: React.FC<SortableHeaderProps> = ({ column, children }) => {
  return (
    <button
      className="flex items-center gap-1 hover:text-text-primary"
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
    >
      {children}
      {column.getIsSorted() === 'asc' ? (
        <span className="text-xs">↑</span>
      ) : column.getIsSorted() === 'desc' ? (
        <span className="text-xs">↓</span>
      ) : (
        <span className="text-xs opacity-0">↕</span>
      )}
    </button>
  );
};
