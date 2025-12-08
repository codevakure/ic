import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useSetRecoilState } from 'recoil';
import { formatDistanceToNow } from 'date-fns';
import { matchSorter } from 'match-sorter';
// @ts-ignore - no type definitions available
import AvatarEditor from 'react-avatar-editor';
import {
  Mail,
  Shield,
  Calendar,
  Camera,
  Upload,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Move,
  X,
  Plus,
  Search,
} from 'lucide-react';
import {
  fileConfig as defaultFileConfig,
  mergeFileConfig,
  SystemRoles,
  PermissionTypes,
  Permissions,
} from 'ranger-data-provider';
import {
  Label,
  Slider,
  Button,
  Spinner,
  Switch,
  OGDialog,
  OGDialogContent,
  OGDialogHeader,
  OGDialogTitle,
  OGDialogTrigger,
  Input,
  EditIcon,
  TrashIcon,
  TooltipAnchor,
  OGDialogTemplate,
  useToastContext,
  Avatar as AvatarComponent,
} from '@ranger/client';
import type { TUser, TUserMemory } from 'ranger-data-provider';
import {
  useUploadAvatarMutation,
  useGetFileConfig,
  useGetUserQuery,
  useMemoriesQuery,
  useDeleteMemoryMutation,
  useUpdateMemoryPreferencesMutation,
} from '~/data-provider';
import { useDocumentTitle, useLocalize, useAuthContext, useHasAccess } from '~/hooks';
import MemoryCreateDialog from '~/components/SidePanel/Memories/MemoryCreateDialog';
import MemoryEditDialog from '~/components/SidePanel/Memories/MemoryEditDialog';
import AdminSettings from '~/components/SidePanel/Memories/AdminSettings';
import { cn, formatBytes } from '~/utils';
import store from '~/store';

interface AvatarEditorRef {
  getImageScaledToCanvas: () => HTMLCanvasElement;
  getImage: () => HTMLImageElement;
}

interface Position {
  x: number;
  y: number;
}

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

// Avatar Upload Section Component
const AvatarUploadSection: React.FC<{ user: TUser | undefined }> = ({ user }) => {
  const localize = useLocalize();
  const setUser = useSetRecoilState(store.user);
  const { showToast } = useToastContext();

  const [scale, setScale] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [position, setPosition] = useState<Position>({ x: 0.5, y: 0.5 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const editorRef = useRef<AvatarEditorRef | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<string | File | null>(null);
  const [isDialogOpen, setDialogOpen] = useState<boolean>(false);

  const { data: fileConfig = defaultFileConfig } = useGetFileConfig({
    select: (data) => mergeFileConfig(data),
  });

  const { mutate: uploadAvatar, isLoading: isUploading } = useUploadAvatarMutation({
    onSuccess: (data) => {
      showToast({ message: localize('com_ui_upload_success') });
      setUser((prev) => ({ ...prev, avatar: data.url }) as TUser);
      setDialogOpen(false);
      resetImage();
    },
    onError: (error) => {
      console.error('Error:', error);
      showToast({ message: localize('com_ui_upload_error'), status: 'error' });
    },
  });

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (fileConfig.avatarSizeLimit != null && file && file.size <= fileConfig.avatarSizeLimit) {
        setImage(file);
        setScale(1);
        setRotation(0);
        setPosition({ x: 0.5, y: 0.5 });
      } else {
        const megabytes =
          fileConfig.avatarSizeLimit != null ? formatBytes(fileConfig.avatarSizeLimit) : '2MB';
        showToast({
          message: localize('com_ui_upload_invalid_var', { 0: megabytes + '' }),
          status: 'error',
        });
      }
    },
    [fileConfig.avatarSizeLimit, localize, showToast],
  );

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    handleFile(file);
  };

  const handleScaleChange = (value: number[]) => {
    setScale(value[0]);
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.2, 5));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.2, 1));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handlePositionChange = (position: Position) => {
    setPosition(position);
  };

  const handleUpload = () => {
    if (editorRef.current) {
      const canvas = editorRef.current.getImageScaledToCanvas();
      canvas.toBlob((blob) => {
        if (blob) {
          const formData = new FormData();
          formData.append('file', blob, 'avatar.png');
          formData.append('manual', 'true');
          uploadAvatar(formData);
        }
      }, 'image/png');
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const openFileDialog = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const resetImage = useCallback(() => {
    setImage(null);
    setScale(1);
    setRotation(0);
    setPosition({ x: 0.5, y: 0.5 });
  }, []);

  const handleReset = () => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0.5, y: 0.5 });
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Current Avatar Display */}
      <div className="relative">
        <div className="h-32 w-32 overflow-hidden rounded-full ring-4 ring-surface-tertiary">
          <AvatarComponent user={user} size={128} />
        </div>
        <OGDialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              resetImage();
            }
          }}
        >
          <OGDialogTrigger asChild>
            <button
              className="absolute bottom-0 right-0 flex h-10 w-10 items-center justify-center rounded-full bg-surface-submit text-white shadow-lg transition-transform hover:scale-105"
              aria-label={localize('com_nav_change_picture')}
            >
              <Camera className="h-5 w-5" />
            </button>
          </OGDialogTrigger>
          <OGDialogContent showCloseButton={false} className="w-11/12 max-w-md">
            <OGDialogHeader>
              <OGDialogTitle className="text-lg font-medium leading-6 text-text-primary">
                {image != null ? localize('com_ui_preview') : localize('com_ui_upload_image')}
              </OGDialogTitle>
            </OGDialogHeader>
            <div className="flex flex-col items-center justify-center p-2">
              {image != null ? (
                <>
                  <div
                    className={cn(
                      'relative overflow-hidden rounded-full ring-4 ring-gray-200 transition-all dark:ring-gray-700',
                      isDragging && 'cursor-move ring-blue-500 dark:ring-blue-400',
                    )}
                    onMouseDown={() => setIsDragging(true)}
                    onMouseUp={() => setIsDragging(false)}
                    onMouseLeave={() => setIsDragging(false)}
                  >
                    <AvatarEditor
                      ref={editorRef}
                      image={image}
                      width={280}
                      height={280}
                      border={0}
                      borderRadius={140}
                      color={[255, 255, 255, 0.6]}
                      scale={scale}
                      rotate={rotation}
                      position={position}
                      onPositionChange={handlePositionChange}
                      className="cursor-move"
                    />
                    {!isDragging && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity hover:opacity-100">
                        <div className="rounded-full bg-black/50 p-2">
                          <Move className="h-6 w-6 text-white" />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 w-full space-y-6">
                    {/* Zoom Controls */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="zoom-slider" className="text-sm font-medium">
                          {localize('com_ui_zoom')}
                        </Label>
                        <span className="text-sm text-text-secondary">{Math.round(scale * 100)}%</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleZoomOut}
                          disabled={scale <= 1}
                          className="shrink-0"
                        >
                          <ZoomOut className="h-4 w-4" />
                        </Button>
                        <Slider
                          id="zoom-slider"
                          value={[scale]}
                          min={1}
                          max={5}
                          step={0.1}
                          onValueChange={handleScaleChange}
                          className="flex-1"
                          aria-label={localize('com_ui_zoom_level')}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleZoomIn}
                          disabled={scale >= 5}
                          className="shrink-0"
                        >
                          <ZoomIn className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-center space-x-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleRotate}
                        className="flex items-center space-x-2"
                      >
                        <RotateCw className="h-4 w-4" />
                        <span className="text-sm">{localize('com_ui_rotate')}</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleReset}
                        className="flex items-center space-x-2"
                      >
                        <X className="h-4 w-4" />
                        <span className="text-sm">{localize('com_ui_reset')}</span>
                      </Button>
                    </div>

                    <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                      {localize('com_ui_editor_instructions')}
                    </p>
                  </div>

                  <div className="mt-6 flex w-full space-x-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={resetImage}
                      disabled={isUploading}
                    >
                      {localize('com_ui_cancel')}
                    </Button>
                    <Button
                      variant="submit"
                      type="button"
                      className={cn('flex-1', isUploading ? 'cursor-not-allowed opacity-90' : '')}
                      onClick={handleUpload}
                      disabled={isUploading}
                    >
                      {isUploading ? (
                        <Spinner className="icon-sm mr-2" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      {localize('com_ui_upload')}
                    </Button>
                  </div>
                </>
              ) : (
                <div
                  className="flex h-72 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-transparent transition-colors hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500"
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  role="button"
                  tabIndex={0}
                  onClick={openFileDialog}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openFileDialog();
                    }
                  }}
                >
                  <Camera className="mb-4 size-16 text-gray-400" />
                  <p className="mb-2 text-center text-sm font-medium text-text-primary">
                    {localize('com_ui_drag_drop')}
                  </p>
                  <p className="mb-4 text-center text-xs text-text-secondary">
                    {localize('com_ui_max_file_size', {
                      0: fileConfig.avatarSizeLimit != null
                        ? formatBytes(fileConfig.avatarSizeLimit)
                        : '2MB',
                    })}
                  </p>
                  <Button type="button" variant="secondary">
                    {localize('com_ui_select_file')}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".png, .jpg, .jpeg"
                    onChange={handleFileChange}
                  />
                </div>
              )}
            </div>
          </OGDialogContent>
        </OGDialog>
      </div>
    </div>
  );
};

