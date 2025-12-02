import { useState } from 'react';
import { ListFilter } from 'lucide-react';
import { useSetRecoilState } from 'recoil';
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
} from '@tanstack/react-table';
import { FileContext } from 'ranger-data-provider';
import {
  Button,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  TrashIcon,
  Spinner,
  useMediaQuery,
} from '@ranger/client';
import type { TFile } from 'ranger-data-provider';
import type { AugmentedColumnDef } from '~/common';
import { useDeleteFilesFromTable } from '~/hooks/Files';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';
import store from '~/store';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
}

const contextMap = {
  [FileContext.filename]: 'com_ui_name',
  [FileContext.updatedAt]: 'com_ui_date',
  [FileContext.filterSource]: 'com_ui_storage',
  [FileContext.context]: 'com_ui_context',
  [FileContext.bytes]: 'com_ui_size',
};

type Style = {
  width?: number | string;
  maxWidth?: number | string;
  minWidth?: number | string;
  zIndex?: number;
};

export default function DataTable<TData, TValue>({ columns, data }: DataTableProps<TData, TValue>) {
  const localize = useLocalize();
  const [isDeleting, setIsDeleting] = useState(false);
  const setFiles = useSetRecoilState(store.filesByIndex(0));
  const { deleteFiles } = useDeleteFilesFromTable(() => setIsDeleting(false));

  const [rowSelection, setRowSelection] = useState({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const isSmallScreen = useMediaQuery('(max-width: 768px)');
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    getPaginationRowModel: getPaginationRowModel(),
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          onClick={() => {
            setIsDeleting(true);
            const filesToDelete = table
              .getFilteredSelectedRowModel()
              .rows.map((row) => row.original);
            deleteFiles({ files: filesToDelete as TFile[], setFiles });
            setRowSelection({});
          }}
          disabled={!table.getFilteredSelectedRowModel().rows.length || isDeleting}
          className={cn(
            'min-w-[40px] border-border-medium bg-transparent transition-all duration-200 hover:bg-surface-hover',
            isSmallScreen && 'px-2 py-1',
          )}
        >
          {isDeleting ? (
            <Spinner className="size-3.5 sm:size-4" />
          ) : (
            <TrashIcon className="size-3.5 text-red-400 sm:size-4" />
          )}
          {!isSmallScreen && <span className="ml-2">{localize('com_ui_delete')}</span>}
        </Button>
        <Input
          placeholder={localize('com_files_filter')}
          value={(table.getColumn('filename')?.getFilterValue() as string | undefined) ?? ''}
          onChange={(event) => table.getColumn('filename')?.setFilterValue(event.target.value)}
          className="h-9 flex-1 rounded-md border-border-medium bg-transparent text-sm text-text-primary transition-colors placeholder:text-text-secondary focus:border-border-heavy focus:ring-0"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              aria-label={localize('com_files_filter_by')}
              className={cn(
                'min-w-[40px] border-border-medium bg-transparent hover:bg-surface-hover',
                isSmallScreen && 'px-2 py-1',
              )}
            >
              <ListFilter className="size-3.5 text-text-secondary sm:size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="max-h-[300px] overflow-y-auto border-border-medium bg-surface-primary"
          >
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  className="cursor-pointer text-sm capitalize text-text-primary hover:bg-surface-hover"
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(Boolean(value))}
                >
                  {localize(contextMap[column.id])}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="overflow-hidden rounded-md border border-border-light">
        <Table className="w-full min-w-[300px]">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-b border-border-light hover:bg-transparent">
                {headerGroup.headers.map((header, index) => {
                  const style: Style = {};
                  if (index === 0 && header.id === 'select') {
                    style.width = '35px';
                    style.minWidth = '35px';
                  } else if (header.id === 'filename') {
                    style.width = isSmallScreen ? '60%' : '40%';
                  } else {
                    style.width = isSmallScreen ? '20%' : '15%';
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
                  data-state={row.getIsSelected() && 'selected'}
                  className="border-b border-border-light transition-colors last:border-b-0 hover:bg-surface-hover data-[state=selected]:bg-surface-hover"
                >
                  {row.getVisibleCells().map((cell, index) => {
                    const maxWidth =
                      (cell.column.columnDef as AugmentedColumnDef<TData, TValue>).meta?.size ??
                      'auto';

                    const style: Style = {};
                    if (cell.column.id === 'filename') {
                      style.maxWidth = maxWidth;
                    } else if (index === 0) {
                      style.maxWidth = '20px';
                    }

                    return (
                      <TableCell
                        key={cell.id}
                        className="align-start overflow-x-auto px-2 py-1 text-xs text-text-primary sm:px-4 sm:py-2 sm:text-sm [tr[data-disabled=true]_&]:opacity-50"
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

      <div className="flex items-center justify-end gap-2 pt-2">
        <div className="ml-2 flex-1 truncate text-xs text-text-secondary sm:ml-4 sm:text-sm">
          <span className="hidden sm:inline">
            {localize('com_files_number_selected', {
              0: `${table.getFilteredSelectedRowModel().rows.length}`,
              1: `${table.getFilteredRowModel().rows.length}`,
            })}
          </span>
          <span className="sm:hidden">
            {`${table.getFilteredSelectedRowModel().rows.length}/${
              table.getFilteredRowModel().rows.length
            }`}
          </span>
        </div>
        <div className="flex items-center space-x-1 pr-2 text-xs font-bold text-text-primary sm:text-sm">
          <span className="hidden sm:inline">{localize('com_ui_page')}</span>
          <span>{table.getState().pagination.pageIndex + 1}</span>
          <span>/</span>
          <span>{table.getPageCount()}</span>
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
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          {localize('com_ui_next')}
        </Button>
      </div>
    </div>
  );
}
