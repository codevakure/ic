import React, { forwardRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useMediaQuery } from '@librechat/client';
import { OpenSidebar } from '~/components/Chat/Menus';
import type { ContextType } from '~/common';
import { cn } from '~/utils';

interface PageContainerProps {
  children: React.ReactNode;
  /** Optional additional class names for the content area */
  className?: string;
  /** Optional header content to show alongside the sidebar toggle */
  headerContent?: React.ReactNode;
}

/**
 * PageContainer - Common layout container for all full-page views
 *
 * Provides consistent spacing and layout across:
 * - /conversations
 * - /agents
 * - /files
 * - Any future pages
 *
 * Features:
 * - Consistent header height (h-12) with sidebar toggle
 * - Consistent padding (px-6 pb-5)
 * - Scrollable content area
 */
const PageContainer = forwardRef<HTMLDivElement, PageContainerProps>(
  ({ children, className, headerContent }, ref) => {
    const isSmallScreen = useMediaQuery('(max-width: 768px)');
    const { navVisible, setNavVisible } = useOutletContext<ContextType>();

    return (
      <div className="relative flex h-full w-full grow overflow-hidden bg-presentation">
        <main className="flex h-full w-full flex-col overflow-hidden" role="main">
          <div
            ref={ref}
            className="scrollbar-gutter-stable flex h-full flex-col overflow-y-auto overflow-x-hidden"
          >
            {/* Header with sidebar toggle - only show when sidebar is collapsed */}
            {!navVisible && !isSmallScreen && (
              <div className="flex h-12 flex-shrink-0 items-center px-4">
                <div className="flex items-center gap-2">
                  <OpenSidebar setNavVisible={setNavVisible} />
                  {headerContent}
                </div>
              </div>
            )}

            {/* Main content area with consistent padding */}
            <div className={cn('flex flex-1 flex-col gap-6 px-6 pb-5 pt-6', className)}>
              {children}
            </div>
          </div>
        </main>
      </div>
    );
  },
);

PageContainer.displayName = 'PageContainer';

export default PageContainer;
