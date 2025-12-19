import React, { useState } from 'react';
import { useRecoilValue } from 'recoil';
import { Camera, ImagePlus } from 'lucide-react';
import {
  Button,
  OGDialog,
  OGDialogTrigger,
  Avatar as AvatarComponent,
} from '@ranger/client';
import type { TUser } from 'ranger-data-provider';
import { useLocalize } from '~/hooks';
import AvatarUploadModal from './AvatarUploadModal';
import store from '~/store';

function Avatar() {
  const user = useRecoilValue(store.user);
  const [isDialogOpen, setDialogOpen] = useState<boolean>(false);
  const localize = useLocalize();

  return (
    <OGDialog open={isDialogOpen} onOpenChange={setDialogOpen}>
      {/* Profile Picture Section */}
      <div className="flex items-center gap-4 rounded-xl bg-surface-primary-alt p-4">
        {/* Current Avatar Preview */}
        <div className="relative">
          <div className="h-16 w-16 overflow-hidden rounded-full ring-2 ring-border-medium">
            <AvatarComponent user={user as TUser} size={64} />
          </div>
          <OGDialogTrigger asChild>
            <button
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-surface-primary shadow-md ring-2 ring-surface-primary transition-transform hover:scale-110"
              aria-label={localize('com_nav_change_picture')}
            >
              <Camera className="h-3.5 w-3.5 text-text-primary" />
            </button>
          </OGDialogTrigger>
        </div>
        
        {/* Info & Actions */}
        <div className="flex-1">
          <p className="text-sm font-medium text-text-primary">{localize('com_nav_profile_picture')}</p>
          <p className="text-xs text-text-secondary">
            {user?.avatar ? localize('com_ui_custom_avatar') : localize('com_ui_default_avatar')}
          </p>
        </div>

        {/* Change Button */}
        <OGDialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <ImagePlus className="h-4 w-4" />
            <span className="hidden sm:inline">{localize('com_nav_change_picture')}</span>
          </Button>
        </OGDialogTrigger>
      </div>

      {/* Shared Modal Component */}
      <AvatarUploadModal onClose={() => setDialogOpen(false)} />
    </OGDialog>
  );
}

export default Avatar;
