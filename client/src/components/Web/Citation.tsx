import { memo, useState, useContext, useCallback } from 'react';
import { useRecoilValue } from 'recoil';
import { useToastContext } from '@ranger/client';
import type { CitationProps } from './types';
import { SourceHovercard, FaviconImage, getCleanDomain } from '~/components/Web/SourceHovercard';
import { CitationContext, useCitation, useCompositeCitations } from './Context';
import { useSourcesPanel } from '~/components/ui/SidePanel';
import {
  DocPreviewPanel,
  isPreviewableFile,
  getFileType,
} from '~/components/Chat/Messages/Content/DocPreviewPanel';
import { useFileDownload } from '~/data-provider';
import { useLocalize } from '~/hooks';
import store from '~/store';

interface CompositeCitationProps {
  citationId?: string;
  node?: {
    properties?: CitationProps;
  };
}

export function CompositeCitation(props: CompositeCitationProps) {
  const localize = useLocalize();
  const { citations, citationId } = props.node?.properties ?? ({} as CitationProps);
  const { setHoveredCitationId } = useContext(CitationContext);
  const [currentPage, setCurrentPage] = useState(0);
  const sources = useCompositeCitations(citations || []);

  if (!sources || sources.length === 0) return null;
  const totalPages = sources.length;

  const getCitationLabel = () => {
    if (!sources || sources.length === 0) return localize('com_citation_source');

    const firstSource = sources[0];
    const remainingCount = sources.length - 1;
    const attribution =
      firstSource.attribution ||
      firstSource.title ||
      getCleanDomain(firstSource.link || '') ||
      localize('com_citation_source');

    return remainingCount > 0 ? `${attribution} +${remainingCount}` : attribution;
  };

  const handlePrevPage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const currentSource = sources?.[currentPage];

  return (
    <SourceHovercard
      source={currentSource}
      label={getCitationLabel()}
      onMouseEnter={() => setHoveredCitationId(citationId || null)}
      onMouseLeave={() => setHoveredCitationId(null)}
    >
      {totalPages > 1 && (
        <span className="mb-2 flex items-center justify-between border-b border-border-heavy pb-2">
          <span className="flex gap-2">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 0}
              style={{ opacity: currentPage === 0 ? 0.5 : 1 }}
              className="flex cursor-pointer items-center justify-center border-none bg-transparent p-0 text-base"
            >
              ←
            </button>
            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages - 1}
              style={{ opacity: currentPage === totalPages - 1 ? 0.5 : 1 }}
              className="flex cursor-pointer items-center justify-center border-none bg-transparent p-0 text-base"
            >
              →
            </button>
          </span>
          <span className="text-xs text-text-tertiary">
            {currentPage + 1}/{totalPages}
          </span>
        </span>
      )}
      <span className="mb-2 flex items-center">
        <FaviconImage domain={getCleanDomain(currentSource.link || '')} className="mr-2" />
        <a
          href={currentSource.link}
          target="_blank"
          rel="noopener noreferrer"
          className="line-clamp-2 cursor-pointer overflow-hidden text-sm font-bold text-[#0066cc] hover:underline dark:text-blue-400 md:line-clamp-3"
        >
          {currentSource.attribution}
        </a>
      </span>
      <h4 className="mb-1.5 mt-0 text-xs text-text-primary md:text-sm">{currentSource.title}</h4>
      <p className="my-2 text-ellipsis break-all text-xs text-text-secondary md:text-sm">
        {currentSource.snippet}
      </p>
    </SourceHovercard>
  );
}

interface CitationComponentProps {
  citationId: string;
  citationType: 'span' | 'standalone' | 'composite' | 'group' | 'navlist';
  node?: {
    properties?: CitationProps;
  };
}

