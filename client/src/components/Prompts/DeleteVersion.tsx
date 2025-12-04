import React, { useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import { useDeletePrompt } from '~/data-provider';
import { Button, OGDialog, OGDialogTrigger, Label, OGDialogTemplate } from '@ranger/client';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

interface DeleteConfirmDialogProps {
  name: string;
  disabled?: boolean;
  selectHandler: () => void;
  className?: string;
  iconClassName?: string;
  variant?: 'default' | 'ghost';
}

const DeleteConfirmDialog = ({
  name,
  disabled,
  selectHandler,
  className,
  iconClassName,
  variant = 'default',
}: DeleteConfirmDialogProps) => {
  const localize = useLocalize();

  return (
    <OGDialog>
      <OGDialogTrigger asChild>
        <Button
          variant={variant === 'ghost' ? 'ghost' : 'destructive'}
          size="sm"
          aria-label="Delete version"
          className={cn(
            variant === 'ghost'
              ? 'h-7 w-7 p-0 text-text-tertiary hover:bg-surface-hover hover:text-red-500'
              : 'h-10 w-10 p-0.5',
            className
          )}
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <Trash2 className={cn(
            variant === 'ghost' ? 'h-4 w-4' : 'size-5 cursor-pointer text-white',
            iconClassName
          )} />
        </Button>
      </OGDialogTrigger>
      <OGDialogTemplate
        showCloseButton={false}
        title={localize('com_ui_delete_prompt')}
        className="max-w-[450px]"
        main={
          <>
            <div className="flex w-full flex-col items-center gap-2">
              <div className="grid w-full items-center gap-2">
                <Label
                  htmlFor="dialog-delete-confirm-prompt"
                  className="text-left text-sm font-medium"
                >
                  {localize('com_ui_delete_confirm_prompt_version_var', { 0: name })}
                </Label>
              </div>
            </div>
          </>
        }
        selection={{
          selectHandler,
          selectClasses:
            'bg-surface-destructive hover:bg-surface-destructive-hover transition-colors duration-200 text-white',
          selectText: localize('com_ui_delete'),
        }}
      />
    </OGDialog>
  );
};

interface DeletePromptProps {
  promptId?: string;
  groupId: string;
  promptName: string;
  disabled: boolean;
  className?: string;
  iconClassName?: string;
  variant?: 'default' | 'ghost';
}

const DeletePrompt = React.memo(
  ({ promptId, groupId, promptName, disabled, className, iconClassName, variant = 'default' }: DeletePromptProps) => {
    const deletePromptMutation = useDeletePrompt();

    const handleDelete = useCallback(() => {
      if (!promptId) {
        console.warn('No prompt ID provided for deletion');
        return;
      }
      deletePromptMutation.mutate({
        _id: promptId,
        groupId,
      });
    }, [promptId, groupId, deletePromptMutation]);

    if (!promptId) {
      return null;
    }

    return (
      <DeleteConfirmDialog
        name={promptName}
        disabled={disabled || !promptId}
        selectHandler={handleDelete}
        className={className}
        iconClassName={iconClassName}
        variant={variant}
      />
    );
  },
);

DeletePrompt.displayName = 'DeletePrompt';

export default DeletePrompt;
