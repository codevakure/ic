import { useEffect, useState, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Loader2, Menu, X } from 'lucide-react';
import { useAuthContext } from '~/hooks/AuthContext';
import { SystemRoles } from 'librechat-data-provider';
import { useLocalStorage } from '~/hooks';
import AdminSidebar from './AdminSidebar';
import { AdminStats } from './components/AdminStats';

export default function AdminLayout() {
  const { user, isAuthenticated } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();
  // Default to collapsed (true)
  const [isCollapsed, setIsCollapsed] = useLocalStorage('adminSidebarCollapsed', true);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Handle scroll for blur effect
  const handleScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    const target = e.currentTarget;
    setIsScrolled(target.scrollTop > 10);
  }, []);

  useEffect(() => {
    // Wait for auth state to be determined
    // user will be undefined initially, then set to the user object or remain undefined if not logged in
    if (user === undefined && !isAuthenticated) {
      // Still loading auth state - wait
      return;
    }

    // Auth state is now determined
    setIsLoading(false);

    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    
    if (user?.role !== SystemRoles.ADMIN) {
      navigate('/');
      return;
    }
  }, [isAuthenticated, user, navigate]);

  // Redirect to dashboard if at /admin
  useEffect(() => {
    if (location.pathname === '/admin' || location.pathname === '/admin/') {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [location.pathname, navigate]);

  // Show loading state while auth is being determined
  if (isLoading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-surface-primary">
        <Loader2 className="h-8 w-8 animate-spin text-text-secondary" />
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== SystemRoles.ADMIN) {
    return null;
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Hidden on mobile, slide-in when menu is open */}
      <div className={`
        fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <AdminSidebar 
          isCollapsed={isCollapsed} 
          onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
          onMobileClose={() => setIsMobileMenuOpen(false)}
          isMobile={isMobileMenuOpen}
        />
      </div>

      {/* Main Content - uses bg-surface-primary like chat background */}
      <div className="relative flex flex-1 flex-col overflow-hidden bg-surface-primary">
        {/* Header with Stats Ticker and Back to Chat */}
        <header 
          className={`sticky top-0 z-20 flex h-12 md:h-14 flex-shrink-0 items-center justify-between px-3 md:px-4 transition-all duration-300 ${
            isScrolled 
              ? 'bg-surface-primary/80 backdrop-blur-md border-b border-border-light shadow-sm' 
              : 'bg-transparent'
          }`}
        >
          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="flex md:hidden h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          {/* Logo/Brand - visible when scrolled on desktop */}
          <div className={`hidden md:flex items-center gap-3 transition-opacity duration-300 ${isScrolled ? 'opacity-100' : 'opacity-0'}`}>
            <span className="text-lg font-bold text-text-primary">Ranger</span>
            <span className="text-xs text-text-tertiary">Admin</span>
          </div>

          {/* Stats Ticker - hidden on mobile */}
          <div className="hidden md:flex flex-1 justify-center">
            <AdminStats />
          </div>

          {/* Back to Chat */}
          <button
            onClick={() => navigate('/c/new')}
            className="flex items-center gap-1.5 md:gap-2 rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Back to Chat</span>
          </button>
        </header>

        {/* Page Content */}
        <main 
          className="flex-1 overflow-y-auto overflow-x-hidden"
          onScroll={handleScroll}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
