import type { TFile } from 'ranger-data-provider';
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
      className={cn('group relative inline-block text-sm text-text-primary max-w-xs', containerClassName)}
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={file.filename}
        className={cn(
          'w-full relative overflow-hidden rounded-xl border border-border-medium transition-all duration-300 hover:shadow-lg hover:shadow-black/10 dark:hover:shadow-white/10 bg-transparent mb-2',
          buttonClassName,
        )}
      >
        <div className="w-full p-4 pr-20 relative">
          <div className="flex flex-row items-center justify-between gap-4 relative">
            {/* Left section with icon and content */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex-shrink-0">
                <FilePreview file={file} fileType={fileType} className="relative" />
              </div>
              
              <div className="flex-1 overflow-hidden text-left">
                <div className="truncate font-semibold text-text-primary" title={file.filename}>
                  {file.filename}
                </div>
                <div className="truncate text-text-secondary text-sm" title={fileType.title}>
                  {fileType.title}
                </div>
              </div>
            </div>
            
            {/* Watermark logo on the right - positioned towards bottom like artifact panel */}
            <div className="absolute -right-16 top-[70%] -translate-y-[30%]">
              <Watermark 
                width={80} 
                height={80} 
                className="opacity-50 group-hover:opacity-80 transition-all duration-300 group-hover:scale-110"
              />
            </div>
          </div>
        </div>
      </button>
      {onDelete && <RemoveFile onRemove={onDelete} />}
    </div>
  );
};

export default FileContainer;
