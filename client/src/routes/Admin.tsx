import { Navigate } from 'react-router-dom';
import { 
  AdminLayout,
  DashboardPage,
  UsersPage,
  ActiveUsersPage,
  UserDetailPage,
  SettingsPage,
  RolesPage,
  CostsPage,
  AgentsPage,
  AgentDetailPage,
  TracesPage,
  ToolsPage,
  GuardrailsPage,
} from '~/components/Admin';

const adminRoutes = {
  path: 'admin/*',
  element: <AdminLayout />,
  children: [
    {
      index: true,
      element: <Navigate to="/admin/dashboard" replace={true} />,
    },
    {
      path: 'dashboard',
      element: <DashboardPage />,
    },
    {
      path: 'traces',
      element: <TracesPage />,
    },
    {
      path: 'users',
      element: <UsersPage />,
    },
    {
      path: 'users/active',
      element: <ActiveUsersPage />,
    },
    {
      path: 'users/:userId',
      element: <UserDetailPage />,
    },
    {
      path: 'costs',
      element: <CostsPage />,
    },
    {
      path: 'agents',
      element: <AgentsPage />,
    },
    {
      path: 'agents/:agentId',
      element: <AgentDetailPage />,
    },
    {
      path: 'tools',
      element: <ToolsPage />,
    },
    {
      path: 'guardrails',
      element: <GuardrailsPage />,
    },
    {
      path: 'roles',
      element: <RolesPage />,
    },
    {
      path: 'settings',
      element: <SettingsPage />,
    },
    {
      path: '*',
      element: <Navigate to="/admin/dashboard" replace={true} />,
    },
  ],
};

export default adminRoutes;
