import React from 'react';
import { FileSources, FileContext } from 'librechat-data-provider';
import type { TFile } from 'librechat-data-provider';
import { useOutletContext } from 'react-router-dom';
import { useMediaQuery } from '@librechat/client';
import { useDocumentTitle, useLocalize } from '~/hooks';
import { useGetFiles } from '~/data-provider';
import { DataTable, columns } from '~/components/Chat/Input/Files/Table';
import { OpenSidebar } from '~/components/Chat/Menus';
import type { ContextType } from '~/common';

/**
 * FilesPage - Full page component for viewing and managing files
 *
 * Modern shadcn/ui styled page for file management.
 * Uses the same layout pattern as shadcn-admin Tasks page.
 */
const FilesPage: React.FC = () => {
  const localize = useLocalize();
  const isSmallScreen = useMediaQuery('(max-width: 768px)');
  const { navVisible, setNavVisible } = useOutletContext<ContextType>();

  // Set page title
  useDocumentTitle(`${localize('com_nav_my_files')} | LibreChat`);

  const { data: files = [] } = useGetFiles<TFile[]>({
    select: (files) =>
      files.map((file) => {
        file.context = file.context ?? FileContext.unknown;
        file.filterSource = file.source === FileSources.firebase ? FileSources.local : file.source;
        return file;
      }),
  });

  return (
    <div className="relative flex h-full w-full grow overflow-hidden bg-presentation">
      <main className="flex h-full w-full flex-col overflow-hidden" role="main">
        <div className="scrollbar-gutter-stable flex h-full flex-col overflow-y-auto overflow-x-hidden">
          {/* Minimal header with sidebar toggle only */}
          {!navVisible && !isSmallScreen && (
            <div className="flex h-12 items-center px-4">
              <OpenSidebar setNavVisible={setNavVisible} />
            </div>
          )}

          {/* Main content area - matches shadcn-admin pattern */}
          <div className="flex flex-1 flex-col gap-4 px-4 py-6 sm:gap-6 sm:px-6 lg:px-8">
            {/* Header section with title and description */}
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-text-primary">
                  {localize('com_nav_my_files')}
                </h2>
                <p className="text-sm text-text-secondary">
                  Manage and organize your uploaded files and attachments.
                </p>
              </div>
            </div>

            {/* Table container - full width, takes remaining space */}
            <div className="flex-1">
              <DataTable columns={columns} data={files} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default FilesPage;
