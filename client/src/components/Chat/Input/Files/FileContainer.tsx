import type { TFile } from 'librechat-data-provider';
import type { ExtendedFile } from '~/common';
import { Watermark } from '~/components/ui/Watermark';
import { getFileType, cn } from '~/utils';
import FilePreview from './FilePreview';
import RemoveFile from './RemoveFile';

const FileContainer = ({
  file,
  overrideType,
  buttonClassName,
  containerClassName,
  onDelete,
  onClick,
}: {
  file: Partial<ExtendedFile | TFile>;
  overrideType?: string;
  buttonClassName?: string;
  containerClassName?: string;
  onDelete?: () => void;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}) => {
  const fileType = getFileType(overrideType ?? file.type);

  return (
    <div
      className={cn('group relative inline-block text-sm text-text-primary mb-2', containerClassName)}
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={file.filename}
        className={cn(
          'relative overflow-hidden rounded-lg border border-border-light bg-surface-hover-alt',
          buttonClassName,
        )}
      >
        <div className="w-56 p-1.5 relative">
          <div className="flex flex-row items-center gap-2">
            <FilePreview file={file} fileType={fileType} className="relative" />
            <div className="overflow-hidden">
              <div className="truncate font-medium" title={file.filename}>
                {file.filename}
              </div>
              <div className="truncate text-text-secondary" title={fileType.title}>
                {fileType.title}
              </div>
            </div>
          </div>
          {/* Watermark positioned bottom-right like artifacts */}
          <div className="absolute right-1 -bottom-3 pointer-events-none">
            <Watermark 
              width={36} 
              height={36} 
              className="opacity-30 group-hover:opacity-50 transition-opacity duration-200"
            />
          </div>
        </div>
      </button>
      {onDelete && <RemoveFile onRemove={onDelete} />}
    </div>
  );
};

export default FileContainer;
