import { memo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MessageSquare, FileText, LogOut, Bookmark, Bot, User, MessageSquareQuote, LayoutDashboard } from 'lucide-react';
import * as Select from '@ariakit/react/select';
import { TooltipAnchor, LinkIcon, GearIcon, DropdownMenuSeparator, ThemeSelector, useAvatar } from '@ranger/client';
import { SystemRoles } from 'ranger-data-provider';
import { useGetStartupConfig, useGetUserBalance } from '~/data-provider';
import { useAuthContext } from '~/hooks/AuthContext';
import { useLocalize } from '~/hooks';
import Settings from '~/components/Nav/Settings';
import { cn } from '~/utils';

interface NavItem {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
}

/**
 * Left Panel Navigation - Icon-only navigation bar
 */
const LeftPanelNav = memo(() => {
  const navigate = useNavigate();
  const location = useLocation();
  const localize = useLocalize();
  const { user, isAuthenticated, logout } = useAuthContext();
  const { data: startupConfig } = useGetStartupConfig();
  const balanceQuery = useGetUserBalance({
    enabled: !!isAuthenticated && startupConfig?.balance?.enabled,
  });
  const [showSettings, setShowSettings] = useState(false);
  const avatarSrc = useAvatar(user);

  // Define navigation items
  const navItems: NavItem[] = [
    {
      id: 'chat',
      title: 'Chat',
      icon: MessageSquare,
      path: '/c/new',
    },
    {
      id: 'agents',
      title: 'Agent Marketplace',
      icon: Bot,
      path: '/agents',
    },
    {
      id: 'prompts',
      title: 'Prompts',
      icon: MessageSquareQuote,
      path: '/prompts',
    },
    {
      id: 'files',
      title: 'My Files',
      icon: FileText,
      path: '/files',
    },
    {
      id: 'bookmarks',
      title: 'Bookmarks',
      icon: Bookmark,
      path: '/bookmarks',
    },
  ];

  const isActive = (path: string) => {
    if (path === '/c/new') {
      // Chat is active for /c/* routes
      return location.pathname.startsWith('/c/') || location.pathname === '/';
    }
    if (path === '/agents') {
      // Agents is active for /agents and /agents/:category
      return location.pathname.startsWith('/agents');
    }
    if (path === '/prompts') {
      // Prompts is active for /prompts, /prompts/:promptId, and legacy /d/prompts routes
      return location.pathname.startsWith('/prompts') || location.pathname.startsWith('/d/prompts');
    }
    return location.pathname === path;
  };

  // Get user initials for avatar
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
    <div className="flex h-full flex-col items-center justify-between py-2.5">
      {/* Navigation Items */}
      <div className="flex flex-col gap-2">
        {navItems.map((item) => (
          <TooltipAnchor
            key={item.id}
            description={item.title}
            side="right"
            render={
              <button
                onClick={() => navigate(item.path)}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
                  isActive(item.path)
                    ? 'bg-surface-tertiary text-text-primary'
                    : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                )}
              >
                <item.icon className="h-[15px] w-[15px]" />
                <span className="sr-only">{item.title}</span>
              </button>
            }
          />
        ))}
        {/* Admin Dashboard - Only for admin users */}
        {user?.role === SystemRoles.ADMIN && (
          <TooltipAnchor
            description="Admin Dashboard"
            side="right"
            render={
              <button
                onClick={() => navigate('/admin/dashboard')}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
                  location.pathname.startsWith('/admin')
                    ? 'bg-surface-tertiary text-text-primary'
                    : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                )}
              >
                <LayoutDashboard className="h-[15px] w-[15px]" />
                <span className="sr-only">Admin Dashboard</span>
              </button>
            }
          />
        )}
      </div>

      {/* Theme Toggle and Avatar at bottom */}
      <div className="flex flex-col items-center gap-2">
        {/* Theme Toggle */}
        <TooltipAnchor
          description="Toggle theme (Ctrl+Shift+T)"
          side="right"
          render={
            <div className="flex h-7 w-7 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary [&_button]:p-0 [&_svg]:h-[15px] [&_svg]:w-[15px]">
              <ThemeSelector returnThemeOnly={true} />
            </div>
          }
        />

        {/* User Avatar */}
        <Select.SelectProvider>
        <TooltipAnchor
          description={user?.name ?? user?.username ?? localize('com_nav_user')}
          side="right"
          render={
            <Select.Select
              aria-label={localize('com_nav_account_settings')}
              data-testid="left-nav-user"
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-sm text-[10px] font-semibold text-white transition-colors overflow-hidden",
                !avatarSrc && "bg-green-600 hover:bg-green-700"
              )}
            >
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt={user?.name ?? user?.username ?? 'User avatar'}
                  className="h-full w-full object-cover"
                />
              ) : (
                getUserInitials()
              )}
            </Select.Select>
          }
        />
        <Select.SelectPopover
          portal={true}
          gutter={8}
          className="popover-ui z-[200] w-[235px]"
        >
          <div className="text-token-text-secondary ml-3 mr-2 py-2 text-sm" role="note">
            {user?.email ?? localize('com_nav_user')}
          </div>
          <DropdownMenuSeparator />
          {startupConfig?.balance?.enabled === true && balanceQuery.data != null && (
            <>
              <div className="text-token-text-secondary ml-3 mr-2 py-2 text-sm" role="note">
                {localize('com_nav_balance')}:{' '}
                {new Intl.NumberFormat().format(Math.round(balanceQuery.data.tokenCredits))}
              </div>
              <DropdownMenuSeparator />
            </>
          )}
          <Select.SelectItem
            value=""
            onClick={() => navigate('/profile')}
            className="select-item text-sm"
          >
            <User className="icon-md" aria-hidden="true" />
            {localize('com_nav_profile')}
          </Select.SelectItem>
          {startupConfig?.helpAndFaqURL !== '/' && (
            <Select.SelectItem
              value=""
              onClick={() => window.open(startupConfig?.helpAndFaqURL, '_blank')}
              className="select-item text-sm"
            >
              <LinkIcon aria-hidden="true" />
              {localize('com_nav_help_faq')}
            </Select.SelectItem>
          )}
          {/* Show Settings only for SystemRoles.ADMIN role */}
          {user?.role === SystemRoles.ADMIN && (
            <Select.SelectItem
              value=""
              onClick={() => setShowSettings(true)}
              className="select-item text-sm"
            >
              <GearIcon className="icon-md" aria-hidden="true" />
              {localize('com_nav_settings')}
            </Select.SelectItem>
          )}
          {user?.role === SystemRoles.ADMIN && (
            <>
              <DropdownMenuSeparator />
              <Select.SelectItem
                value=""
                onClick={() => navigate('/admin/dashboard')}
                className="select-item text-sm"
              >
                <LayoutDashboard className="icon-md" aria-hidden="true" />
                Admin Dashboard
              </Select.SelectItem>
            </>
          )}
          <DropdownMenuSeparator />
          <Select.SelectItem
            aria-selected={true}
            onClick={() => logout()}
            value="logout"
            className="select-item text-sm"
          >
            <LogOut className="icon-md" />
            {localize('com_nav_log_out')}
          </Select.SelectItem>
        </Select.SelectPopover>
        {showSettings && <Settings open={showSettings} onOpenChange={setShowSettings} />}
      </Select.SelectProvider>
      </div>
    </div>
  );
});

LeftPanelNav.displayName = 'LeftPanelNav';

export default LeftPanelNav;
