/**
 * Admin Users Page
 * 
 * Full user management with CRUD, ban/unban, role assignment.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import {
  Users,
  Search,
  RefreshCw,
  MoreHorizontal,
  Ban,
  Shield,
  Trash2,
  Eye,
  CheckCircle,
  XCircle,
  Edit,
  UserCog,
  Coins,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  Dialog,
  DialogTemplate,
} from '@ranger/client';
import { AdminDataTable, SortableHeader } from '../components/DataTable';
import { usersApi, type User, type UserListParams } from '../services/adminApi';
import { cn } from '~/utils';

// Role options
const ROLES = [
  { value: 'USER', label: 'User' },
  { value: 'ADMIN', label: 'Admin' },
];

// Status filter options
const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'banned', label: 'Banned' },
];

function UsersPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });

  // Filters
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [status, setStatus] = useState<string>(searchParams.get('status') || '');
  const [role, setRole] = useState(searchParams.get('role') || '');

  // Dialogs
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showBanDialog, setShowBanDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [newRole, setNewRole] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Edit form
  const [editForm, setEditForm] = useState({ name: '', username: '', email: '' });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(amount);
  };

  const formatTokens = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: UserListParams = {
        page: pagination.page,
        limit: pagination.limit,
        search,
        status: status as 'active' | 'banned' | '',
        role,
      };
      const result = await usersApi.list(params);
      setUsers(result.users);
      setPagination(result.pagination);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search, status, role]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    if (role) params.set('role', role);
    setSearchParams(params, { replace: true });
  }, [search, status, role, setSearchParams]);

  // Actions
  const handleBanToggle = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      const isBanning = !selectedUser.banned;
      await usersApi.toggleBan(selectedUser._id, isBanning, isBanning ? banReason : undefined);
      setShowBanDialog(false);
      setBanReason('');
      fetchUsers();
    } catch (error) {
      console.error('Failed to toggle ban:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      await usersApi.delete(selectedUser._id, true);
      setShowDeleteDialog(false);
      fetchUsers();
    } catch (error) {
      console.error('Failed to delete user:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRoleChange = async () => {
    if (!selectedUser || !newRole) return;
    setActionLoading(true);
    try {
      await usersApi.updateRole(selectedUser._id, newRole);
      setShowRoleDialog(false);
      setNewRole('');
      fetchUsers();
    } catch (error) {
      console.error('Failed to update role:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      await usersApi.update(selectedUser._id, editForm);
      setShowEditDialog(false);
      fetchUsers();
    } catch (error) {
      console.error('Failed to update user:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const openBanDialog = (user: User) => {
    setSelectedUser(user);
    setBanReason(user.banReason || '');
    setShowBanDialog(true);
  };

  const openDeleteDialog = (user: User) => {
    setSelectedUser(user);
    setShowDeleteDialog(true);
  };

  const openRoleDialog = (user: User) => {
    setSelectedUser(user);
    setNewRole(user.role);
    setShowRoleDialog(true);
  };

  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setEditForm({
      name: user.name || '',
      username: user.username || '',
      email: user.email || '',
    });
    setShowEditDialog(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Table columns
  const columns: ColumnDef<User>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => <SortableHeader column={column}>User</SortableHeader>,
        cell: ({ row }) => {
          const user = row.original;
          return (
            <div className="flex items-center gap-3">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-tertiary text-xs font-medium text-text-primary">
                  {getInitials(user.name || user.username || 'U')}
                </div>
              )}
              <div>
                <p className="font-medium text-text-primary">{user.name || user.username}</p>
                <p className="text-xs text-text-tertiary">{user.email}</p>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'role',
        header: 'Role',
        cell: ({ row }) => (
          <span
            className={cn(
              'rounded px-2 py-0.5 text-xs font-medium',
              row.original.role === 'ADMIN'
                ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
            )}
          >
            {row.original.role}
          </span>
        ),
      },
      {
        accessorKey: 'provider',
        header: 'Provider',
        cell: ({ row }) => (
          <span className="text-sm text-text-secondary">
            {row.original.provider || 'local'}
          </span>
        ),
      },
      {
        accessorKey: 'banned',
        header: 'Status',
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            {row.original.banned ? (
              <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
                <XCircle className="h-3 w-3" />
                Banned
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                <CheckCircle className="h-3 w-3" />
                Active
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: ({ column }) => <SortableHeader column={column}>Joined</SortableHeader>,
        cell: ({ row }) => (
          <span className="text-sm text-text-secondary">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
      {
        accessorKey: 'inputTokens',
        header: ({ column }) => <SortableHeader column={column}>Input</SortableHeader>,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <ArrowDownRight className="h-3 w-3 text-blue-500" />
            <span className="text-sm text-text-secondary">
              {formatTokens(row.original.inputTokens || 0)}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'outputTokens',
        header: ({ column }) => <SortableHeader column={column}>Output</SortableHeader>,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <ArrowUpRight className="h-3 w-3 text-green-500" />
            <span className="text-sm text-text-secondary">
              {formatTokens(row.original.outputTokens || 0)}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'totalCost',
        header: ({ column }) => <SortableHeader column={column}>Cost</SortableHeader>,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Coins className="h-3 w-3 text-yellow-500" />
            <span className="text-sm font-medium text-text-primary">
              {formatCurrency(row.original.totalCost || 0)}
            </span>
          </div>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="dark:border-gray-700 dark:bg-gray-850">
              <DropdownMenuItem
                className="cursor-pointer gap-2 dark:hover:bg-gray-800"
                onClick={() => navigate(`/admin/users/${row.original._id}`)}
              >
                <Eye className="h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer gap-2 dark:hover:bg-gray-800"
                onClick={() => openEditDialog(row.original)}
              >
                <Edit className="h-4 w-4" />
                Edit User
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer gap-2 dark:hover:bg-gray-800"
                onClick={() => openRoleDialog(row.original)}
              >
                <UserCog className="h-4 w-4" />
                Change Role
              </DropdownMenuItem>
              <DropdownMenuSeparator className="dark:bg-gray-700" />
              <DropdownMenuItem
                className={cn(
                  'cursor-pointer gap-2 dark:hover:bg-gray-800',
                  row.original.banned ? 'text-green-600' : 'text-yellow-600'
                )}
                onClick={() => openBanDialog(row.original)}
              >
                {row.original.banned ? (
                  <>
                    <Shield className="h-4 w-4" />
                    Remove Ban
                  </>
                ) : (
                  <>
                    <Ban className="h-4 w-4" />
                    Ban User
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-red-600 dark:hover:bg-gray-800"
                onClick={() => openDeleteDialog(row.original)}
              >
                <Trash2 className="h-4 w-4" />
                Delete User
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [navigate]
  );

  return (
    <div className="space-y-4 p-4 md:p-5">
      {/* Page Header with Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Users</h1>
          <p className="text-sm text-text-secondary">
            Manage user accounts, roles, and permissions
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48 rounded-lg border border-border-light bg-surface-primary py-1.5 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-[var(--surface-submit)] focus:outline-none"
            />
          </div>
          {/* Filters */}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-border-light bg-surface-primary px-2 py-1.5 text-sm text-text-primary focus:border-[var(--surface-submit)] focus:outline-none [&>option]:bg-[var(--surface-primary)] [&>option]:text-[var(--text-primary)]"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-lg border border-border-light bg-surface-primary px-2 py-1.5 text-sm text-text-primary focus:border-[var(--surface-submit)] focus:outline-none [&>option]:bg-[var(--surface-primary)] [&>option]:text-[var(--text-primary)]"
          >
            <option value="">All Roles</option>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-text-tertiary">
            {pagination.total} users
          </span>
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="flex items-center justify-center rounded-lg border border-border-light bg-[var(--surface-submit)] p-2 text-white transition-colors hover:opacity-90 disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Data Table */}
      <AdminDataTable
        columns={columns}
        data={users}
        isLoading={loading}
        showSearch={false}
        onRowClick={(user) => navigate(`/admin/users/${user._id}`)}
        serverPagination={{
          page: pagination.page,
          totalPages: pagination.totalPages,
          total: pagination.total,
          onPageChange: (page) => setPagination((prev) => ({ ...prev, page })),
        }}
      />

      {/* Ban Dialog */}
      <Dialog open={showBanDialog} onOpenChange={setShowBanDialog}>
        <DialogTemplate
          title={selectedUser?.banned ? 'Remove Ban' : 'Ban User'}
          description={
            selectedUser?.banned
              ? `Are you sure you want to remove the ban on ${selectedUser?.name || selectedUser?.email}? They will be able to access the system again.`
              : `Are you sure you want to ban ${selectedUser?.name || selectedUser?.email}? They will be logged out and unable to access the system.`
          }
          main={
            !selectedUser?.banned && (
              <div className="mt-4">
                <label className="text-sm font-medium text-text-primary">Ban Reason (optional)</label>
                <textarea
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border-medium bg-surface-primary p-3 text-sm text-text-primary focus:border-[var(--surface-submit)] focus:outline-none"
                  rows={3}
                  placeholder="Enter reason for banning this user..."
                />
              </div>
            )
          }
          buttons={
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowBanDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleBanToggle}
                disabled={actionLoading}
                className={cn(
                  selectedUser?.banned
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-yellow-600 hover:bg-yellow-700'
                )}
              >
                {actionLoading ? 'Processing...' : selectedUser?.banned ? 'Remove Ban' : 'Ban User'}
              </Button>
            </div>
          }
        />
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogTemplate
          title="Delete User"
          description={`Are you sure you want to delete ${selectedUser?.name || selectedUser?.email}? This action cannot be undone. All user data including conversations, files, and transactions will be permanently deleted.`}
          buttons={
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleDelete}
                disabled={actionLoading}
                className="bg-red-600 hover:bg-red-700"
              >
                {actionLoading ? 'Deleting...' : 'Delete User'}
              </Button>
            </div>
          }
        />
      </Dialog>

      {/* Role Dialog */}
      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogTemplate
          title="Change User Role"
          description={`Change role for ${selectedUser?.name || selectedUser?.email}`}
          main={
            <div className="mt-4">
              <label className="text-sm font-medium text-text-primary">Select Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border-medium bg-surface-primary px-3 py-2 text-sm text-text-primary focus:border-[var(--surface-submit)] focus:outline-none"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          }
          buttons={
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowRoleDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleRoleChange}
                disabled={actionLoading || newRole === selectedUser?.role}
                className="bg-[var(--surface-submit)]"
              >
                {actionLoading ? 'Updating...' : 'Update Role'}
              </Button>
            </div>
          }
        />
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogTemplate
          title="Edit User"
          description={`Edit information for ${selectedUser?.name || selectedUser?.email}`}
          main={
            <div className="mt-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-text-primary">Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-border-medium bg-surface-primary px-3 py-2 text-sm text-text-primary focus:border-[var(--surface-submit)] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-text-primary">Username</label>
                <input
                  type="text"
                  value={editForm.username}
                  onChange={(e) => setEditForm((f) => ({ ...f, username: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-border-medium bg-surface-primary px-3 py-2 text-sm text-text-primary focus:border-[var(--surface-submit)] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-text-primary">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-border-medium bg-surface-primary px-3 py-2 text-sm text-text-primary focus:border-[var(--surface-submit)] focus:outline-none"
                />
              </div>
            </div>
          }
          buttons={
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleEdit}
                disabled={actionLoading}
                className="bg-[var(--surface-submit)]"
              >
                {actionLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          }
        />
      </Dialog>
    </div>
  );
}

export default UsersPage;
