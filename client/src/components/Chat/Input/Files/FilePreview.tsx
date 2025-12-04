import { FileIcon } from '@ranger/client';
import type { TFile } from 'ranger-data-provider';
import type { ExtendedFile } from '~/common';
import SourceIcon from './SourceIcon';
import { cn } from '~/utils';

const CircularLoader = ({ progress }: { progress: number }) => {
  const radius = 14;
  const stroke = 3;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - progress * circumference;

  return (
    <svg
      height={radius * 2}
      width={radius * 2}
      className="rotate-[-90deg]"
    >
      {/* Background circle */}
      <circle
        stroke="rgba(255,255,255,0.3)"
        fill="transparent"
        strokeWidth={stroke}
        r={normalizedRadius}
        cx={radius}
        cy={radius}
      />
      {/* Progress circle */}
      <circle
        stroke="#ffffff"
        fill="transparent"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference + ' ' + circumference}
        style={{ strokeDashoffset }}
        r={normalizedRadius}
        cx={radius}
        cy={radius}
        className="transition-all duration-300 ease-out"
      />
    </svg>
  );
};

const FilePreview = ({
  file,
  fileType,
  className = '',
}: {
  file?: Partial<ExtendedFile | TFile>;
  fileType: {
    paths: React.FC;
    fill: string;
    title: string;
  };
  className?: string;
}) => {
  const progress = typeof file?.['progress'] === 'number' ? file['progress'] : 1;
  const isLoading = progress < 1;
  
  return (
    <div className={cn('relative size-10 shrink-0 overflow-hidden rounded-xl', className)}>
      {/* File icon - greyscale during loading */}
      <div className={cn(
        'transition-all duration-200',
        isLoading && 'grayscale opacity-60'
      )}>
        <FileIcon file={file} fileType={fileType} />
      </div>
      <SourceIcon source={file?.source} isCodeFile={!!file?.['metadata']?.fileIdentifier} />
      {/* Circular progress loader */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-center justify-center rounded-full bg-black/50 p-0.5">
            <CircularLoader progress={progress} />
          </div>
        </div>
      )}
    </div>
  );
};

export default FilePreview;
