import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { matchSorter } from 'match-sorter';
import * as Tabs from '@radix-ui/react-tabs';
import {
  Mail,
  Shield,
  Calendar,
  Camera,
  Plus,
  Search,
  MessageSquare,
  Command,
  DollarSign,
  User,
  Link2,
} from 'lucide-react';
import {
  SystemRoles,
  PermissionTypes,
  Permissions,
  SettingsTabValues,
} from 'ranger-data-provider';
import {
  Button,
  Spinner,
  Switch,
  OGDialog,
  OGDialogTrigger,
  Input,
  EditIcon,
  TrashIcon,
  TooltipAnchor,
  OGDialogTemplate,
  useToastContext,
  Avatar as AvatarComponent,
  GearIcon,
  DataIcon,
  SpeechIcon,
  useMediaQuery,
} from '@ranger/client';
import type { TUser, TUserMemory } from 'ranger-data-provider';
import {
  useGetUserQuery,
  useMemoriesQuery,
  useDeleteMemoryMutation,
  useUpdateMemoryPreferencesMutation,
  useGetStartupConfig,
} from '~/data-provider';
import { useDocumentTitle, useLocalize, useAuthContext, useHasAccess, TranslationKeys } from '~/hooks';
import MemoryCreateDialog from '~/components/SidePanel/Memories/MemoryCreateDialog';
import MemoryEditDialog from '~/components/SidePanel/Memories/MemoryEditDialog';
import AdminSettings from '~/components/SidePanel/Memories/AdminSettings';
import AvatarUploadModal from '~/components/Nav/SettingsTabs/Account/AvatarUploadModal';
import {
  General,
  Chat,
  Commands,
  Speech,
  Data,
  Balance,
  Account,
} from '~/components/Nav/SettingsTabs';
import { PageContainer } from '~/components/Layout';
import SharedLinksPage from '~/components/Nav/SettingsTabs/Data/SharedLinksPage';
import { cn } from '~/utils';

// Edit Memory Button Component
const EditMemoryButton = ({ memory }: { memory: TUserMemory }) => {
  const localize = useLocalize();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);

  return (
    <MemoryEditDialog
      open={open}
      memory={memory}
      onOpenChange={setOpen}
      triggerRef={triggerRef as React.MutableRefObject<HTMLButtonElement | null>}
    >
      <OGDialogTrigger asChild>
        <TooltipAnchor
          description={localize('com_ui_edit_memory')}
          render={
            <Button
              variant="ghost"
              aria-label={localize('com_ui_bookmarks_edit')}
              onClick={() => setOpen(!open)}
              className="h-8 w-8 p-0 text-text-secondary hover:text-text-primary hover:bg-surface-hover"
            >
              <EditIcon className="size-4" />
            </Button>
          }
        />
      </OGDialogTrigger>
    </MemoryEditDialog>
  );
};

// Delete Memory Button Component
const DeleteMemoryButton = ({ memory }: { memory: TUserMemory }) => {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const [open, setOpen] = useState(false);
  const { mutate: deleteMemory } = useDeleteMemoryMutation();
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const confirmDelete = async () => {
    setDeletingKey(memory.key);
    deleteMemory(memory.key, {
      onSuccess: () => {
        showToast({
          message: localize('com_ui_deleted'),
          status: 'success',
        });
        setOpen(false);
      },
      onError: () =>
        showToast({
          message: localize('com_ui_error'),
          status: 'error',
        }),
      onSettled: () => setDeletingKey(null),
    });
  };

  return (
    <OGDialog open={open} onOpenChange={setOpen}>
      <OGDialogTrigger asChild>
        <TooltipAnchor
          description={localize('com_ui_delete_memory')}
          render={
            <Button
              variant="ghost"
              aria-label={localize('com_ui_delete')}
              onClick={() => setOpen(!open)}
              className="h-8 w-8 p-0 text-text-secondary hover:text-red-500 hover:bg-surface-hover"
            >
              {deletingKey === memory.key ? (
                <Spinner className="size-4 animate-spin" />
              ) : (
                <TrashIcon className="size-4" />
              )}
            </Button>
          }
        />
      </OGDialogTrigger>
      <OGDialogTemplate
        showCloseButton={false}
        title={localize('com_ui_delete_memory')}
        className="w-11/12 max-w-lg"
        main={
          <Label className="text-left text-sm font-medium">
            {localize('com_ui_delete_confirm')} &quot;{memory.key}&quot;?
          </Label>
        }
        selection={{
          selectHandler: confirmDelete,
          selectClasses:
            'bg-red-700 dark:bg-red-600 hover:bg-red-800 dark:hover:bg-red-800 text-white',
          selectText: localize('com_ui_delete'),
        }}
      />
    </OGDialog>
  );
};

