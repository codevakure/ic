/**
 * Admin Roles Page
 * 
 * Role management with permissions configuration.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Users,
  Globe,
  Search,
  UserPlus,
  UserMinus,
} from 'lucide-react';
import {
  Button,
  Dialog,
  DialogTemplate,
  Input,
} from '@ranger/client';
import { rolesApi, type Role, type RolePermissions, groupsApi, type AdminGroup, usersApi, type User } from '../services/adminApi';
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
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'roles' | 'groups'>('roles');
  
  const [roles, setRoles] = useState<Role[]>([]);
  const [systemRoles, setSystemRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Groups state - now fetched from database
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupActionLoading, setGroupActionLoading] = useState(false);

  // Unified Group Dialog state (for both create and edit)
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AdminGroup | null>(null); // null = create mode
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');

  // User search state for group management
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<User[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [selectedUsersForGroup, setSelectedUsersForGroup] = useState<User[]>([]);
  const [groupMembersLoading, setGroupMembersLoading] = useState(false);

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

  // Fetch group user counts - from database Group collection
  const fetchGroups = useCallback(async () => {
    setGroupsLoading(true);
    try {
      const response = await groupsApi.getGroups();
      setGroups(response.groups || []);
    } catch (err) {
      console.error('Error fetching groups:', err);
      setGroups([]);
    } finally {
      setGroupsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  useEffect(() => {
    if (activeTab === 'groups') {
      fetchGroups();
    }
  }, [activeTab, fetchGroups]);

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

  const handleGroupClick = (groupName: string) => {
    navigate(`/admin/users?group=${encodeURIComponent(groupName)}`);
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return;
    setGroupActionLoading(true);
    try {
      await groupsApi.createGroup({ 
        name: groupName.trim(), 
        description: groupDescription.trim() 
      });
      // Add selected users to group if any
      if (selectedUsersForGroup.length > 0) {
        for (const user of selectedUsersForGroup) {
          const currentGroups = user.groups || [];
          await usersApi.update(user._id, { groups: [...currentGroups, groupName.trim()] });
        }
      }
      fetchGroups();
      handleCloseGroupDialog();
    } catch (err) {
      console.error('Error creating group:', err);
    } finally {
      setGroupActionLoading(false);
    }
  };

  // Edit group handlers
  const handleEditGroup = async (group: AdminGroup) => {
    setEditingGroup(group);
    setGroupName(group.name);
    setGroupDescription(group.description || '');
    setShowGroupDialog(true);
    // Load current group members
    setGroupMembersLoading(true);
    try {
      const response = await usersApi.list({ group: group.name, limit: 100 });
      setSelectedUsersForGroup(response.users);
    } catch (err) {
      console.error('Error loading group members:', err);
      setSelectedUsersForGroup([]);
    } finally {
      setGroupMembersLoading(false);
    }
  };

  const handleSaveGroupEdit = async () => {
    if (!editingGroup || !groupName.trim()) return;
    setGroupActionLoading(true);
    try {
      await groupsApi.updateGroup(editingGroup._id, {
        name: groupName.trim(),
        description: groupDescription.trim(),
      });
      fetchGroups();
      handleCloseGroupDialog();
    } catch (err) {
      console.error('Error updating group:', err);
    } finally {
      setGroupActionLoading(false);
    }
  };

  // Open create group dialog
  const handleOpenCreateGroup = () => {
    setEditingGroup(null);
    setGroupName('');
    setGroupDescription('');
    setSelectedUsersForGroup([]);
    setShowGroupDialog(true);
  };

  // Close group dialog and reset state
  const handleCloseGroupDialog = () => {
    setShowGroupDialog(false);
    setEditingGroup(null);
    setGroupName('');
    setGroupDescription('');
    setSelectedUsersForGroup([]);
    setUserSearchQuery('');
    setUserSearchResults([]);
  };

  // User search for autocomplete
  const handleUserSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setUserSearchResults([]);
      return;
    }
    setUserSearchLoading(true);
    try {
      const response = await usersApi.list({ search: query, limit: 10 });
      // Filter out users already selected
      const selectedIds = selectedUsersForGroup.map(u => u._id);
      setUserSearchResults(response.users.filter(u => !selectedIds.includes(u._id)));
    } catch (err) {
      console.error('Error searching users:', err);
      setUserSearchResults([]);
    } finally {
      setUserSearchLoading(false);
    }
  }, [selectedUsersForGroup]);

  // Debounced user search
  useEffect(() => {
    const timer = setTimeout(() => {
      handleUserSearch(userSearchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [userSearchQuery, handleUserSearch]);

  // Add user to selected list
  const handleSelectUser = (user: User) => {
    setSelectedUsersForGroup(prev => [...prev, user]);
    setUserSearchQuery('');
    setUserSearchResults([]);
  };

  // Remove user from selected list
  const handleRemoveUser = (userId: string) => {
    setSelectedUsersForGroup(prev => prev.filter(u => u._id !== userId));
  };



  if (loading && roles.length === 0) {
    return <RolesPageSkeleton />;
  }

  return (
    <div className="space-y-6 p-6 md:p-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Roles & Groups</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Manage roles, permissions, and OIDC groups
          </p>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === 'roles' && (
            <>
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
            </>
          )}
          {activeTab === 'groups' && (
            <Button
              variant="outline"
              onClick={fetchGroups}
              disabled={groupsLoading}
            >
              <RefreshCw className={cn('h-4 w-4', groupsLoading && 'animate-spin')} />
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border-light">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('roles')}
            className={cn(
              'px-4 py-3 font-medium text-sm border-b-2 transition-colors',
              activeTab === 'roles'
                ? 'border-blue-600 text-blue-400'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            )}
          >
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Roles
            </div>
          </button>
          <button
            onClick={() => setActiveTab('groups')}
            className={cn(
              'px-4 py-3 font-medium text-sm border-b-2 transition-colors',
              activeTab === 'groups'
                ? 'border-purple-600 text-purple-400'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            )}
          >
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              OIDC Groups
            </div>
          </button>
        </nav>
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      {/* Groups Tab Content */}
      {activeTab === 'groups' && (
        <div className="space-y-6">
          {/* Header with Create Button */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-secondary">
              Manage OIDC groups that control agent access
            </p>
            <Button onClick={handleOpenCreateGroup}>
              <Plus className="h-4 w-4 mr-2" />
              Create Group
            </Button>
          </div>

          {/* Groups Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {groupsLoading ? (
              // Loading skeleton
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-border-light bg-surface-secondary p-6 animate-pulse">
                  <div className="h-10 w-10 rounded-lg bg-surface-tertiary mb-4" />
                  <div className="h-4 w-24 bg-surface-tertiary rounded mb-2" />
                  <div className="h-3 w-full bg-surface-tertiary rounded" />
                </div>
              ))
            ) : groups.length === 0 ? (
              <div className="col-span-full text-center py-8">
                <Globe className="h-12 w-12 text-text-tertiary mx-auto mb-4" />
                <p className="text-text-secondary mb-4">No groups found</p>
                <Button onClick={handleOpenCreateGroup}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Group
                </Button>
              </div>
            ) : (
              groups.map((group) => (
                <div
                  key={group._id}
                  className="rounded-lg border border-border-light bg-surface-secondary p-6 hover:border-purple-500/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20">
                      <Globe className="h-5 w-5 text-purple-500" />
                    </div>
                    <div className="flex items-center gap-2">
                      {group.source === 'local' && (
                        <button
                          onClick={() => handleEditGroup(group)}
                          className="p-1.5 hover:bg-surface-tertiary rounded-md transition-colors"
                          title="Edit group"
                        >
                          <Edit className="h-4 w-4 text-text-tertiary hover:text-text-secondary" />
                        </button>
                      )}
                      <span className={cn(
                        'text-xs px-2 py-1 rounded-full',
                        group.source === 'local' 
                          ? 'bg-green-500/20 text-green-500'
                          : 'bg-blue-500/20 text-blue-500'
                      )}>
                        {group.source === 'local' ? 'Local' : 'Entra'}
                      </span>
                    </div>
                  </div>
                  <h3 className="font-semibold text-text-primary mb-1">{group.name}</h3>
                  <p className="text-sm text-text-secondary mb-4 line-clamp-2">
                    {group.description || 'No description'}
                  </p>
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => handleGroupClick(group.name)}
                      className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      <Users className="h-4 w-4" />
                      <span>{group.userCount} user{group.userCount !== 1 ? 's' : ''}</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Info Box */}
          <div className="rounded-lg border border-border-light bg-surface-secondary p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20">
                <AlertCircle className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <h4 className="text-sm font-medium text-text-primary mb-1">About OIDC Groups</h4>
                <p className="text-sm text-text-secondary">
                  OIDC groups control which agents users can access. Assign groups to users via the User Detail page.
                  Click on a group to view all users in that group.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Roles Tab Content */}
      {activeTab === 'roles' && (
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
      )}

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

      {/* Unified Create/Edit Group Dialog */}
      <Dialog open={showGroupDialog} onOpenChange={(open) => !open && handleCloseGroupDialog()}>
        <DialogTemplate
          title={editingGroup ? 'Edit Group' : 'Create New Group'}
          description={editingGroup 
            ? 'Update the group details and manage members'
            : 'Create a new OIDC group to control agent access'
          }
          className="sm:max-w-lg"
          main={
            <div className="space-y-4 pt-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  Group Name
                </label>
                <Input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g., RangerAnalytics"
                  className="w-full bg-[var(--surface-secondary)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  Description
                </label>
                <Input
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  placeholder="Describe what this group provides access to"
                  className="w-full bg-[var(--surface-secondary)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                />
              </div>

              {/* Members section */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  {editingGroup ? `Members (${selectedUsersForGroup.length})` : 'Add Users (Optional)'}
                </label>

                {/* User search */}
                <div className="relative">
                  <div className="flex items-center border border-[var(--border-light)] rounded-lg bg-[var(--surface-secondary)] px-3">
                    <Search className="h-4 w-4 text-text-tertiary mr-2" />
                    <input
                      type="text"
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      placeholder="Search users to add..."
                      className="flex-1 py-2 bg-transparent text-text-primary placeholder:text-text-tertiary focus:outline-none text-sm"
                    />
                    {userSearchLoading && <RefreshCw className="h-4 w-4 text-text-tertiary animate-spin" />}
                  </div>
                  {/* Search Results Dropdown */}
                  {userSearchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--surface-secondary)] border border-[var(--border-light)] rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                      {userSearchResults.map((user) => (
                        <button
                          key={user._id}
                          onClick={() => handleSelectUser(user)}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[var(--surface-tertiary)] transition-colors text-left"
                        >
                          {user.avatar ? (
                            <img src={user.avatar} alt={user.name} className="w-6 h-6 rounded-full object-cover" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center">
                              <Users className="h-3 w-3 text-purple-400" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-text-primary truncate">{user.name}</p>
                            <p className="text-xs text-text-tertiary truncate">{user.email}</p>
                          </div>
                          <Plus className="h-4 w-4 text-text-tertiary flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Loading state for edit mode */}
                {groupMembersLoading && (
                  <div className="flex items-center justify-center py-4">
                    <RefreshCw className="h-5 w-5 text-text-tertiary animate-spin" />
                    <span className="ml-2 text-sm text-text-tertiary">Loading members...</span>
                  </div>
                )}

                {/* Current Members / Selected Users */}
                {!groupMembersLoading && selectedUsersForGroup.length > 0 && (
                  <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                    {selectedUsersForGroup.map((user) => (
                      <div
                        key={user._id}
                        className="flex items-center justify-between p-2 bg-[var(--surface-tertiary)] rounded-lg"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {user.avatar ? (
                            <img src={user.avatar} alt={user.name} className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                              <Users className="h-3 w-3 text-purple-400" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm text-text-primary truncate">{user.name || user.email}</p>
                            {user.name && <p className="text-xs text-text-tertiary truncate">{user.email}</p>}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveUser(user._id)}
                          className="p-1 hover:bg-red-500/20 rounded transition-colors flex-shrink-0"
                          title="Remove from group"
                        >
                          <UserMinus className="h-4 w-4 text-red-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {!groupMembersLoading && selectedUsersForGroup.length === 0 && editingGroup && (
                  <p className="text-sm text-text-tertiary py-3 text-center">
                    No users in this group. Search above to add users.
                  </p>
                )}
              </div>
            </div>
          }
          buttons={
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={handleCloseGroupDialog}
              >
                Cancel
              </Button>
              <Button
                onClick={editingGroup ? handleSaveGroupEdit : handleCreateGroup}
                disabled={!groupName.trim() || groupActionLoading}
              >
                {groupActionLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : editingGroup ? (
                  'Save Changes'
                ) : (
                  'Create Group'
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
