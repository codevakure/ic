import React from 'react';
import { useSetRecoilState } from 'recoil';
import { Folder } from 'lucide-react';
import { TooltipAnchor } from '@ranger/client';
import { useLocalize } from '~/hooks';
import store from '~/store';

/**
 * A colorful folder button for the chat header that opens the file explorer overlay.
 * Styled to match the Windows folder icon aesthetic.
 */
export default function FilesButton() {
  const localize = useLocalize();
  const setShowFileExplorer = useSetRecoilState(store.showFileExplorerOverlay);

  const handleClick = () => {
    setShowFileExplorer(true);
  };

  return (
    <TooltipAnchor
      description={localize('com_ui_select_from_files')}
      render={
        <button
          type="button"
          onClick={handleClick}
          className="inline-flex size-10 items-center justify-center rounded-lg border border-transparent text-sm font-medium transition-all hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-ring-primary"
          aria-label={localize('com_ui_select_from_files')}
        >
          <div className="relative">
            {/* Folder back (darker shade) */}
            <Folder 
              className="h-5 w-5" 
              style={{ 
                color: '#DBA800',
                fill: '#F5C400',
                strokeWidth: 1.5,
              }} 
            />
          </div>
        </button>
      }
    />
  );
}
