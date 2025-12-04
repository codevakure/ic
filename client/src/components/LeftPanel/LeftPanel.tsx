import { memo, useCallback, useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { useMediaQuery, TooltipAnchor } from '@ranger/client';
import { useLocalStorage, useLocalize } from '~/hooks';
import LeftPanelNav from './LeftPanelNav';
import MobileNavSheet from './MobileNavSheet';
import { cn } from '~/utils';

const LeftPanel = memo(() => {
  const localize = useLocalize();
  const isSmallScreen = useMediaQuery('(max-width: 767px)');
  const [isCollapsed, setIsCollapsed] = useLocalStorage('leftPanelCollapsed', false);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed(!isCollapsed);
  }, [isCollapsed, setIsCollapsed]);

  const toggleMobileSheet = useCallback(() => {
    setIsMobileSheetOpen(!isMobileSheetOpen);
  }, [isMobileSheetOpen]);

  // Render mobile sheet on small screens
  if (isSmallScreen) {
    return (
      <MobileNavSheet 
        isOpen={isMobileSheetOpen} 
        onToggle={toggleMobileSheet}
        onClose={() => setIsMobileSheetOpen(false)}
      />
    );
  }

  const Icon = isCollapsed ? ChevronRight : ChevronLeft;
  const description = isCollapsed
    ? localize('com_nav_open_sidebar') ?? 'Open sidebar'
    : localize('com_nav_close_sidebar') ?? 'Close sidebar';

  return (
    <>
      {/* Panel Content */}
      {!isCollapsed && (
        <div className="relative z-30 flex h-full min-w-[40px] flex-shrink-0 flex-col bg-background">
          {/* Top border section */}
          <div className="absolute right-0 top-0 h-[calc(50%-20px)] w-px bg-border-light" />
          {/* Bottom border section */}
          <div className="absolute bottom-0 right-0 h-[calc(50%-20px)] w-px bg-border-light" />
          <nav
            id="left-panel-nav"
            aria-label="Main navigation"
            className="flex h-full flex-col"
          >
            <LeftPanelNav />
          </nav>
        </div>
      )}

      {/* Collapse/Expand Button - Fixed positioned overlay on top of everything */}
      <TooltipAnchor
        side="right"
        description={description}
        render={
          <button
            onClick={toggleCollapse}
            className={cn(
              'fixed top-1/2 z-[101] -translate-y-1/2',
              'flex h-10 w-[8px] items-center justify-center',
              'rounded-r-lg bg-background hover:bg-surface-hover',
              'text-text-secondary hover:text-text-primary',
              'transition-colors duration-150',
              'border-y border-r border-border-light',
              isCollapsed ? 'left-0' : 'left-[40px]',
            )}
            aria-label={description}
          >
            <Icon className="h-3 w-3" strokeWidth={2} />
          </button>
        }
      />
    </>
  );
});

LeftPanel.displayName = 'LeftPanel';

export default LeftPanel;
