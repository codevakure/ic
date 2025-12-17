import { memo, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { ChevronLeft, SquarePen, Menu } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { QueryKeys, Constants } from 'librechat-data-provider';
import type { TMessage } from 'librechat-data-provider';
import { useLocalize, useNewConvo } from '~/hooks';
import { clearMessagesCache } from '~/utils';
import store from '~/store';
import { cn } from '~/utils';

interface MobileHeaderProps {
  onMenuClick?: () => void;
  showMenu?: boolean;
}

// Route to title mapping
const routeTitles: Record<string, string> = {
  '/agents': 'Agents',
  '/prompts': 'Prompts',
  '/files': 'Files',
  '/bookmarks': 'Bookmarks',
  '/profile': 'Profile',
  '/search': 'Search',
  '/conversations': 'History',
  '/admin/dashboard': 'Dashboard',
  '/admin/users': 'Users',
  '/admin/settings': 'Settings',
};

// Routes that should show back button (non-home routes)
const backButtonRoutes = [
  '/agents',
  '/prompts',
  '/files',
  '/bookmarks',
  '/profile',
  '/search',
  '/conversations',
  '/admin',
];

/**
 * MobileHeader - Top navigation bar for mobile devices
 * 
 * Features:
 * - Back button for navigation (uses browser history for native swipe-back support)
 * - Dynamic page title based on route
 * - New chat button on chat pages
 * - Clean, minimal design
 */
const MobileHeader = memo(({ onMenuClick, showMenu = false }: MobileHeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const localize = useLocalize();
  const queryClient = useQueryClient();
  const { newConversation } = useNewConvo();
  const conversation = useRecoilValue(store.conversationByIndex(0));

  // Determine if we should show the back button
  const shouldShowBack = useMemo(() => {
    return backButtonRoutes.some(route => location.pathname.startsWith(route));
  }, [location.pathname]);

  // Determine if we're on a chat page
  const isChatPage = useMemo(() => {
    return location.pathname.startsWith('/c/') || location.pathname === '/';
  }, [location.pathname]);

  // Get the page title
  const pageTitle = useMemo(() => {
    // For chat pages, show conversation title
    if (isChatPage) {
      return conversation?.title || localize('com_ui_new_chat');
    }

    // Check for exact matches first
    if (routeTitles[location.pathname]) {
      return routeTitles[location.pathname];
    }

    // Check for partial matches (for nested routes)
    for (const [route, title] of Object.entries(routeTitles)) {
      if (location.pathname.startsWith(route)) {
        return title;
      }
    }

    // For agent category pages
    if (location.pathname.startsWith('/agents/')) {
      const category = location.pathname.split('/')[2];
      if (category) {
        return category.charAt(0).toUpperCase() + category.slice(1);
      }
    }

    // For prompt detail pages
    if (location.pathname.startsWith('/prompts/')) {
      return 'Prompt Details';
    }

    return 'LibreChat';
  }, [location.pathname, isChatPage, conversation?.title, localize]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    // Use browser history for native back gesture support
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      // Fallback to home if no history
      navigate('/c/new');
    }
  }, [navigate]);

  // Handle new chat
  const handleNewChat = useCallback(() => {
    const messages = queryClient.getQueryData<TMessage[]>([
      QueryKeys.messages,
      conversation?.conversationId,
    ]);

    if (messages && messages.length > 0) {
      clearMessagesCache(queryClient, conversation?.conversationId as string);
    }
    newConversation({ modelsData: [] });
    navigate('/c/new');
  }, [queryClient, conversation?.conversationId, newConversation, navigate]);

  return (
    <header 
      className={cn(
        'sticky top-0 z-50 flex h-12 items-center justify-between',
        'bg-surface-primary/95 backdrop-blur-sm',
        'border-b border-border-light',
        'px-2 safe-area-inset-top',
        'md:hidden' // Only show on mobile (hidden on md and up)
      )}
    >
      {/* Left Section - Back Button or Menu */}
      <div className="flex w-12 items-center justify-start">
        {shouldShowBack ? (
          <button
            onClick={handleBack}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-full',
              'text-text-primary active:bg-surface-hover',
              'transition-colors duration-150'
            )}
            aria-label="Go back"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        ) : showMenu && onMenuClick ? (
          <button
            onClick={onMenuClick}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-full',
              'text-text-secondary active:bg-surface-hover',
              'transition-colors duration-150'
            )}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        ) : (
          <div className="w-9" /> // Spacer for alignment
        )}
      </div>

      {/* Center Section - Title */}
      <div className="flex flex-1 items-center justify-center overflow-hidden px-2">
        <h1 
          className={cn(
            'truncate text-base font-semibold text-text-primary',
            'max-w-[200px] text-center'
          )}
        >
          {pageTitle}
        </h1>
      </div>

      {/* Right Section - Actions */}
      <div className="flex w-12 items-center justify-end">
        {isChatPage && (
          <button
            onClick={handleNewChat}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-full',
              'text-text-secondary active:bg-surface-hover',
              'transition-colors duration-150'
            )}
            aria-label={localize('com_ui_new_chat')}
          >
            <SquarePen className="h-5 w-5" />
          </button>
        )}
      </div>
    </header>
  );
});

MobileHeader.displayName = 'MobileHeader';

export default MobileHeader;
