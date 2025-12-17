    import { memo, useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  MessageSquare, 
  FileText, 
  LogOut, 
  Bookmark, 
  Bot, 
  User, 
  MessageSquareQuote, 
  LayoutDashboard,
  X,
} from 'lucide-react';
import { ThemeSelector, useAvatar } from '@librechat/client';
import { SystemRoles } from 'librechat-data-provider';
import { useGetStartupConfig, useGetUserBalance } from '~/data-provider';
import { useAuthContext } from '~/hooks/AuthContext';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

interface NavItem {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
}

interface MobileNavSheetProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

/**
 * Mobile Navigation Sheet - Draggable BOTTOM sheet for mobile navigation
 * Features:
 * - Drag down to close (swipe down on the sheet)
 * - Tap backdrop to close
 * - Native-like spring animation
 * - No conflict with Chrome's native pull-to-refresh
 */
const MobileNavSheet = memo(({ isOpen, onToggle, onClose }: MobileNavSheetProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const localize = useLocalize();
  const { user, isAuthenticated, logout } = useAuthContext();
  const { data: startupConfig } = useGetStartupConfig();
  const balanceQuery = useGetUserBalance({
    enabled: !!isAuthenticated && startupConfig?.balance?.enabled,
  });
  const avatarSrc = useAvatar(user);

  const sheetRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragY, setDragY] = useState(0);
  const startY = useRef(0);
  const currentY = useRef(0);

  // Navigation items
  const navItems: NavItem[] = [
    { id: 'chat', title: 'Chat', icon: MessageSquare, path: '/c/new' },
    { id: 'agents', title: 'Agents', icon: Bot, path: '/agents' },
    { id: 'prompts', title: 'Prompts', icon: MessageSquareQuote, path: '/prompts' },
    { id: 'files', title: 'Files', icon: FileText, path: '/files' },
    { id: 'bookmarks', title: 'Bookmarks', icon: Bookmark, path: '/bookmarks' },
  ];

  const isActive = (path: string) => {
    if (path === '/c/new') {
      return location.pathname.startsWith('/c/') || location.pathname === '/';
    }
    if (path === '/agents') {
      return location.pathname.startsWith('/agents');
    }
    if (path === '/prompts') {
      return location.pathname.startsWith('/prompts') || location.pathname.startsWith('/d/prompts');
    }
    return location.pathname === path;
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    onClose();
  };

  // Drag handlers - only trigger from the drag handle area
  const handleDragStart = useCallback((clientY: number) => {
    setIsDragging(true);
    startY.current = clientY;
    currentY.current = clientY;
  }, []);

  const handleDragMove = useCallback((clientY: number) => {
    if (!isDragging) return;
    currentY.current = clientY;
    const deltaY = clientY - startY.current;
    // For bottom sheet: allow dragging DOWN (positive deltaY) to close
    if (isOpen && deltaY > 0) {
      setDragY(deltaY);
    }
  }, [isDragging, isOpen]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    
    const deltaY = currentY.current - startY.current;
    const threshold = 80; // pixels to trigger close
    
    if (isOpen && deltaY > threshold) {
      onClose();
    }
    
    setDragY(0);
  }, [isDragging, isOpen, onClose]);

  // Touch event handlers for drag handle only
  const handleHandleTouchStart = (e: React.TouchEvent) => {
    handleDragStart(e.touches[0].clientY);
  };

  const handleHandleTouchMove = (e: React.TouchEvent) => {
    handleDragMove(e.touches[0].clientY);
  };

  const handleHandleTouchEnd = () => {
    handleDragEnd();
  };

  // Mouse event handlers for testing on desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    handleDragStart(e.clientY);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    handleDragMove(e.clientY);
  }, [handleDragMove]);

  const handleMouseUp = useCallback(() => {
    handleDragEnd();
  }, [handleDragEnd]);

  // Add/remove mouse event listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Get user initials
  const getUserInitials = () => {
    if (user?.name) {
      const names = user.name.split(' ');
      if (names.length >= 2) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
      }
      return user.name.substring(0, 2).toUpperCase();
    }
    if (user?.username) {
      return user.username.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className={cn(
            'fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm',
            'transition-opacity duration-300',
            isDragging ? 'opacity-100' : 'opacity-100'
          )}
          onClick={onClose}
          style={{
            opacity: Math.max(0, 1 - dragY / 200),
          }}
        />
      )}

      {/* Sheet - Now from BOTTOM */}
      <div
        ref={sheetRef}
        className={cn(
          'fixed left-0 right-0 bottom-0 z-[101]',
          'bg-surface-primary rounded-t-2xl shadow-xl',
          'border-t border-x border-border-light',
          'transform transition-transform',
          isDragging ? 'duration-0' : 'duration-300 ease-out',
          !isOpen && !isDragging && 'translate-y-full'
        )}
        style={{
          transform: isOpen 
            ? `translateY(${dragY}px)` 
            : 'translateY(100%)',
          maxHeight: '80vh',
        }}
      >
        {/* Drag Handle - Touch events only on handle */}
        <div
          className="flex items-center justify-center py-3 cursor-grab active:cursor-grabbing touch-none"
          onMouseDown={handleMouseDown}
          onTouchStart={handleHandleTouchStart}
          onTouchMove={handleHandleTouchMove}
          onTouchEnd={handleHandleTouchEnd}
        >
          <div className="w-10 h-1 rounded-full bg-text-tertiary/50" />
        </div>

        {/* Navigation Grid */}
        <div className="px-4 pb-4">
          <div className="grid grid-cols-5 gap-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavigation(item.path)}
                className={cn(
                  'flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl',
                  'transition-all duration-150 active:scale-95',
                  isActive(item.path)
                    ? 'bg-surface-tertiary text-text-primary'
                    : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.title}</span>
              </button>
            ))}
          </div>

          {/* Admin Dashboard - Only for admin users */}
          {user?.role === SystemRoles.ADMIN && (
            <div className="mt-3 pt-3 border-t border-border-light">
              <button
                onClick={() => handleNavigation('/admin/dashboard')}
                className={cn(
                  'flex items-center gap-3 w-full p-3 rounded-xl',
                  'transition-all duration-150 active:scale-[0.98]',
                  location.pathname.startsWith('/admin')
                    ? 'bg-surface-tertiary text-text-primary'
                    : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                )}
              >
                <LayoutDashboard className="h-5 w-5" />
                <span className="text-sm font-medium">Admin Dashboard</span>
              </button>
            </div>
          )}

          {/* User Section */}
          <div className="mt-3 pt-3 border-t border-border-light">
            <div className="flex items-center justify-between">
              {/* User Info */}
              <button
                onClick={() => handleNavigation('/profile')}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-hover transition-colors"
              >
                <div className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white overflow-hidden",
                  !avatarSrc && "bg-green-600"
                )}>
                  {avatarSrc ? (
                    <img
                      src={avatarSrc}
                      alt={user?.name ?? user?.username ?? 'User avatar'}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    getUserInitials()
                  )}
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-text-primary">
                    {user?.name || user?.username || 'User'}
                  </p>
                  <p className="text-xs text-text-tertiary truncate max-w-[150px]">
                    {user?.email}
                  </p>
                </div>
              </button>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {/* Theme Toggle */}
                <div className="flex h-9 w-9 items-center justify-center rounded-xl text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors [&_button]:p-0 [&_svg]:h-5 [&_svg]:w-5">
                  <ThemeSelector returnThemeOnly={true} />
                </div>

                {/* Logout */}
                <button
                  onClick={() => {
                    logout();
                    onClose();
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-text-secondary hover:bg-red-500/10 hover:text-red-500 transition-colors"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Balance Display */}
            {startupConfig?.balance?.enabled === true && balanceQuery.data != null && (
              <div className="mt-2 px-2 py-1.5 rounded-lg bg-surface-secondary">
                <p className="text-xs text-text-tertiary">
                  {localize('com_nav_balance')}:{' '}
                  <span className="font-medium text-text-primary">
                    {new Intl.NumberFormat().format(Math.round(balanceQuery.data.tokenCredits))}
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Safe area padding for notched phones */}
        <div className="h-safe-area-inset-bottom" />
      </div>
    </>
  );
});

MobileNavSheet.displayName = 'MobileNavSheet';

export default MobileNavSheet;
