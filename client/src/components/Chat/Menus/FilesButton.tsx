import React from 'react';
import { useSetRecoilState } from 'recoil';
import { FolderOpen } from 'lucide-react';
import { TooltipAnchor, Button } from '@ranger/client';
import { useLocalize } from '~/hooks';
import store from '~/store';

/**
 * A modern folder button for the chat header that opens the file explorer overlay.
 * Styled to match the theme and other header buttons.
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
        <Button
          size="icon"
          variant="outline"
          onClick={handleClick}
          className="rounded-lg border border-border-light bg-surface-secondary p-1.5 hover:bg-surface-hover"
          aria-label={localize('com_ui_select_from_files')}
        >
          <FolderOpen className="h-5 w-5 text-text-secondary" />
        </Button>
      }
    />
  );
}