export function Citation(props: CitationComponentProps) {
  const localize = useLocalize();
  const user = useRecoilValue(store.user);
  const { showToast } = useToastContext();
  const { openPanel, closePanel } = useSourcesPanel();
  const { citation, citationId } = props.node?.properties ?? {};
  const { setHoveredCitationId } = useContext(CitationContext);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const refData = useCitation({
    turn: citation?.turn || 0,
    refType: citation?.refType,
    index: citation?.index || 0,
  });

  // Setup file download hook
  const isFileType = refData?.refType === 'file' && (refData as any)?.fileId;
  const isLocalFile = isFileType && (refData as any)?.metadata?.storageType === 'local';
  const fileName = isFileType ? (refData as any)?.fileName : '';
  const canPreview = isFileType && isPreviewableFile(fileName);
  
  // Get page number and content for highlighting
  const pageNumber = isFileType ? (refData as any)?.pages?.[0] : undefined;
  const chunkContent = isFileType ? (refData as any)?.content : undefined;
  
  const { refetch: downloadFile } = useFileDownload(
    user?.id ?? '',
    isFileType && !isLocalFile ? (refData as any).fileId : '',
  );

  // Handle file preview - opens DocPreviewPanel with page navigation and highlighting
  const handleFilePreview = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!isFileType || !(refData as any)?.fileId || !canPreview) return;

      if (isLocalFile) {
        showToast({
          status: 'error',
          message: localize('com_sources_download_local_unavailable'),
        });
        return;
      }

      setIsLoadingPreview(true);

      try {
        const stream = await downloadFile();
        if (stream.data == null || stream.data === '') {
          console.error('Error loading file for preview: No data found');
          showToast({
            status: 'error',
            message: localize('com_ui_download_error'),
          });
          return;
        }

        // Convert blob URL to ArrayBuffer
        const fetchResponse = await fetch(stream.data);
        const blob = await fetchResponse.blob();
        const buffer = await blob.arrayBuffer();

        if (buffer.byteLength === 0) {
          throw new Error('Empty file');
        }

        const fileType = getFileType(fileName);
        if (!fileType) {
          throw new Error('Unsupported file type');
        }

        // Get highlight text only for PDFs
        const highlightText = fileType === 'pdf' ? chunkContent : undefined;

        // Create a callback for the panel to set header actions
        const handleSetHeaderActions = (actions: React.ReactNode) => {
          openPanel(
            fileName,
            <DocPreviewPanel
              fileType={fileType}
              buffer={buffer}
              filename={fileName}
              onClose={closePanel}
              initialPage={pageNumber}
              highlightText={highlightText}
            />,
            'push',
            actions,
            40, // 40% width for document preview
          );
        };

        // Open the preview panel with initial page and highlight
        openPanel(
          fileName,
          <DocPreviewPanel
            fileType={fileType}
            buffer={buffer}
            filename={fileName}
            onClose={closePanel}
            onSetHeaderActions={handleSetHeaderActions}
            initialPage={pageNumber}
            highlightText={highlightText}
          />,
          'push',
          undefined,
          40, // 40% width for document preview
        );

        // Clean up blob URL
        window.URL.revokeObjectURL(stream.data);
      } catch (error) {
        console.error('Error loading file for preview:', error);
        showToast({
          status: 'error',
          message: localize('com_sources_download_failed'),
        });
      } finally {
        setIsLoadingPreview(false);
      }
    },
    [downloadFile, isFileType, isLocalFile, canPreview, fileName, pageNumber, chunkContent, openPanel, closePanel, localize, showToast],
  );

  // Handle file download (fallback for non-previewable files)
  const handleFileDownload = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!isFileType || !(refData as any)?.fileId) return;

      if (isLocalFile) {
        showToast({
          status: 'error',
          message: localize('com_sources_download_local_unavailable'),
        });
        return;
      }

      try {
        const stream = await downloadFile();
        if (stream.data == null || stream.data === '') {
          console.error('Error downloading file: No data found');
          showToast({
            status: 'error',
            message: localize('com_ui_download_error'),
          });
          return;
        }
        const link = document.createElement('a');
        link.href = stream.data;
        link.setAttribute('download', fileName || 'file');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(stream.data);
      } catch (error) {
        console.error('Error downloading file:', error);
        showToast({
          status: 'error',
          message: localize('com_ui_download_error'),
        });
      }
    },
    [downloadFile, isFileType, isLocalFile, fileName, localize, showToast],
  );

  // Choose handler based on whether file can be previewed
  const handleFileClick = useCallback(
    (e: React.MouseEvent) => {
      if (canPreview) {
        handleFilePreview(e);
      } else {
        handleFileDownload(e);
      }
    },
    [canPreview, handleFilePreview, handleFileDownload],
  );

  if (!refData) return null;

  const getCitationLabel = () => {
    return (
      refData.attribution ||
      refData.title ||
      getCleanDomain(refData.link || '') ||
      localize('com_citation_source')
    );
  };

  return (
    <SourceHovercard
      source={refData}
      label={getCitationLabel()}
      onMouseEnter={() => setHoveredCitationId(citationId || null)}
      onMouseLeave={() => setHoveredCitationId(null)}
      onClick={isFileType && !isLocalFile ? handleFileClick : undefined}
      isFile={isFileType}
      isLocalFile={isLocalFile}
      isLoading={isLoadingPreview}
    />
  );
}

export interface HighlightedTextProps {
  children: React.ReactNode;
  citationId?: string;
}

export function useHighlightState(citationId: string | undefined) {
  const { hoveredCitationId } = useContext(CitationContext);
  return citationId && hoveredCitationId === citationId;
}

export const HighlightedText = memo(function HighlightedText({
  children,
  citationId,
}: HighlightedTextProps) {
  const isHighlighted = useHighlightState(citationId);

  return (
    <span
      className={`rounded px-0 py-0.5 transition-colors ${isHighlighted ? 'bg-amber-300/20' : ''}`}
    >
      {children}
    </span>
  );
});
