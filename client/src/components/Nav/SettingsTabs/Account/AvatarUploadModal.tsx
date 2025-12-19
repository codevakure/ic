import React, { useState, useRef, useCallback } from 'react';
import { useSetRecoilState, useRecoilValue } from 'recoil';
// @ts-ignore - no type definitions available
import AvatarEditor from 'react-avatar-editor';
import { RotateCw, Upload, ZoomIn, ZoomOut, Move, X, Camera, Trash2 } from 'lucide-react';
import { fileConfig as defaultFileConfig, mergeFileConfig } from 'ranger-data-provider';
import {
  Label,
  Slider,
  Button,
  Spinner,
  OGDialogContent,
  useToastContext,
} from '@ranger/client';
import type { TUser } from 'ranger-data-provider';
import { useUploadAvatarMutation, useResetAvatarMutation, useGetFileConfig } from '~/data-provider';
import { cn, formatBytes } from '~/utils';
import { useLocalize } from '~/hooks';
import store from '~/store';

interface AvatarEditorRef {
  getImageScaledToCanvas: () => HTMLCanvasElement;
  getImage: () => HTMLImageElement;
}

interface Position {
  x: number;
  y: number;
}

interface AvatarUploadModalProps {
  onClose: () => void;
}

function AvatarUploadModal({ onClose }: AvatarUploadModalProps) {
  const setUser = useSetRecoilState(store.user);
  const user = useRecoilValue(store.user);

  const [scale, setScale] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [position, setPosition] = useState<Position>({ x: 0.5, y: 0.5 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const editorRef = useRef<AvatarEditorRef | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<string | File | null>(null);

  const { data: fileConfig = defaultFileConfig } = useGetFileConfig({
    select: (data) => mergeFileConfig(data),
  });

  const localize = useLocalize();
  const { showToast } = useToastContext();

  // Check if user has a custom avatar
  const hasCustomAvatar = user?.avatar && user.avatar.length > 0;

  const { mutate: uploadAvatar, isLoading: isUploading } = useUploadAvatarMutation({
    onSuccess: (data) => {
      showToast({ message: localize('com_ui_upload_success') });
      setUser((prev) => ({ ...prev, avatar: data.url }) as TUser);
      onClose();
      resetImage();
    },
    onError: (error) => {
      console.error('Error:', error);
      showToast({ message: localize('com_ui_upload_error'), status: 'error' });
    },
  });

  const { mutate: resetAvatarMutation, isLoading: isResettingAvatar } = useResetAvatarMutation({
    onSuccess: () => {
      showToast({ message: localize('com_ui_avatar_reset_success') });
      setUser((prev) => ({ ...prev, avatar: '' } as TUser));
      onClose();
    },
    onError: (error) => {
      console.error('Error resetting avatar:', error);
      showToast({ message: localize('com_ui_avatar_reset_error'), status: 'error' });
    },
  });

  const handleResetAvatar = () => {
    resetAvatarMutation();
  };

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (fileConfig.avatarSizeLimit != null && file && file.size <= fileConfig.avatarSizeLimit) {
        setImage(file);
        setScale(1);
        setRotation(0);
        setPosition({ x: 0.5, y: 0.5 });
      } else {
        const megabytes =
          fileConfig.avatarSizeLimit != null ? formatBytes(fileConfig.avatarSizeLimit) : 2;
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

  const handleSelectFileClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    openFileDialog();
  };

  const resetImage = useCallback(() => {
    setImage(null);
    setScale(1);
    setRotation(0);
    setPosition({ x: 0.5, y: 0.5 });
  }, []);

  const handleResetAdjustments = () => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0.5, y: 0.5 });
  };

  return (
    <OGDialogContent showCloseButton={false} className="w-11/12 max-w-md overflow-hidden rounded-2xl border-0 bg-surface-primary p-0 shadow-2xl">
      {/* Close Button - properly positioned */}
      <button
        onClick={onClose}
        className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-surface-secondary text-text-secondary transition-all hover:bg-surface-tertiary hover:text-text-primary"
        aria-label={localize('com_ui_close')}
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex flex-col items-center justify-center p-6 pt-10">
        {image != null ? (
            <>
              {/* Avatar Editor */}
              <div
                className={cn(
                  'relative overflow-hidden rounded-full shadow-xl ring-4 ring-surface-tertiary transition-all',
                  isDragging && 'cursor-move ring-surface-submit/50',
                )}
                onMouseDown={() => setIsDragging(true)}
                onMouseUp={() => setIsDragging(false)}
                onMouseLeave={() => setIsDragging(false)}
              >
                <AvatarEditor
                  ref={editorRef}
                  image={image}
                  width={200}
                  height={200}
                  border={0}
                  borderRadius={100}
                  color={[0, 0, 0, 0.6]}
                  scale={scale}
                  rotate={rotation}
                  position={position}
                  onPositionChange={handlePositionChange}
                  className="cursor-move"
                />
                {!isDragging && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition-all hover:bg-black/20">
                    <Move className="h-8 w-8 text-white opacity-0 transition-opacity hover:opacity-100" />
                  </div>
                )}
              </div>

              {/* Controls Card */}
              <div className="mt-6 w-full space-y-4 rounded-xl bg-surface-secondary p-4">
                {/* Zoom Controls */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="zoom-slider" className="text-xs font-medium text-text-secondary">
                      {localize('com_ui_zoom')}
                    </Label>
                    <span className="rounded-md bg-surface-tertiary px-2 py-0.5 text-xs font-medium text-text-primary">
                      {Math.round(scale * 100)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleZoomOut}
                      disabled={scale <= 1}
                      aria-label={localize('com_ui_zoom_out')}
                      className="h-8 w-8 shrink-0 rounded-lg p-0"
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
                      variant="ghost"
                      size="sm"
                      onClick={handleZoomIn}
                      disabled={scale >= 5}
                      aria-label={localize('com_ui_zoom_in')}
                      className="h-8 w-8 shrink-0 rounded-lg p-0"
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Rotate & Reset Adjustments */}
                <div className="flex items-center justify-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRotate}
                    className="flex items-center gap-1.5 rounded-lg"
                    aria-label={localize('com_ui_rotate_90')}
                  >
                    <RotateCw className="h-4 w-4" />
                    <span className="text-xs">{localize('com_ui_rotate')}</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleResetAdjustments}
                    className="flex items-center gap-1.5 rounded-lg"
                    aria-label={localize('com_ui_reset_adjustments')}
                  >
                    <X className="h-4 w-4" />
                    <span className="text-xs">{localize('com_ui_reset')}</span>
                  </Button>
                </div>
              </div>

              {/* Helper Text */}
              <p className="mt-3 text-center text-xs text-text-tertiary">
                {localize('com_ui_editor_instructions')}
              </p>

              {/* Action Buttons */}
              <div className="mt-4 flex w-full gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 rounded-xl"
                  onClick={resetImage}
                  disabled={isUploading}
                >
                  {localize('com_ui_cancel')}
                </Button>
                <Button
                  type="button"
                  className={cn(
                    'flex-1 rounded-xl bg-surface-submit text-white hover:bg-surface-submit-hover',
                    isUploading && 'cursor-not-allowed opacity-90',
                  )}
                  onClick={handleUpload}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <Spinner className="mr-2 h-4 w-4" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  {localize('com_ui_save')}
                </Button>
              </div>
            </>
          ) : (
            /* Upload Zone - Modern Design */
            <div className="w-full space-y-4">
              <div
                className="group flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border-medium bg-surface-secondary/50 p-6 transition-all hover:border-surface-submit hover:bg-surface-tertiary/50"
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
                aria-label={localize('com_ui_upload_avatar_label')}
              >
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-submit/10 transition-colors group-hover:bg-surface-submit/20">
                  <Camera className="h-6 w-6 text-text-secondary transition-colors group-hover:text-surface-submit" />
                </div>
                <p className="mb-1 text-center text-sm font-medium text-text-primary">
                  {localize('com_ui_drag_drop')}
                </p>
                <p className="mb-3 text-center text-xs text-text-tertiary">
                  PNG, JPG {localize('com_ui_or')} JPEG •{' '}
                  {localize('com_ui_max_var', {
                    0:
                      fileConfig.avatarSizeLimit != null
                        ? formatBytes(fileConfig.avatarSizeLimit)
                        : '2MB',
                  })}
                </p>
                <Button
                  type="button"
                  className="rounded-lg bg-surface-submit px-5 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-surface-submit-hover hover:shadow-md"
                  onClick={handleSelectFileClick}
                >
                  {localize('com_ui_select_file')}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".png, .jpg, .jpeg"
                  onChange={handleFileChange}
                  aria-label={localize('com_ui_file_input_avatar_label')}
                />
              </div>

              {/* Reset to Initials Button - only show if user has custom avatar */}
              {hasCustomAvatar && (
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-transparent py-2.5 text-sm font-medium text-red-500 transition-all hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/30"
                  onClick={handleResetAvatar}
                  disabled={isResettingAvatar}
                >
                  {isResettingAvatar ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  {localize('com_ui_reset_avatar')}
                </button>
              )}
            </div>
          )}
        </div>
    </OGDialogContent>
  );
}

export default AvatarUploadModal;
