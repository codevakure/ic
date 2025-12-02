import type { TFile } from 'ranger-data-provider';
import type { ExtendedFile } from '~/common';

export default function FileIcon({
  file,
  fileType,
}: {
  file?: Partial<ExtendedFile | TFile>;
  fileType: {
    fill: string;
    paths: React.FC;
    title: string;
  };
}) {
  const isTransparent = fileType.fill === 'transparent';
  const progress = file?.['progress'] ?? 1;
  const isLoaded = progress >= 1;
  
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 36 36"
      fill="none"
      className="h-10 w-10 flex-shrink-0"
      width="36"
      height="36"
    >
      {!isTransparent && <rect width="36" height="36" rx="6" fill={fileType.fill} />}
      {/* Show icon immediately for transparent backgrounds, wait for loading for colored backgrounds */}
      {(isTransparent || isLoaded) && <fileType.paths className="w-full h-full" />}
    </svg>
  );
}