// Avatar Upload Section Component - uses shared AvatarUploadModal
const AvatarUploadSection: React.FC<{ user: TUser | undefined }> = ({ user }) => {
  const localize = useLocalize();
  const [isDialogOpen, setDialogOpen] = useState<boolean>(false);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Current Avatar Display */}
      <div className="relative">
        <div className="h-32 w-32 overflow-hidden rounded-full ring-4 ring-surface-tertiary">
          <AvatarComponent user={user} size={128} />
        </div>
        <OGDialog open={isDialogOpen} onOpenChange={setDialogOpen}>
          <OGDialogTrigger asChild>
            <button
              className="absolute bottom-0 right-0 flex h-10 w-10 items-center justify-center rounded-full bg-surface-submit text-white shadow-lg transition-transform hover:scale-105"
              aria-label={localize('com_nav_change_picture')}
            >
              <Camera className="h-5 w-5" />
            </button>
          </OGDialogTrigger>
          {/* Shared Modal Component */}
          <AvatarUploadModal onClose={() => setDialogOpen(false)} />
        </OGDialog>
      </div>
    </div>
  );
};

// Profile Content Component (separated for use in tabs)
const ProfileContent: React.FC = () => {
  const localize = useLocalize();
  const { user, isAuthenticated } = useAuthContext();
  const { data: userData } = useGetUserQuery();
  const { data: memData, isLoading: isMemoriesLoading } = useMemoriesQuery();
  const { showToast } = useToastContext();
  
  // Memory state
  const [pageIndex, setPageIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  // Initialize to undefined to track whether we've loaded the initial value
  const [referenceSavedMemories, setReferenceSavedMemories] = useState<boolean | undefined>(undefined);
  const pageSize = 10;

  const updateMemoryPreferencesMutation = useUpdateMemoryPreferencesMutation({
    onSuccess: () => {
      showToast({
        message: localize('com_ui_preferences_updated'),
        status: 'success',
      });
    },
    onError: () => {
      showToast({
        message: localize('com_ui_error_updating_preferences'),
        status: 'error',
      });
      // Revert to server value on error
      setReferenceSavedMemories(userData?.personalization?.memories ?? false);
    },
  });

  // Initialize state from user data - only set once when data first loads
  useEffect(() => {
    if (userData?.personalization?.memories !== undefined && referenceSavedMemories === undefined) {
      setReferenceSavedMemories(userData.personalization.memories);
    }
  }, [userData?.personalization?.memories, referenceSavedMemories]);

  const handleMemoryToggle = useCallback((checked: boolean) => {
    setReferenceSavedMemories(checked);
    updateMemoryPreferencesMutation.mutate({ memories: checked });
  }, [updateMemoryPreferencesMutation]);

  // Check if memories are accessible
  const hasMemoryAccess = useHasAccess({
    permissionType: PermissionTypes.MEMORIES,
    permission: Permissions.READ,
  });

  const hasUpdateAccess = useHasAccess({
    permissionType: PermissionTypes.MEMORIES,
    permission: Permissions.UPDATE,
  });

  const hasCreateAccess = useHasAccess({
    permissionType: PermissionTypes.MEMORIES,
    permission: Permissions.CREATE,
  });

  const hasOptOutAccess = useHasAccess({
    permissionType: PermissionTypes.MEMORIES,
    permission: Permissions.OPT_OUT,
  });

  const memories: TUserMemory[] = useMemo(() => memData?.memories ?? [], [memData]);

  const filteredMemories = useMemo(() => {
    return matchSorter(memories, searchQuery, {
      keys: ['key', 'value'],
    });
  }, [memories, searchQuery]);

  const currentRows = useMemo(() => {
    return filteredMemories.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
  }, [filteredMemories, pageIndex]);

  const getProgressBarColor = (percentage: number): string => {
    if (percentage > 90) return 'text-red-500';
    if (percentage > 75) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getProgressBarBgColor = (percentage: number): string => {
    if (percentage > 90) return 'bg-red-500';
    if (percentage > 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (!isAuthenticated) {
    return null;
  }

  // Format join date if available
  const joinDate = userData?.createdAt
    ? formatDistanceToNow(new Date(userData.createdAt), { addSuffix: true })
    : null;

  // Get role display name
  const roleDisplayName = useMemo(() => {
    if (!user?.role) return localize('com_nav_user');
    return user.role === SystemRoles.ADMIN ? 'Administrator' : 'User';
  }, [user?.role, localize]);

  // ProfileContent just returns the content - wrapper is handled by ProfilePage
  return (
    <div className="flex flex-col gap-6">
      {/* Top Row - User Info Card (Left) + Memory Usage Card (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* User Info Card - Takes 3 columns */}
              <div className="lg:col-span-3 rounded-2xl border border-border-medium p-6">
                <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
                  {/* Avatar Section */}
                  <AvatarUploadSection user={user} />

                  {/* User Info */}
                  <div className="flex-1 space-y-3 text-center sm:text-left">
                    <div>
                      <h2 className="text-xl font-semibold text-text-primary">
                        {user?.name || user?.username || localize('com_nav_user')}
                      </h2>
                      {user?.username && user?.name && (
                        <p className="text-sm text-text-tertiary">@{user.username}</p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-4">
                      {/* Email */}
                      {user?.email && (
                        <div className="flex items-center justify-center sm:justify-start gap-2 text-sm text-text-secondary">
                          <Mail className="h-4 w-4 text-text-tertiary" />
                          <span>{user.email}</span>
                        </div>
                      )}

                      {/* Role */}
                      <div className="flex items-center justify-center sm:justify-start gap-2 text-sm">
                        <Shield className="h-4 w-4 text-text-tertiary" />
                        <span className={cn(
                          'rounded-full px-2.5 py-0.5 text-xs font-medium',
                          user?.role === SystemRoles.ADMIN
                            ? 'bg-purple-500/15 text-purple-400'
                            : 'bg-blue-500/15 text-blue-400'
                        )}>
                          {roleDisplayName}
                        </span>
                      </div>

                      {/* Join Date */}
                      {joinDate && (
                        <div className="flex items-center justify-center sm:justify-start gap-2 text-sm text-text-secondary">
                          <Calendar className="h-4 w-4 text-text-tertiary" />
                          <span>Joined {joinDate}</span>
                        </div>
                      )}
                    </div>

                    {/* Memory Toggle */}
                    {hasOptOutAccess && (
                      <div className="flex items-center justify-center sm:justify-start gap-3 pt-2">
                        <span className="text-sm text-text-secondary">{localize('com_ui_use_memory')}</span>
                        <Switch
                          checked={referenceSavedMemories ?? false}
                          onCheckedChange={handleMemoryToggle}
                          disabled={updateMemoryPreferencesMutation.isLoading || referenceSavedMemories === undefined}
                          aria-label={localize('com_ui_use_memory')}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Memory Usage Card - Takes 2 columns */}
              {hasMemoryAccess && memData?.tokenLimit && (
                <div className="lg:col-span-2 rounded-2xl border border-border-medium p-6">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-sm font-medium text-text-secondary">{localize('com_ui_memories')}</h3>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    {/* Circular Progress */}
                    <div className="relative size-24 shrink-0">
                      <svg className="size-24 -rotate-90 transform" viewBox="0 0 100 100">
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          stroke="currentColor"
                          strokeWidth="10"
                          fill="none"
                          className="text-surface-tertiary"
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          stroke="currentColor"
                          strokeWidth="10"
                          fill="none"
                          strokeDasharray={`${2 * Math.PI * 40}`}
                          strokeDashoffset={`${2 * Math.PI * 40 * (1 - (memData.usagePercentage ?? 0) / 100)}`}
                          className={`transition-all duration-500 ${getProgressBarColor(memData.usagePercentage ?? 0)}`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`text-xl font-bold ${getProgressBarColor(memData.usagePercentage ?? 0)}`}>
                          {memData.usagePercentage}%
                        </span>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex-1 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-text-secondary">Total</span>
                        <span className="text-lg font-semibold text-text-primary">{memories.length}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-text-secondary">Limit</span>
                        <span className="text-sm text-text-tertiary">{memData.tokenLimit.toLocaleString()} tokens</span>
                      </div>
                      {/* Progress bar */}
                      <div className="h-1.5 w-full rounded-full bg-surface-tertiary overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${getProgressBarBgColor(memData.usagePercentage ?? 0)}`}
                          style={{ width: `${memData.usagePercentage ?? 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Memories List Section */}
            {hasMemoryAccess && (
              <div className="space-y-4">
                {/* Section Header with Search and Create */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                    <Input
                      placeholder={localize('com_ui_memories_filter')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 border-border-medium bg-transparent"
                    />
                  </div>
                  {hasCreateAccess && (
                    <MemoryCreateDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                      <OGDialogTrigger asChild>
                        <Button variant="outline" className="shrink-0 border-border-medium">
                          <Plus className="mr-2 size-4 text-text-tertiary" />
                          <span>{localize('com_ui_create_memory')}</span>
                        </Button>
                      </OGDialogTrigger>
                    </MemoryCreateDialog>
                  )}
                </div>

                {/* Memories Grid */}
                {isMemoriesLoading ? (
                  <div className="flex h-32 w-full items-center justify-center">
                    <Spinner />
                  </div>
                ) : currentRows.length ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {currentRows.map((memory: TUserMemory, idx: number) => (
                      <div
                        key={idx}
                        className="group flex items-start justify-between gap-3 rounded-xl border border-border-medium p-4 transition-all hover:border-border-heavy"
                      >
                        <p className="flex-1 text-sm text-text-primary leading-relaxed">
                          {memory.value}
                        </p>
                        {hasUpdateAccess && (
                          <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <EditMemoryButton memory={memory} />
                            <DeleteMemoryButton memory={memory} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-medium p-12 text-center">
                    <div className="mb-3 rounded-full bg-surface-tertiary p-3">
                      <Search className="h-6 w-6 text-text-tertiary" />
                    </div>
                    <p className="text-sm text-text-secondary">{localize('com_ui_no_memories')}</p>
                  </div>
                )}

                {/* Pagination */}
                {filteredMemories.length > pageSize && (
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPageIndex((prev) => Math.max(prev - 1, 0))}
                      disabled={pageIndex === 0}
                      className="border-border-medium"
                    >
                      {localize('com_ui_prev')}
                    </Button>
                    <span className="px-3 text-sm text-text-secondary">
                      {pageIndex + 1} / {Math.ceil(filteredMemories.length / pageSize)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPageIndex((prev) =>
                          (prev + 1) * pageSize < filteredMemories.length ? prev + 1 : prev,
                        )
                      }
                      disabled={(pageIndex + 1) * pageSize >= filteredMemories.length}
                      className="border-border-medium"
                    >
                      {localize('com_ui_next')}
                    </Button>
                  </div>
                )}
              </div>
            )}
    </div>
  );
};

/**
 * ProfilePage - User profile and settings management page
 * 
 * Features:
 * - Left sidebar with settings tabs (Profile, General, Chat, Commands, Speech, Data, Account)
 * - Profile tab as default landing page with user info and memory management
 * - All settings integrated in one page instead of modal
 */
const ProfilePage: React.FC = () => {
  const localize = useLocalize();
  const { user, isAuthenticated } = useAuthContext();
  const { data: startupConfig } = useGetStartupConfig();
  const isSmallScreen = useMediaQuery('(max-width: 767px)');
  
  // Use 'profile' as default tab - profile is always landing page
  const [activeTab, setActiveTab] = useState('profile');
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Check if memories are accessible for Profile tab
  const hasMemoryAccess = useHasAccess({
    permissionType: PermissionTypes.MEMORIES,
    permission: Permissions.READ,
  });

  useDocumentTitle('Settings | Ranger');

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const tabs = settingsTabs.map(t => t.value);
    const currentIndex = tabs.indexOf(activeTab);

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveTab(tabs[(currentIndex + 1) % tabs.length]);
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveTab(tabs[(currentIndex - 1 + tabs.length) % tabs.length]);
        break;
      case 'Home':
        event.preventDefault();
        setActiveTab(tabs[0]);
        break;
      case 'End':
        event.preventDefault();
        setActiveTab(tabs[tabs.length - 1]);
        break;
    }
  };

  // Check if user is admin
  const isAdmin = user?.role === SystemRoles.ADMIN;

  // Build tabs list - Profile first, then settings tabs
  const settingsTabs: {
    value: string;
    icon: React.JSX.Element;
    label: TranslationKeys;
  }[] = useMemo(() => {
    const tabs: { value: string; icon: React.JSX.Element; label: TranslationKeys }[] = [
      {
        value: 'profile',
        icon: <User className="icon-sm" />,
        label: 'com_nav_profile',
      },
      {
        value: SettingsTabValues.GENERAL,
        icon: <GearIcon />,
        label: 'com_nav_setting_general',
      },
      {
        value: SettingsTabValues.CHAT,
        icon: <MessageSquare className="icon-sm" />,
        label: 'com_nav_setting_chat',
      },
      {
        value: SettingsTabValues.COMMANDS,
        icon: <Command className="icon-sm" />,
        label: 'com_nav_commands',
      },
      {
        value: SettingsTabValues.SPEECH,
        icon: <SpeechIcon className="icon-sm" />,
        label: 'com_nav_setting_speech',
      },
      {
        value: 'shared-links',
        icon: <Link2 className="icon-sm" />,
        label: 'com_nav_shared_links',
      },
    ];

    // Add Data Controls tab only for admin users
    if (isAdmin) {
      tabs.push({
        value: SettingsTabValues.DATA,
        icon: <DataIcon />,
        label: 'com_nav_setting_data',
      });
    }

    // Add balance tab if enabled
    if (startupConfig?.balance?.enabled) {
      tabs.push({
        value: SettingsTabValues.BALANCE,
        icon: <DollarSign size={18} />,
        label: 'com_nav_setting_balance' as TranslationKeys,
      });
    }

    // Add account tab only for admin users
    if (isAdmin) {
      tabs.push({
        value: SettingsTabValues.ACCOUNT,
        icon: <User className="icon-sm" />,
        label: 'com_nav_setting_account',
      });
    }

    return tabs;
  }, [startupConfig?.balance?.enabled, isAdmin]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  if (!isAuthenticated) {
    return null;
  }

  // Get page title based on active tab
  const getPageTitle = () => {
    if (activeTab === 'profile') return localize('com_nav_profile');
    if (activeTab === 'shared-links') return localize('com_nav_shared_links');
    return localize('com_nav_settings');
  };

  // Get page subtitle based on active tab
  const getPageSubtitle = () => {
    if (activeTab === 'profile') return localize('com_nav_profile_subtitle');
    if (activeTab === 'shared-links') return 'Manage your shared conversation links';
    return 'Customize your preferences and manage your account';
  };

  return (
    <PageContainer>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-text-primary">
            {getPageTitle()}
          </h2>
          <p className="text-sm text-text-secondary">
            {getPageSubtitle()}
          </p>
        </div>
        {/* Admin Settings Icon - Only visible to admins on profile tab */}
        {activeTab === 'profile' && user?.role === SystemRoles.ADMIN && hasMemoryAccess && (
          <AdminSettings />
        )}
      </div>

            {/* Main Content with Tabs */}
            <Tabs.Root
              value={activeTab}
              onValueChange={handleTabChange}
              className="flex flex-col gap-6 md:flex-row md:gap-10"
              orientation="vertical"
            >
              {/* Left Sidebar - Settings Tabs */}
              <Tabs.List
                aria-label="Settings"
                className={cn(
                  'min-w-auto max-w-auto relative flex flex-shrink-0 flex-col flex-nowrap overflow-auto',
                  isSmallScreen
                    ? 'flex-row rounded-xl bg-surface-secondary p-1'
                    : 'sticky top-0 h-fit min-w-[200px]',
                )}
                onKeyDown={handleKeyDown}
              >
                {settingsTabs.map(({ value, icon, label }) => (
                  <Tabs.Trigger
                    key={value}
                    className={cn(
                      'group relative z-10 flex items-center justify-start gap-2 rounded-xl px-3 py-2 transition-all duration-200 ease-in-out',
                      isSmallScreen
                        ? 'flex-1 justify-center text-nowrap px-3 text-sm text-text-secondary radix-state-active:bg-surface-hover radix-state-active:text-text-primary'
                        : 'bg-transparent text-text-secondary hover:bg-surface-hover radix-state-active:bg-surface-tertiary radix-state-active:text-text-primary',
                    )}
                    value={value}
                    ref={(el) => (tabRefs.current[value] = el)}
                  >
                    {icon}
                    {localize(label)}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>

              {/* Right Content Area */}
              <div className="flex-1 overflow-auto">
                {/* Profile Tab */}
                <Tabs.Content value="profile" tabIndex={-1} className="outline-none">
                  <ProfileContent />
                </Tabs.Content>

                {/* Settings Tabs */}
                <Tabs.Content value={SettingsTabValues.GENERAL} tabIndex={-1}>
                  <General />
                </Tabs.Content>
                <Tabs.Content value={SettingsTabValues.CHAT} tabIndex={-1}>
                  <Chat />
                </Tabs.Content>
                <Tabs.Content value={SettingsTabValues.COMMANDS} tabIndex={-1}>
                  <Commands />
                </Tabs.Content>
                <Tabs.Content value={SettingsTabValues.SPEECH} tabIndex={-1}>
                  <Speech />
                </Tabs.Content>
                <Tabs.Content value="shared-links" tabIndex={-1}>
                  <SharedLinksPage />
                </Tabs.Content>
                {isAdmin && (
                  <Tabs.Content value={SettingsTabValues.DATA} tabIndex={-1}>
                    <Data />
                  </Tabs.Content>
                )}
                {startupConfig?.balance?.enabled && (
                  <Tabs.Content value={SettingsTabValues.BALANCE} tabIndex={-1}>
                    <Balance />
                  </Tabs.Content>
                )}
                {isAdmin && (
                  <Tabs.Content value={SettingsTabValues.ACCOUNT} tabIndex={-1}>
                    <Account />
                  </Tabs.Content>
                )}
              </div>
            </Tabs.Root>
    </PageContainer>
  );
};

export default ProfilePage;
