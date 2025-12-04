import { memo, useCallback, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, UserCheck, Settings, ChevronLeft, ChevronRight, Sun, Moon, Shield, DollarSign, Bot, Activity } from 'lucide-react';
import { TooltipAnchor, ThemeContext } from '@ranger/client';
import { cn } from '~/utils';

interface NavItem {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
}

const navItems: NavItem[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: LayoutDashboard,
    path: '/admin/dashboard',
  },
  {
    id: 'traces',
    title: 'LLM Traces',
    icon: Activity,
    path: '/admin/traces',
  },
  {
    id: 'active-users',
    title: 'Active Users',
    icon: UserCheck,
    path: '/admin/users/active',
  },
  {
    id: 'users',
    title: 'All Users',
    icon: Users,
    path: '/admin/users',
  },
  {
    id: 'costs',
    title: 'Costs',
    icon: DollarSign,
    path: '/admin/costs',
  },
  {
    id: 'agents',
    title: 'Agents',
    icon: Bot,
    path: '/admin/agents',
  },
  {
    id: 'roles',
    title: 'Roles',
    icon: Shield,
    path: '/admin/roles',
  },
  {
    id: 'settings',
    title: 'Settings',
    icon: Settings,
    path: '/admin/settings',
  },
];

interface AdminSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onMobileClose?: () => void;
  isMobile?: boolean;
}

const ThemeToggle = memo(() => {
  const { theme, setTheme } = useContext(ThemeContext);
  
  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return (
    <TooltipAnchor
      description={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      side="right"
      render={
        <button
          onClick={toggleTheme}
          className="flex h-7 w-7 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
        >
          {theme === 'dark' ? (
            <Sun className="h-[15px] w-[15px]" />
          ) : (
            <Moon className="h-[15px] w-[15px]" />
          )}
        </button>
      }
    />
  );
});

ThemeToggle.displayName = 'ThemeToggle';

const AdminSidebar = memo(({ isCollapsed, onToggleCollapse, onMobileClose, isMobile }: AdminSidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useContext(ThemeContext);

  const handleNavClick = (path: string) => {
    navigate(path);
    if (isMobile && onMobileClose) {
      onMobileClose();
    }
  };

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  // Use theme-appropriate branding logo
  const isDark = theme === 'dark';
  const logoSrc = isDark 
    ? '/assets/branding-logo-dark.svg' 
    : '/assets/branding-logo-lite.svg';

  // On mobile, always show expanded sidebar
  const effectiveCollapsed = isMobile ? false : isCollapsed;

  return (
    <div
      className={cn(
        'flex h-full flex-shrink-0 flex-col bg-surface-primary-alt',
        effectiveCollapsed ? 'w-[50px]' : 'w-[260px]'
      )}
    >
      {/* Header - Logo and Collapse Toggle */}
      <div className="flex h-14 items-center border-b border-border-light px-2">
        {/* Close button on mobile */}
        {isMobile && onMobileClose && (
          <button
            onClick={onMobileClose}
            className="flex md:hidden h-8 w-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary mr-2"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        
        {/* Collapse/Expand Button - hidden on mobile */}
        {!isMobile && (
          <TooltipAnchor
            description={effectiveCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            side="right"
            render={
              <button
                onClick={onToggleCollapse}
                className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
              >
                {effectiveCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </button>
            }
          />
        )}
        
        {/* Branding Logo - Only when expanded */}
        {!effectiveCollapsed && (
          <button 
            onClick={() => handleNavClick('/admin/dashboard')} 
            className="ml-2 flex items-center"
          >
            <img
              src={logoSrc}
              alt="Logo"
              className="h-5 w-auto"
              onError={(e) => {
                // Fallback if custom logo fails
                e.currentTarget.src = isDark 
                  ? '/assets/branding-logo-dark.svg' 
                  : '/assets/branding-logo-lite.svg';
              }}
            />
          </button>
        )}
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 overflow-y-auto px-2 pt-4">
        <div className="flex flex-col gap-1">
          {navItems.map((item) => (
            <TooltipAnchor
              key={item.id}
              description={effectiveCollapsed ? item.title : ''}
              side="right"
              render={
                <button
                  onClick={() => handleNavClick(item.path)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    effectiveCollapsed && 'justify-center px-2',
                    isActive(item.path)
                      ? 'bg-surface-tertiary text-text-primary'
                      : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                  )}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  {!effectiveCollapsed && <span>{item.title}</span>}
                </button>
              }
            />
          ))}
        </div>
      </nav>

      {/* Bottom Section - Theme Toggle */}
      <div className="flex items-center justify-center border-t border-border-light p-2">
        <ThemeToggle />
      </div>
    </div>
  );
});

AdminSidebar.displayName = 'AdminSidebar';

export default AdminSidebar;
