import React, { memo, useState, useEffect, useCallback, useRef } from 'react';
import { imageExtRegex, Tools } from 'ranger-data-provider';
import type { TAttachment, TFile, TAttachmentMetadata } from 'ranger-data-provider';
import { useCodeOutputDownload } from '~/data-provider';
import { useSourcesPanel } from '~/components/ui/SidePanel';
import {
  DocPreviewPanel,
  isPreviewableFile,
  getFileType,
  createDocPreviewHeaderActions,
} from '~/components/Chat/Messages/Content/DocPreviewPanel';
import FileContainer from '~/components/Chat/Input/Files/FileContainer';
import Image from '~/components/Chat/Messages/Content/Image';
import { useAttachmentLink } from './LogLink';
import { cn } from '~/utils';

const FileAttachment = memo(({ attachment }: { attachment: Partial<TAttachment> }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { handleDownload } = useAttachmentLink({
    href: attachment.filepath ?? '',
    filename: attachment.filename ?? '',
  });
  const { openPanel, closePanel } = useSourcesPanel();
  const { refetch: fetchFile } = useCodeOutputDownload(attachment.filepath ?? '');

  const extension = attachment.filename?.split('.').pop()?.toLowerCase();
  const filename = attachment.filename ?? 'document';
  const canPreview = isPreviewableFile(filename);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const handlePreview = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!attachment.filepath || !canPreview) {
        return;
      }

      setIsLoading(true);

      try {
        const response = await fetchFile();
        if (!response.data) {
          throw new Error('No data received');
        }

        // Convert blob URL to ArrayBuffer
        const fetchResponse = await fetch(response.data);
        const blob = await fetchResponse.blob();
        const buffer = await blob.arrayBuffer();

        if (buffer.byteLength === 0) {
          throw new Error('Empty file');
        }

        const fileType = getFileType(filename);
        if (!fileType) {
          throw new Error('Unsupported file type');
        }

        // Create a callback for the panel to set header actions
        const handleSetHeaderActions = (actions: React.ReactNode) => {
          // This will be called by DocPreviewPanel on mount
          // We need to update the panel state with these actions
          openPanel(
            filename,
            <DocPreviewPanel
              fileType={fileType}
              buffer={buffer}
              filename={filename}
              onClose={closePanel}
            />,
            'push',
            actions,
            40, // 40% width for attachment preview
          );
        };

        // Open the preview panel with a callback to set header actions
        openPanel(
          filename,
          <DocPreviewPanel
            fileType={fileType}
            buffer={buffer}
            filename={filename}
            onClose={closePanel}
            onSetHeaderActions={handleSetHeaderActions}
          />,
          'push',
          undefined,
          40, // 40% width for attachment preview
        );
      } catch (error) {
        console.error('[DocPreview] Failed to load file:', error);
        // Fall back to download
        handleDownload(e as any);
      } finally {
        setIsLoading(false);
      }
    },
    [attachment.filepath, canPreview, fetchFile, filename, openPanel, closePanel, handleDownload],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (canPreview) {
        handlePreview(e);
      } else {
        handleDownload(e as any);
      }
    },
    [canPreview, handlePreview, handleDownload],
  );

  if (!attachment.filepath) {
    return null;
  }
  return (
    <div
      className={cn(
        'file-attachment-container',
        'transition-all duration-300 ease-out',
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
        isLoading && 'opacity-70 pointer-events-none',
      )}
      style={{
        transformOrigin: 'center top',
        willChange: 'opacity, transform',
        WebkitFontSmoothing: 'subpixel-antialiased',
      }}
    >
      <FileContainer
        file={attachment}
        onClick={handleClick}
        overrideType={extension}
        containerClassName="max-w-fit"
        buttonClassName="hover:cursor-pointer"
      />
    </div>
  );
});

const ImageAttachment = memo(({ attachment }: { attachment: TAttachment }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const { width, height, filepath = null } = attachment as TFile & TAttachmentMetadata;

  useEffect(() => {
    setIsLoaded(false);
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, [attachment]);

  return (
    <div
      className={cn(
        'image-attachment-container',
        'transition-all duration-500 ease-out',
        isLoaded ? 'scale-100 opacity-100' : 'scale-[0.98] opacity-0',
      )}
      style={{
        transformOrigin: 'center top',
        willChange: 'opacity, transform',
        WebkitFontSmoothing: 'subpixel-antialiased',
      }}
    >
      <Image
        altText={attachment.filename || 'attachment image'}
        imagePath={filepath ?? ''}
        height={height ?? 0}
        width={width ?? 0}
        className="mb-4"
      />
    </div>
  );
});

export default function Attachment({ attachment }: { attachment?: TAttachment }) {
  if (!attachment) {
    return null;
  }
  if (attachment.type === Tools.web_search) {
    return null;
  }

  const { width, height, filepath = null } = attachment as TFile & TAttachmentMetadata;
  const isImage = attachment.filename
    ? imageExtRegex.test(attachment.filename) && width != null && height != null && filepath != null
    : false;

  if (isImage) {
    return <ImageAttachment attachment={attachment} />;
  } else if (!attachment.filepath) {
    return null;
  }
  return <FileAttachment attachment={attachment} />;
}

export function AttachmentGroup({ attachments }: { attachments?: TAttachment[] }) {
  if (!attachments || attachments.length === 0) {
    return null;
  }

  const fileAttachments: TAttachment[] = [];
  const imageAttachments: TAttachment[] = [];

  attachments.forEach((attachment) => {
    const { width, height, filepath = null } = attachment as TFile & TAttachmentMetadata;
    const isImage = attachment.filename
      ? imageExtRegex.test(attachment.filename) &&
        width != null &&
        height != null &&
        filepath != null
      : false;

    if (isImage) {
      imageAttachments.push(attachment);
    } else if (attachment.type !== Tools.web_search) {
      fileAttachments.push(attachment);
    }
  });

  return (
    <>
      {fileAttachments.length > 0 && (
        <div className="flex flex-wrap items-center gap-2.5">
          {fileAttachments.map((attachment, index) =>
            attachment.filepath ? (
              <FileAttachment attachment={attachment} key={`file-${index}`} />
            ) : null,
          )}
        </div>
      )}
      {imageAttachments.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center">
          {imageAttachments.map((attachment, index) => (
            <ImageAttachment attachment={attachment} key={`image-${index}`} />
          ))}
        </div>
      )}
    </>
  );
}
