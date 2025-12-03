import React, { useRef, useState } from 'react';
import * as Ariakit from '@ariakit/react';
import { Paperclip, FolderOpen } from 'lucide-react';
import { useSetRecoilState } from 'recoil';
import { EModelEndpoint } from 'librechat-data-provider';
import {
  FileUpload,
  TooltipAnchor,
  AttachmentIcon,
  SharePointIcon,
} from '@librechat/client';
import type { EndpointFileConfig } from 'librechat-data-provider';
import {
  useFileHandling,
  useLocalize,
} from '~/hooks';
import useSharePointFileHandling from '~/hooks/Files/useSharePointFileHandling';
import { SharePointPickerDialog } from '~/components/SharePoint';
import { useGetStartupConfig } from '~/data-provider';
import store from '~/store';
import { cn } from '~/utils';

interface AttachFileMenuProps {
  agentId?: string | null;
  endpoint?: string | null;
  disabled?: boolean | null;
  conversationId: string;
  endpointType?: EModelEndpoint;
  endpointFileConfig?: EndpointFileConfig;
}

/**
 * Simplified AttachFileMenu - Single "Add Photos & Files" option
 * 
 * Files are automatically routed based on their type:
 * - Images → Image upload (vision)
 * - Spreadsheets/Code → Code Interpreter
 * - Documents → File Search (RAG)
 * 
 * The intent analyzer in useFileHandling handles the routing automatically.
 */
const AttachFileMenu = ({
  disabled,
  endpointFileConfig,
}: AttachFileMenuProps) => {
  const localize = useLocalize();
  const isUploadDisabled = disabled ?? false;
  const inputRef = useRef<HTMLInputElement>(null);
  const { handleFileChange } = useFileHandling();
  const { handleSharePointFiles, isProcessing, downloadProgress } = useSharePointFileHandling({});
  const setShowFileExplorerOverlay = useSetRecoilState(store.showFileExplorerOverlay);

  const { data: startupConfig } = useGetStartupConfig();
  const sharePointEnabled = startupConfig?.sharePointFilePickerEnabled;

  const [isSharePointDialogOpen, setIsSharePointDialogOpen] = useState(false);

  /**
   * Handle upload click - accepts all file types
   * Intent analyzer will route them appropriately
   */
  const handleUploadClick = () => {
    if (!inputRef.current) {
      return;
    }
    inputRef.current.value = '';
    // Accept all files - intent analyzer will route them
    inputRef.current.accept = '';
    inputRef.current.click();
  };

  const handleSharePointFilesSelected = async (sharePointFiles: any[]) => {
    try {
      await handleSharePointFiles(sharePointFiles);
      setIsSharePointDialogOpen(false);
    } catch (error) {
      console.error('SharePoint file processing error:', error);
    }
  };

  // If SharePoint is enabled, show a menu with both options
  if (sharePointEnabled) {
    return (
      <>
        <FileUpload
          ref={inputRef}
          handleFileChange={(e) => {
            // No toolResource - let intent analyzer handle routing
            handleFileChange(e);
          }}
        >
          <Ariakit.MenuProvider>
            <TooltipAnchor
              render={
                <Ariakit.MenuButton
                  disabled={isUploadDisabled}
                  id="attach-file-menu-button"
                  aria-label={localize('com_ui_add_photos_files')}
                  className={cn(
                    'flex size-9 items-center justify-center rounded-full p-1 transition-colors hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50',
                  )}
                >
                  <div className="flex w-full items-center justify-center gap-2">
                    <AttachmentIcon />
                  </div>
                </Ariakit.MenuButton>
              }
              id="attach-file-menu-button"
              description={localize('com_ui_add_photos_files')}
              disabled={isUploadDisabled}
            />
            <Ariakit.Menu
              gutter={8}
              className="z-50 min-w-[200px] overflow-hidden rounded-lg border border-border-medium bg-surface-primary p-1 shadow-lg"
            >
              <Ariakit.MenuItem
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-surface-hover"
                onClick={handleUploadClick}
              >
                <Paperclip className="icon-md" />
                <span>{localize('com_ui_add_photos_files')}</span>
              </Ariakit.MenuItem>
              <Ariakit.MenuItem
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-surface-hover"
                onClick={() => setShowFileExplorerOverlay(true)}
              >
                <FolderOpen className="icon-md" />
                <span>{localize('com_ui_select_from_files')}</span>
              </Ariakit.MenuItem>
              <Ariakit.MenuItem
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-surface-hover"
                onClick={() => setIsSharePointDialogOpen(true)}
              >
                <SharePointIcon className="icon-md" />
                <span>{localize('com_files_upload_sharepoint')}</span>
              </Ariakit.MenuItem>
            </Ariakit.Menu>
          </Ariakit.MenuProvider>
        </FileUpload>
        <SharePointPickerDialog
          isOpen={isSharePointDialogOpen}
          onOpenChange={setIsSharePointDialogOpen}
          onFilesSelected={handleSharePointFilesSelected}
          isDownloading={isProcessing}
          downloadProgress={downloadProgress}
          maxSelectionCount={endpointFileConfig?.fileLimit}
        />
      </>
    );
  }

  // Menu with upload and file explorer options
  return (
    <FileUpload
      ref={inputRef}
      handleFileChange={(e) => {
        // No toolResource - let intent analyzer handle routing
        handleFileChange(e);
      }}
    >
      <Ariakit.MenuProvider>
        <TooltipAnchor
          render={
            <Ariakit.MenuButton
              disabled={isUploadDisabled}
              id="attach-file-menu-button"
              aria-label={localize('com_ui_add_photos_files')}
              className={cn(
                'flex size-9 items-center justify-center rounded-full p-1 transition-colors hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50',
                isUploadDisabled && 'cursor-not-allowed opacity-50',
              )}
            >
              <div className="flex w-full items-center justify-center gap-2">
                <AttachmentIcon />
              </div>
            </Ariakit.MenuButton>
          }
          id="attach-file-menu-button"
          description={localize('com_ui_add_photos_files')}
          disabled={isUploadDisabled}
        />
        <Ariakit.Menu
          gutter={8}
          className="z-50 min-w-[200px] overflow-hidden rounded-lg border border-border-medium bg-surface-primary p-1 shadow-lg"
        >
          <Ariakit.MenuItem
            className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-surface-hover"
            onClick={handleUploadClick}
          >
            <Paperclip className="icon-md" />
            <span>{localize('com_ui_add_photos_files')}</span>
          </Ariakit.MenuItem>
          <Ariakit.MenuItem
            className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-surface-hover"
            onClick={() => setShowFileExplorerOverlay(true)}
          >
            <FolderOpen className="icon-md" />
            <span>{localize('com_ui_select_from_files')}</span>
          </Ariakit.MenuItem>
        </Ariakit.Menu>
      </Ariakit.MenuProvider>
    </FileUpload>
  );
};

export default React.memo(AttachFileMenu);
