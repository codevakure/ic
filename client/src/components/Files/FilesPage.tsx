import React from 'react';
import { FileSources, FileContext } from 'ranger-data-provider';
import type { TFile } from 'ranger-data-provider';
import { useDocumentTitle, useLocalize } from '~/hooks';
import { useGetFiles } from '~/data-provider';
import { DataTable, columns } from '~/components/Chat/Input/Files/Table';
import { PageContainer } from '~/components/Layout';

/**
 * FilesPage - Full page component for viewing and managing files
 *
 * Modern shadcn/ui styled page for file management.
 * Uses PageContainer for consistent layout across all pages.
 */
const FilesPage: React.FC = () => {
  const localize = useLocalize();

  // Set page title
  useDocumentTitle(`${localize('com_nav_my_files')} | Ranger`);

  const { data: files = [] } = useGetFiles<TFile[]>({
    select: (files) =>
      files.map((file) => {
        file.context = file.context ?? FileContext.unknown;
        file.filterSource = file.source === FileSources.firebase ? FileSources.local : file.source;
        return file;
      }),
  });

  return (
    <PageContainer>
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
    </PageContainer>
  );
};

export default FilesPage;
