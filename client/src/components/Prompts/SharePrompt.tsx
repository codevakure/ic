import React from 'react';
import { Share2Icon } from 'lucide-react';
import {
  SystemRoles,
  Permissions,
  ResourceType,
  PermissionBits,
  PermissionTypes,
} from 'librechat-data-provider';
import { Button } from '@librechat/client';
import type { TPromptGroup } from 'librechat-data-provider';
import { useAuthContext, useHasAccess, useResourcePermissions } from '~/hooks';
import { GenericGrantAccessDialog } from '~/components/Sharing';
import { cn } from '~/utils';

interface SharePromptProps {
  group?: TPromptGroup;
  disabled: boolean;
  className?: string;
  iconClassName?: string;
  variant?: 'default' | 'ghost';
}

const SharePrompt = React.memo(
  ({ group, disabled, className, iconClassName, variant = 'default' }: SharePromptProps) => {
    const { user } = useAuthContext();

    // Check if user has permission to share prompts globally
    const hasAccessToSharePrompts = useHasAccess({
      permissionType: PermissionTypes.PROMPTS,
      permission: Permissions.SHARED_GLOBAL,
    });

    // Check user's permissions on this specific promptGroup
    // The query will be disabled if groupId is empty
    const groupId = group?._id || '';
    const { hasPermission, isLoading: permissionsLoading } = useResourcePermissions(
      ResourceType.PROMPTGROUP,
      groupId,
    );

    // Early return if no group
    if (!group || !groupId) {
      return null;
    }

    const canShareThisPrompt = hasPermission(PermissionBits.SHARE);

    const shouldShowShareButton =
      (group.author === user?.id || user?.role === SystemRoles.ADMIN || canShareThisPrompt) &&
      hasAccessToSharePrompts &&
      !permissionsLoading;

    if (!shouldShowShareButton) {
      return null;
    }

    return (
      <GenericGrantAccessDialog
        resourceDbId={groupId}
        resourceName={group.name}
        resourceType={ResourceType.PROMPTGROUP}
        disabled={disabled}
      >
        <Button
          variant={variant === 'ghost' ? 'ghost' : 'outline'}
          size="sm"
          aria-label="Share prompt"
          className={cn(
            variant === 'ghost' 
              ? 'h-7 w-7 p-0 text-text-tertiary hover:bg-surface-hover hover:text-text-primary' 
              : 'h-10 w-10 border border-border-light bg-surface-secondary p-0.5 transition-all hover:bg-surface-hover',
            className
          )}
          disabled={disabled}
        >
          <Share2Icon className={cn(
            variant === 'ghost' ? 'h-4 w-4' : 'size-5 cursor-pointer text-text-secondary',
            iconClassName
          )} />
        </Button>
      </GenericGrantAccessDialog>
    );
  },
);

SharePrompt.displayName = 'SharePrompt';

export default SharePrompt;
