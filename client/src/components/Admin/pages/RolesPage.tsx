/**
 * Admin Roles Page
 * 
 * Role management with permissions configuration.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  RefreshCw,
  Plus,
  Edit,
  Trash2,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import {
  Button,
  Dialog,
  DialogTemplate,
} from '@ranger/client';
import { rolesApi, type Role, type RolePermissions } from '../services/adminApi';
import { RolesPageSkeleton } from '../components/Skeletons';
import { cn } from '~/utils';

// Permission categories with their sub-permissions
const PERMISSION_CATEGORIES = {
  BOOKMARKS: {
    label: 'Bookmarks',
    description: 'Manage bookmark permissions',
    permissions: {
      USE: { label: 'Use Bookmarks', description: 'Can view and use bookmarks' },
      CREATE: { label: 'Create Bookmarks', description: 'Can create new bookmarks' },
      SHARE: { label: 'Share Bookmarks', description: 'Can share bookmarks with others' },
    },
  },
  PROMPTS: {
    label: 'Prompts',
    description: 'Manage prompt permissions',
    permissions: {
      USE: { label: 'Use Prompts', description: 'Can view and use prompts' },
      CREATE: { label: 'Create Prompts', description: 'Can create new prompts' },
      SHARE: { label: 'Share Prompts', description: 'Can share prompts with others' },
    },
  },
  MEMORIES: {
    label: 'Memories',
    description: 'Manage memory permissions',
    permissions: {
      USE: { label: 'Use Memories', description: 'Can view and use memories' },
      CREATE: { label: 'Create Memories', description: 'Can create new memories' },
      SHARE: { label: 'Share Memories', description: 'Can share memories with others' },
    },
  },
  AGENTS: {
    label: 'Agents',
    description: 'Manage agent permissions',
    permissions: {
      USE: { label: 'Use Agents', description: 'Can interact with agents' },
      CREATE: { label: 'Create Agents', description: 'Can create new agents' },
      SHARE: { label: 'Share Agents', description: 'Can share agents with others' },
      SHARED_GLOBAL: { label: 'Global Sharing', description: 'Can share agents globally' },
    },
  },
  MULTI_CONVO: {
    label: 'Multi-Conversation',
    description: 'Multi-conversation features',
    permissions: {
      USE: { label: 'Use Multi-Convo', description: 'Can use multi-conversation mode' },
    },
  },
  CODE_INTERPRETER: {
    label: 'Code Interpreter',
    description: 'Code interpreter features',
    permissions: {
      USE: { label: 'Use Code Interpreter', description: 'Can use code interpreter' },
    },
  },
  MARKETPLACE: {
    label: 'Marketplace',
    description: 'Marketplace access',
    permissions: {
      VIEW_LIST: { label: 'View Marketplace', description: 'Can view marketplace listings' },
      INSTALL: { label: 'Install from Marketplace', description: 'Can install marketplace items' },
    },
  },
  PEOPLE_PICKER: {
    label: 'People Picker',
    description: 'User selection features',
    permissions: {
      USE: { label: 'Use People Picker', description: 'Can use people picker component' },
    },
  },
};

type PermissionCategory = keyof typeof PERMISSION_CATEGORIES;

function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [systemRoles, setSystemRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editedPermissions, setEditedPermissions] = useState<RolePermissions>({});
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Dialogs
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [newRoleName, setNewRoleName] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await rolesApi.list();
      setRoles(response.roles);
      setSystemRoles(response.systemRoles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const handleEditRole = (role: Role) => {
    setEditingRole(role);
    setEditedPermissions(role.permissions || {});
    // Expand all categories that have permissions set
    const expanded = new Set<string>();
    Object.keys(role.permissions || {}).forEach(cat => expanded.add(cat));
    setExpandedCategories(expanded);
  };

  const handleCancelEdit = () => {
    setEditingRole(null);
    setEditedPermissions({});
  };

  const handleSaveRole = async () => {
    if (!editingRole) return;
    setActionLoading(true);
    try {
      await rolesApi.update(editingRole.name, { permissions: editedPermissions });
      fetchRoles();
      setEditingRole(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) return;
    setActionLoading(true);
    try {
      await rolesApi.create(newRoleName.trim());
      fetchRoles();
      setShowCreateDialog(false);
      setNewRoleName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create role');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!roleToDelete) return;
    setActionLoading(true);
    try {
      await rolesApi.delete(roleToDelete.name);
      fetchRoles();
      setShowDeleteDialog(false);
      setRoleToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete role');
    } finally {
      setActionLoading(false);
    }
  };

  const openDeleteDialog = (role: Role) => {
    setRoleToDelete(role);
    setShowDeleteDialog(true);
  };

  const toggleCategory = (category: string) => {
    const next = new Set(expandedCategories);
    if (next.has(category)) {
      next.delete(category);
    } else {
      next.add(category);
    }
    setExpandedCategories(next);
  };

  const togglePermission = (category: PermissionCategory, permission: string) => {
    setEditedPermissions(prev => {
      const categoryPerms = (prev[category] || {}) as Record<string, boolean>;
      return {
        ...prev,
        [category]: {
          ...categoryPerms,
          [permission]: !categoryPerms[permission],
        },
      };
    });
  };

  const getPermissionValue = (category: PermissionCategory, permission: string): boolean => {
    const categoryPerms = editedPermissions[category] as Record<string, boolean> | undefined;
    return categoryPerms?.[permission] ?? false;
  };

  const isSystemRole = (roleName: string) => systemRoles.includes(roleName);

  if (loading && roles.length === 0) {
    return <RolesPageSkeleton />;
  }

  return (
    <div className="space-y-6 p-6 md:p-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Role Management</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Manage roles and their permissions
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Role
          </Button>
          <Button
            variant="outline"
            onClick={fetchRoles}
            disabled={loading}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      {/* Roles Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {roles.map((role) => (
          <div
            key={role.name}
            className={cn(
              'rounded-lg border bg-surface-secondary p-6 transition-colors',
              editingRole?.name === role.name 
                ? 'border-[var(--surface-submit)] ring-1 ring-[var(--surface-submit)]'
                : 'border-border-light'
            )}
          >
            {/* Role Header */}
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg',
                  isSystemRole(role.name) 
                    ? 'bg-blue-500/20 text-blue-500'
                    : 'bg-purple-500/20 text-purple-500'
                )}>
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-text-primary">{role.name}</h3>
                  <p className="text-sm text-text-secondary">
                    {isSystemRole(role.name) ? 'System Role' : 'Custom Role'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {editingRole?.name === role.name ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelEdit}
                      disabled={actionLoading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveRole}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditRole(role)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    {!isSystemRole(role.name) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDeleteDialog(role)}
                        className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Permissions */}
            <div className="space-y-2">
              {Object.entries(PERMISSION_CATEGORIES).map(([catKey, category]) => {
                const categoryKey = catKey as PermissionCategory;
                const isEditing = editingRole?.name === role.name;
                const currentPerms = isEditing 
                  ? (editedPermissions[categoryKey] as Record<string, boolean> | undefined)
                  : (role.permissions?.[categoryKey] as Record<string, boolean> | undefined);
                const hasPerms = currentPerms && Object.values(currentPerms).some(Boolean);
                const isExpanded = expandedCategories.has(catKey);

                return (
                  <div key={catKey} className="rounded-lg border border-border-light">
                    <button
                      onClick={() => isEditing && toggleCategory(catKey)}
                      className={cn(
                        'flex w-full items-center justify-between px-4 py-2 text-left',
                        isEditing && 'hover:bg-surface-tertiary cursor-pointer'
                      )}
                      disabled={!isEditing}
                    >
                      <div className="flex items-center gap-2">
                        {isEditing && (
                          isExpanded 
                            ? <ChevronDown className="h-4 w-4 text-text-tertiary" />
                            : <ChevronRight className="h-4 w-4 text-text-tertiary" />
                        )}
                        <span className="text-sm font-medium text-text-primary">
                          {category.label}
                        </span>
                      </div>
                      {hasPerms && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500/20 text-green-500">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                    </button>

                    {isEditing && isExpanded && (
                      <div className="border-t border-border-light px-4 py-3 space-y-2">
                        {Object.entries(category.permissions).map(([permKey, perm]) => (
                          <label
                            key={permKey}
                            className="flex items-center gap-3 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={getPermissionValue(categoryKey, permKey)}
                              onChange={() => togglePermission(categoryKey, permKey)}
                              className="h-4 w-4 rounded border-border-light text-[var(--surface-submit)] focus:ring-[var(--surface-submit)]"
                            />
                            <div>
                              <span className="text-sm text-text-primary">{perm.label}</span>
                              <p className="text-xs text-text-tertiary">{perm.description}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}

                    {!isEditing && hasPerms && (
                      <div className="border-t border-border-light px-4 py-2">
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(category.permissions).map(([permKey, perm]) => {
                            const enabled = currentPerms?.[permKey];
                            if (!enabled) return null;
                            return (
                              <span
                                key={permKey}
                                className="inline-flex items-center rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-600 dark:text-green-400"
                              >
                                {perm.label}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Create Role Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogTemplate
          title="Create New Role"
          description="Enter a name for the new role. You can configure permissions after creation."
          className="max-w-md"
          main={
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Role Name
                </label>
                <input
                  type="text"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="Enter role name..."
                  className="w-full rounded-lg border border-border-light bg-surface-primary px-4 py-2 text-text-primary placeholder:text-text-tertiary focus:border-[var(--surface-submit)] focus:outline-none focus:ring-1 focus:ring-[var(--surface-submit)]"
                />
              </div>
            </div>
          }
          buttons={
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateDialog(false);
                  setNewRoleName('');
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateRole}
                disabled={!newRoleName.trim() || actionLoading}
              >
                {actionLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  'Create Role'
                )}
              </Button>
            </div>
          }
        />
      </Dialog>

      {/* Delete Role Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogTemplate
          title="Delete Role"
          description={`Are you sure you want to delete the role "${roleToDelete?.name}"? This action cannot be undone.`}
          className="max-w-md"
          buttons={
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteDialog(false);
                  setRoleToDelete(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteRole}
                disabled={actionLoading}
                className="bg-red-600 hover:bg-red-700"
              >
                {actionLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  'Delete Role'
                )}
              </Button>
            </div>
          }
        />
      </Dialog>
    </div>
  );
}

export default RolesPage;
