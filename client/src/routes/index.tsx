import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import {
  Login,
  VerifyEmail,
  Registration,
  ResetPassword,
  ApiErrorWatcher,
  TwoFactorScreen,
  RequestPasswordReset,
} from '~/components/Auth';
import AgentMarketplace from '~/components/Agents/Marketplace';
import ConversationHistoryPage from '~/components/Conversations/ConversationHistoryPage';
import BookmarksPage from '~/components/Bookmarks/BookmarksPage';
import ProfilePage from '~/components/Profile/ProfilePage';
import { PromptsPage } from '~/components/Prompts';
import { PlaceholderPage } from '~/components/Placeholder';
import FilesPage from '~/components/Files/FilesPage';
import { OAuthSuccess, OAuthError } from '~/components/OAuth';
import { AuthContextProvider } from '~/hooks/AuthContext';
import LeftPanelLayout from './Layouts/LeftPanelLayout';
import AppLayout from './Layouts/AppLayout';
import RouteErrorBoundary from './RouteErrorBoundary';
import StartupLayout from './Layouts/Startup';
import LoginLayout from './Layouts/Login';
import dashboardRoutes from './Dashboard';
import ShareRoute from './ShareRoute';
import ChatRoute from './ChatRoute';
import Search from './Search';
import Root from './Root';

const AuthLayout = () => (
  <AuthContextProvider>
    <Outlet />
    <ApiErrorWatcher />
  </AuthContextProvider>
);

const baseEl = document.querySelector('base');
const baseHref = baseEl?.getAttribute('href') || '/';

export const router = createBrowserRouter(
  [
    {
      path: 'share/:shareId',
      element: <ShareRoute />,
      errorElement: <RouteErrorBoundary />,
    },
    {
      path: 'oauth',
      errorElement: <RouteErrorBoundary />,
      children: [
        {
          path: 'success',
          element: <OAuthSuccess />,
        },
        {
          path: 'error',
          element: <OAuthError />,
        },
      ],
    },
    {
      path: '/',
      element: <StartupLayout />,
      errorElement: <RouteErrorBoundary />,
      children: [
        {
          path: 'register',
          element: <Registration />,
        },
        {
          path: 'forgot-password',
          element: <RequestPasswordReset />,
        },
        {
          path: 'reset-password',
          element: <ResetPassword />,
        },
      ],
    },
    {
      path: 'verify',
      element: <VerifyEmail />,
      errorElement: <RouteErrorBoundary />,
    },
    {
      element: <AuthLayout />,
      errorElement: <RouteErrorBoundary />,
      children: [
        {
          path: '/',
          element: <LoginLayout />,
          children: [
            {
              path: 'login',
              element: <Login />,
            },
            {
              path: 'login/2fa',
              element: <TwoFactorScreen />,
            },
          ],
        },
        dashboardRoutes,
        /**
         * AppLayout: Shared panel infrastructure for authenticated routes.
         * 
         * Provides SidePanelGroup with:
         * - Push mode sources panel (resizable)
         * - Artifacts panel
         * - Right nav panel (conditional based on route)
         * 
         * All child routes can use useSourcesPanel() to open push/overlay panels.
         * @see AppLayout for detailed documentation
         */
        {
          element: <AppLayout />,
          children: [
            {
              path: '/',
              element: <LeftPanelLayout />,
              children: [
                {
                  path: 'placeholder',
                  element: <PlaceholderPage />,
                },
                {
                  path: 'bookmarks',
                  element: <BookmarksPage />,
                },
                {
                  path: 'files',
                  element: <FilesPage />,
                },
                {
                  path: 'profile',
                  element: <ProfilePage />,
                },
                {
                  path: 'agents',
                  element: <AgentMarketplace />,
                },
                {
                  path: 'agents/:category',
                  element: <AgentMarketplace />,
                },
                {
                  path: 'prompts',
                  element: <PromptsPage />,
                },
                {
                  path: 'prompts/:promptId',
                  element: <PromptsPage />,
                },
              ],
            },
            {
              path: '/',
              element: <Root />,
              children: [
                {
                  index: true,
                  element: <Navigate to="/c/new" replace={true} />,
                },
                {
                  path: 'c/:conversationId?',
                  element: <ChatRoute />,
                },
                {
                  path: 'search',
                  element: <Search />,
                },
                {
                  path: 'conversations',
                  element: <ConversationHistoryPage />,
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  { basename: baseHref },
);
