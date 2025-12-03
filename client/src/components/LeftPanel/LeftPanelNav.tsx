import { memo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MessageSquare, FileText, LogOut, Bookmark, Bot, User, MessageSquareQuote } from 'lucide-react';
import * as Select from '@ariakit/react/select';
import { TooltipAnchor, LinkIcon, GearIcon, DropdownMenuSeparator } from '@librechat/client';
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
      </div>

      {/* Avatar at bottom */}
      <Select.SelectProvider>
        <TooltipAnchor
          description={user?.name ?? user?.username ?? localize('com_nav_user')}
          side="right"
          render={
            <Select.Select
              aria-label={localize('com_nav_account_settings')}
              data-testid="left-nav-user"
              className="flex h-7 w-7 items-center justify-center rounded-sm bg-green-600 text-[10px] font-semibold text-white transition-colors hover:bg-green-700"
            >
              {getUserInitials()}
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
          <Select.SelectItem
            value=""
            onClick={() => setShowSettings(true)}
            className="select-item text-sm"
          >
            <GearIcon className="icon-md" aria-hidden="true" />
            {localize('com_nav_settings')}
          </Select.SelectItem>
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
  );
});

LeftPanelNav.displayName = 'LeftPanelNav';

export default LeftPanelNav;