/**
 * ProfilePage - User profile management page
 * 
 * Features:
 * - User information display (name, email, role, join date)
 * - Profile picture upload and reset
 * - Memory management (view, create, edit, delete)
 * - Admin settings (only visible to admins)
 */
const ProfilePage: React.FC = () => {
  const localize = useLocalize();
  const { user, isAuthenticated } = useAuthContext();
  const { data: userData } = useGetUserQuery();
  const { data: memData, isLoading: isMemoriesLoading } = useMemoriesQuery();
  const { showToast } = useToastContext();
  
  // Memory state
  const [pageIndex, setPageIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [referenceSavedMemories, setReferenceSavedMemories] = useState(true);
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
      setReferenceSavedMemories((prev) => !prev);
    },
  });

  useEffect(() => {
    if (userData?.personalization?.memories !== undefined) {
      setReferenceSavedMemories(userData.personalization.memories);
    }
  }, [userData?.personalization?.memories]);

  const handleMemoryToggle = (checked: boolean) => {
    setReferenceSavedMemories(checked);
    updateMemoryPreferencesMutation.mutate({ memories: checked });
  };

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

  useDocumentTitle('Profile | Ranger');

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

  return (
    <div className="relative flex w-full grow overflow-hidden bg-presentation">
      <main className="flex h-full w-full flex-col overflow-hidden" role="main">
        <div className="scrollbar-gutter-stable relative flex h-full flex-col overflow-y-auto overflow-x-hidden">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-text-primary">
                  {localize('com_nav_profile')}
                </h1>
                <p className="text-sm text-text-secondary">
                  {localize('com_nav_profile_subtitle')}
                </p>
              </div>
              {/* Admin Settings Icon - Only visible to admins */}
              {user?.role === SystemRoles.ADMIN && hasMemoryAccess && (
                <AdminSettings />
              )}
            </div>

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
                          checked={referenceSavedMemories}
                          onCheckedChange={handleMemoryToggle}
                          disabled={updateMemoryPreferencesMutation.isLoading}
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
        </div>
      </main>
    </div>
  );
};

export default ProfilePage;
