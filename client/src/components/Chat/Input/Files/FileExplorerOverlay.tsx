import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Search, ChevronDown, Check, Grid3X3, List, ExternalLink } from 'lucide-react';
import * as Ariakit from '@ariakit/react';
import {
  Button,
  FileIcon,
  useToastContext,
} from '@librechat/client';
import {
  fileConfig as defaultFileConfig,
  checkOpenAIStorage,
  mergeFileConfig,
  megabyte,
  isAssistantsEndpoint,
  getEndpointFileConfig,
  type TFile,
} from 'librechat-data-provider';
import { useFileMapContext, useChatContext } from '~/Providers';
import { useGetFiles, useGetFileConfig } from '~/data-provider';
import { useLocalize, useUpdateFiles } from '~/hooks';
import { formatDate, getFileType, cn } from '~/utils';
type ViewMode = 'grid' | 'list';
type SortDirection = 'asc' | 'desc';
type FileTypeFilter = 'all' | 'documents' | 'images' | 'code' | 'spreadsheets';

interface FileExplorerOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const FILE_TYPE_FILTERS: Record<FileTypeFilter, { label: string; extensions: string[] }> = {
  all: { label: 'All Types', extensions: [] },
  documents: { label: 'Documents', extensions: ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'] },
  images: { label: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'] },
  code: { label: 'Code', extensions: ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'go', 'rs', 'rb', 'php', 'html', 'css', 'json', 'xml', 'yaml', 'yml', 'md'] },
  spreadsheets: { label: 'Spreadsheets', extensions: ['xlsx', 'xls', 'csv', 'ods'] },
};

const getFileExtension = (filename: string): string => {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export default function FileExplorerOverlay({ isOpen, onClose }: FileExplorerOverlayProps) {
  const localize = useLocalize();
  const navigate = useNavigate();
  const overlayRef = useRef<HTMLDivElement>(null);
  const { data: files = [] } = useGetFiles<TFile[]>();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [fileTypeFilter, setFileTypeFilter] = useState<FileTypeFilter>('all');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const fileMap = useFileMapContext();
  const { showToast } = useToastContext();
  const { conversation, setFiles } = useChatContext();
  const { data: fileConfig } = useGetFileConfig({
    select: (data) => mergeFileConfig(data),
  });
  const { addFile } = useUpdateFiles(setFiles);

  // Reset state when overlay opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      const timer = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);
      return () => {
        clearTimeout(timer);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen, onClose]);

  const handleFileClick = useCallback(
    (file: TFile) => {
      if (!fileMap?.[file.file_id] || !conversation?.endpoint) {
        showToast({
          message: localize('com_ui_attach_error'),
          status: 'error',
        });
        return;
      }

      const fileData = fileMap[file.file_id];
      const endpoint = conversation.endpoint;
      const endpointType = conversation.endpointType;

      if (!fileData.source) {
        return;
      }

      const isOpenAIStorage = checkOpenAIStorage(fileData.source);
      const isAssistants = isAssistantsEndpoint(endpoint);

      if (isOpenAIStorage && !isAssistants) {
        showToast({
          message: localize('com_ui_attach_error_openai'),
          status: 'error',
        });
        return;
      }

      if (!isOpenAIStorage && isAssistants) {
        showToast({
          message: localize('com_ui_attach_warn_endpoint'),
          status: 'warning',
        });
      }

      const endpointFileConfig = getEndpointFileConfig({
        fileConfig,
        endpoint,
        endpointType,
      });

      if (endpointFileConfig.disabled === true) {
        showToast({
          message: localize('com_ui_attach_error_disabled'),
          status: 'error',
        });
        return;
      }

      if (fileData.bytes > (endpointFileConfig.fileSizeLimit ?? Number.MAX_SAFE_INTEGER)) {
        showToast({
          message: `${localize('com_ui_attach_error_size')} ${
            (endpointFileConfig.fileSizeLimit ?? 0) / megabyte
          } MB (${endpoint})`,
          status: 'error',
        });
        return;
      }

      if (!defaultFileConfig.checkType(file.type, endpointFileConfig.supportedMimeTypes ?? [])) {
        showToast({
          message: `${localize('com_ui_attach_error_type')} ${file.type} (${endpoint})`,
          status: 'error',
        });
        return;
      }

      addFile({
        progress: 1,
        attached: true,
        file_id: fileData.file_id,
        filepath: fileData.filepath,
        preview: fileData.filepath,
        type: fileData.type,
        height: fileData.height,
        width: fileData.width,
        filename: fileData.filename,
        source: fileData.source,
        size: fileData.bytes,
        metadata: fileData.metadata,
      });

      showToast({
        message: `${fileData.filename} attached`,
        status: 'success',
      });
    },
    [addFile, fileMap, conversation, localize, showToast, fileConfig],
  );

  // Filter and sort files
  const filteredFiles = useMemo(() => {
    let result = [...files];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(file => 
        file.filename.toLowerCase().includes(query)
      );
    }

    // Apply type filter
    if (fileTypeFilter !== 'all') {
      const extensions = FILE_TYPE_FILTERS[fileTypeFilter].extensions;
      result = result.filter(file => {
        const ext = getFileExtension(file.filename);
        return extensions.includes(ext);
      });
    }

    // Apply sorting by date
    result.sort((a, b) => {
      const comparison = new Date(a.updatedAt ?? 0).getTime() - new Date(b.updatedAt ?? 0).getTime();
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [files, searchQuery, fileTypeFilter, sortDirection]);

  if (!isOpen) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 z-50 mb-2">
      <div
        ref={overlayRef}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className="mx-auto max-w-2xl overflow-hidden rounded-xl bg-surface-primary shadow-2xl"
        style={{ boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
              <path d="M3 7C3 5.89543 3.89543 5 5 5H9.58579C9.851 5 10.1054 5.10536 10.2929 5.29289L12 7H19C20.1046 7 21 7.89543 21 9V17C21 18.1046 20.1046 19 19 19H5C3.89543 19 3 18.1046 3 17V7Z" fill="#F5C400" stroke="#DBA800" strokeWidth="1"/>
            </svg>
            <span className="text-sm font-medium text-text-primary">Attach Files</span>
            <span className="rounded-full bg-surface-tertiary px-1.5 py-0.5 text-[10px] text-text-tertiary">{files.length} files</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                onClose();
                navigate('/files');
              }}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
              title={localize('com_sidepanel_manage_files')}
            >
              <ExternalLink className="h-3 w-3" />
              <span>{localize('com_sidepanel_manage_files')}</span>
            </button>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 px-3 py-2">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              placeholder="Filter files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-full rounded-lg bg-surface-tertiary pl-8 pr-3 text-sm text-text-primary placeholder-text-tertiary outline-none transition-all focus:ring-2 focus:ring-blue-500/50"
            />
          </div>

          {/* Type Filter Dropdown */}
          <Ariakit.MenuProvider>
            <Ariakit.MenuButton className="flex h-8 items-center gap-1 rounded-lg bg-surface-tertiary px-2.5 text-xs text-text-secondary transition-colors hover:bg-surface-hover">
              <span>{FILE_TYPE_FILTERS[fileTypeFilter].label}</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Ariakit.MenuButton>
            <Ariakit.Menu
              gutter={4}
              className="z-[60] min-w-[130px] overflow-hidden rounded-lg bg-surface-primary p-1 shadow-xl"
              style={{ boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)' }}
            >
              {(Object.keys(FILE_TYPE_FILTERS) as FileTypeFilter[]).map((key) => (
                <Ariakit.MenuItem
                  key={key}
                  onClick={() => setFileTypeFilter(key)}
                  className="flex cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                >
                  <span>{FILE_TYPE_FILTERS[key].label}</span>
                  {fileTypeFilter === key && <Check className="h-3 w-3 text-blue-500" />}
                </Ariakit.MenuItem>
              ))}
            </Ariakit.Menu>
          </Ariakit.MenuProvider>

          {/* Sort Toggle */}
          <button
            onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-tertiary text-text-secondary transition-colors hover:bg-surface-hover"
            title={sortDirection === 'asc' ? 'Oldest first' : 'Newest first'}
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {sortDirection === 'desc' ? (
                <path d="M3 4h13M3 8h9M3 12h5M17 8v8M14 13l3 3 3-3" />
              ) : (
                <path d="M3 4h13M3 8h9M3 12h5M17 16V8M14 11l3-3 3 3" />
              )}
            </svg>
          </button>

          {/* View Mode Toggle */}
          <div className="flex h-8 overflow-hidden rounded-lg bg-surface-tertiary">
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'flex w-8 items-center justify-center transition-colors',
                viewMode === 'list' ? 'bg-blue-500 text-white' : 'text-text-secondary hover:bg-surface-hover'
              )}
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'flex w-8 items-center justify-center transition-colors',
                viewMode === 'grid' ? 'bg-blue-500 text-white' : 'text-text-secondary hover:bg-surface-hover'
              )}
            >
              <Grid3X3 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* File List */}
        <div className="max-h-[260px] overflow-y-auto">
          {filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-text-tertiary">
              <svg className="mb-2 h-8 w-8 opacity-40" viewBox="0 0 24 24" fill="none">
                <path d="M3 7C3 5.89543 3.89543 5 5 5H9.58579C9.851 5 10.1054 5.10536 10.2929 5.29289L12 7H19C20.1046 7 21 7.89543 21 9V17C21 18.1046 20.1046 19 19 19H5C3.89543 19 3 18.1046 3 17V7Z" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
              <p className="text-xs">
                {files.length === 0 ? 'No files uploaded yet' : 'No files match your filter'}
              </p>
            </div>
          ) : viewMode === 'list' ? (
            <div>
              {filteredFiles.map((file) => (
                <div
                  key={file.file_id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFileClick(file);
                  }}
                  className="group flex cursor-pointer items-center gap-3 px-4 py-2 transition-colors hover:bg-surface-hover"
                >
                  <div className="h-8 w-8 flex-shrink-0">
                    <FileIcon file={file} fileType={getFileType(file.type)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-text-primary">{file.filename}</p>
                    <p className="text-[11px] text-text-tertiary">
                      {formatFileSize(file.bytes)} • {file.updatedAt instanceof Date 
                        ? formatDate(file.updatedAt.toISOString()) 
                        : formatDate(file.updatedAt ?? '')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-6 gap-2 p-3">
              {filteredFiles.map((file) => (
                <div
                  key={file.file_id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFileClick(file);
                  }}
                  className="group flex cursor-pointer flex-col items-center gap-1.5 rounded-lg p-2 transition-colors hover:bg-surface-hover"
                >
                  <div className="h-10 w-10">
                    <FileIcon file={file} fileType={getFileType(file.type)} />
                  </div>
                  <p className="line-clamp-2 w-full text-center text-[10px] leading-tight text-text-primary">{file.filename}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Hint */}
        <div className="px-4 py-2">
          <p className="text-center text-[11px] text-text-tertiary">
            Click a file to attach it to your message
          </p>
        </div>
      </div>
    </div>
  );
}
