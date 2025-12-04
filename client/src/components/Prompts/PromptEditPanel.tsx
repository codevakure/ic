import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useRecoilValue } from 'recoil';
import { useForm, FormProvider, Controller } from 'react-hook-form';
import { Rocket, HelpCircle, ChevronDown, Check, Share2, Trash2, Save } from 'lucide-react';
import {
  Button,
  Skeleton,
  useToastContext,
  TextareaAutosize,
  Input,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  TooltipAnchor,
} from '@ranger/client';
import {
  Permissions,
  ResourceType,
  PermissionBits,
  PermissionTypes,
  Constants,
} from 'ranger-data-provider';
import type { TCreatePrompt } from 'ranger-data-provider';
import {
  useGetPrompts,
  useGetPromptGroup,
  useAddPromptToGroup,
  useUpdatePromptGroup,
  useMakePromptProduction,
} from '~/data-provider';
import { useResourcePermissions, useHasAccess, useLocalize, useCategories } from '~/hooks';
import { usePromptGroupsContext } from '~/Providers';
import CategoryIcon from './Groups/CategoryIcon';
import DeleteVersion from './DeleteVersion';
import SharePrompt from './SharePrompt';
import { PromptsEditorMode } from '~/common';
import { cn, extractUniqueVariables } from '~/utils';
import store from '~/store';

interface PromptEditPanelProps {
  groupId: string;
  onClose: () => void;
  onHeaderActionsChange?: (actions: React.ReactNode) => void;
}

const MAX_DESC_LENGTH = 120;

/**
 * Prompt editing panel designed for push panel context
 */
const PromptEditPanel: React.FC<PromptEditPanelProps> = ({ groupId, onClose, onHeaderActionsChange }) => {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const alwaysMakeProd = useRecoilValue(store.alwaysMakeProd);
  const editorMode = useRecoilValue(store.promptsEditorMode);

  const [selectionIndex, setSelectionIndex] = useState<number>(0);
  const [description, setDescription] = useState('');
  const [command, setCommand] = useState('');

  const { hasAccess } = usePromptGroupsContext();
  const { categories, emptyCategory } = useCategories({ hasAccess });

  const hasShareAccess = useHasAccess({
    permissionType: PermissionTypes.PROMPTS,
    permission: Permissions.SHARED_GLOBAL,
  });

  const { data: group, isLoading: isLoadingGroup } = useGetPromptGroup(groupId, {
    enabled: !!groupId,
  });

  const { data: prompts = [], isLoading: isLoadingPrompts } = useGetPrompts(
    { groupId },
    { enabled: !!groupId },
  );

  const { hasPermission } = useResourcePermissions(
    ResourceType.PROMPTGROUP,
    group?._id || '',
  );

  const canEdit = hasPermission(PermissionBits.EDIT);

  const methods = useForm({
    defaultValues: {
      prompt: '',
      promptName: '',
    },
  });

  const { setValue, watch, control, reset } = methods;
  const promptText = watch('prompt');

  const variables = useMemo(() => extractUniqueVariables(promptText || ''), [promptText]);

  const selectedPrompt = useMemo(
    () => (prompts.length > 0 ? prompts[selectionIndex] : undefined),
    [prompts, selectionIndex],
  );

  const selectedPromptId = useMemo(() => selectedPrompt?._id || '', [selectedPrompt]);

  const currentCategory = useMemo(
    () => categories?.find((c) => c.value === group?.category) || emptyCategory,
    [categories, group?.category, emptyCategory],
  );

  const updateGroupMutation = useUpdatePromptGroup({
    onSuccess: () => {
      showToast({ status: 'success', message: localize('com_ui_saved') });
    },
    onError: () => {
      showToast({ status: 'error', message: localize('com_ui_prompt_update_error') });
    },
  });

  const addPromptToGroupMutation = useAddPromptToGroup({
    onMutate: () => setSelectionIndex(0),
    onSuccess: (data) => {
      showToast({ status: 'success', message: localize('com_ui_saved') });
      if (alwaysMakeProd && data.prompt._id && data.prompt.groupId) {
        makeProductionMutation.mutate({
          id: data.prompt._id,
          groupId: data.prompt.groupId,
          productionPrompt: { prompt: data.prompt.prompt ?? '' },
        });
      }
    },
    onError: () => {
      showToast({ status: 'error', message: localize('com_ui_prompt_update_error') });
    },
  });

  const makeProductionMutation = useMakePromptProduction({
    onSuccess: () => {
      showToast({ status: 'success', message: 'Set as production' });
    },
    onError: () => {
      showToast({ status: 'error', message: localize('com_ui_prompt_update_error') });
    },
  });

  // Update form when selected prompt changes
  useEffect(() => {
    if (selectedPrompt) {
      setValue('prompt', selectedPrompt.prompt || '', { shouldDirty: false });
    }
  }, [selectedPrompt, setValue]);

  // Update form when group data loads
  useEffect(() => {
    if (group) {
      setValue('promptName', group.name || '', { shouldDirty: false });
      setDescription(group.oneliner || '');
      setCommand(group.command || '');
    }
  }, [group, setValue]);

  const handleMakeProduction = useCallback(() => {
    if (!selectedPrompt || !group?._id) return;
    makeProductionMutation.mutate({
      id: selectedPrompt._id ?? '',
      groupId: group._id,
      productionPrompt: { prompt: selectedPrompt.prompt ?? '' },
    });
  }, [selectedPrompt, group, makeProductionMutation]);

  const handleSave = useCallback(() => {
    const value = promptText;
    const nameValue = methods.getValues('promptName');
    if (!canEdit) return;
    
    const groupIdToUse = group?._id;
    if (!groupIdToUse) return;

    // Check if we have any changes to save
    const promptChanged = selectedPrompt && value !== selectedPrompt.prompt;
    const nameChanged = nameValue !== group.name;
    const descChanged = description !== (group.oneliner || '');
    const cmdChanged = command !== (group.command || '');

    if (!promptChanged && !nameChanged && !descChanged && !cmdChanged) {
      showToast({ status: 'info', message: 'No changes to save' });
      return;
    }

    // Save group metadata if changed
    if (nameChanged || descChanged || cmdChanged) {
      const payload: { name?: string; oneliner?: string; command?: string } = {};
      if (nameChanged && nameValue.trim()) payload.name = nameValue;
      if (descChanged) payload.oneliner = description;
      if (cmdChanged) payload.command = command;
      if (Object.keys(payload).length > 0) {
        updateGroupMutation.mutate({ id: groupIdToUse, payload });
      }
    }

    // Save prompt text if changed
    if (promptChanged && value) {
      const tempPrompt: TCreatePrompt = {
        prompt: {
          type: selectedPrompt?.type ?? 'text',
          groupId: groupIdToUse,
          prompt: value,
        },
      };
      addPromptToGroupMutation.mutate({ ...tempPrompt, groupId: groupIdToUse });
    } else if (!promptChanged && (nameChanged || descChanged || cmdChanged)) {
      // Already saved via updateGroupMutation above
    }
  }, [promptText, canEdit, selectedPrompt, group, addPromptToGroupMutation, updateGroupMutation, showToast, description, command, methods]);

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length <= MAX_DESC_LENGTH) {
      setDescription(value);
    }
  };

  const handleCommandChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value.toLowerCase().replace(/\s/g, '-').replace(/[^a-z0-9-]/g, '');
    if (newValue.length <= Constants.COMMANDS_MAX_LENGTH) {
      setCommand(newValue);
    }
  };

  const handleCategoryChange = (value: string) => {
    if (!group?._id) return;
    updateGroupMutation.mutate({ id: group._id, payload: { name: group.name, category: value } });
  };

  // Computed values for version dropdown (must be before early returns)
  const isProduction = selectedPrompt?._id === group?.productionId;

  // Version dropdown for header actions - exposed to parent via callback
  const versionDropdown = useMemo(() => {
    if (!group || prompts.length === 0) return null;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-1.5 rounded-md border border-border-medium bg-surface-secondary px-2.5 py-1 text-xs text-text-primary transition-colors hover:bg-surface-hover">
            <span className="font-medium">v{prompts.length - selectionIndex}</span>
            {isProduction && (
              <span className="rounded bg-green-500/20 px-1.5 py-0.5 text-[10px] font-medium text-green-500">
                Prod
              </span>
            )}
            <ChevronDown className="h-3 w-3 text-text-secondary" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[140px]">
          {prompts.map((prompt, idx) => (
            <DropdownMenuItem
              key={prompt._id}
              onClick={() => setSelectionIndex(idx)}
              className="flex items-center justify-between text-xs"
            >
              <span className="text-text-primary">v{prompts.length - idx}</span>
              <span className="flex items-center gap-1.5">
                {prompt._id === group.productionId && (
                  <span className="rounded bg-green-500/20 px-1 py-0.5 text-[10px] text-green-500">
                    Prod
                  </span>
                )}
                {idx === selectionIndex && <Check className="h-3 w-3 text-text-primary" />}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }, [group, prompts, selectionIndex, isProduction]);

  // Notify parent of header actions when they change
  useEffect(() => {
    onHeaderActionsChange?.(versionDropdown);
  }, [versionDropdown, onHeaderActionsChange]);

  if (isLoadingGroup) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex items-center justify-center p-6 text-sm text-text-secondary">
        {localize('com_ui_nothing_found')}
      </div>
    );
  }

  const promptChanged = promptText !== (selectedPrompt?.prompt || '');
  const nameValue = methods.getValues('promptName');
  const nameChanged = nameValue !== group.name;
  const descChanged = description !== (group.oneliner || '');
  const cmdChanged = command !== (group.command || '');
  const hasChanges = promptChanged || nameChanged || descChanged || cmdChanged;
  const isSaving = addPromptToGroupMutation.isLoading || updateGroupMutation.isLoading;

  return (
    <FormProvider {...methods}>
      <div className="flex h-full flex-col bg-surface-primary">
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-4">
            {/* Name Input */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">
                {localize('com_ui_name')}
              </label>
              <Controller
                name="promptName"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    type="text"
                    className="h-9 border-border-medium bg-surface-secondary text-sm text-text-primary"
                    disabled={!canEdit}
                  />
                )}
              />
            </div>

            {/* Category Dropdown */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">
                {localize('com_ui_category')}
              </label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild disabled={!canEdit}>
                  <button className="flex h-9 w-full items-center justify-between rounded-lg border border-border-medium bg-surface-secondary px-3 text-sm text-text-primary transition-colors hover:bg-surface-hover disabled:opacity-50">
                    <span className="flex items-center gap-2">
                      <CategoryIcon category={currentCategory.value} className="h-4 w-4 text-text-secondary" />
                      <span>{currentCategory.label || localize('com_ui_select')}</span>
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-text-secondary" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[200px]">
                  {categories?.map((cat) => (
                    <DropdownMenuItem
                      key={cat.value}
                      onClick={() => handleCategoryChange(cat.value)}
                      className="flex items-center gap-2"
                    >
                      <CategoryIcon category={cat.value} className="h-4 w-4 text-text-secondary" />
                      <span className="text-text-primary">{cat.label}</span>
                      {cat.value === group.category && <Check className="ml-auto h-3.5 w-3.5 text-text-primary" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Prompt Text */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-sm font-medium text-text-primary">
                  {localize('com_ui_prompt_text')}
                </label>
                <TooltipAnchor
                  description="Use {{variable}} for custom variables. Special: {{current_date}}, {{current_user}}"
                  side="left"
                  className="text-text-tertiary transition-colors hover:text-text-secondary"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </TooltipAnchor>
              </div>
              <Controller
                name="prompt"
                control={control}
                render={({ field }) => (
                  <TextareaAutosize
                    {...field}
                    aria-label="Prompt text"
                    className="w-full resize-none rounded-lg border border-border-medium bg-surface-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary transition-colors focus:border-border-heavy focus:outline-none focus:ring-1 focus:ring-border-heavy"
                    minRows={4}
                    maxRows={10}
                    disabled={!canEdit}
                  />
                )}
              />
              {/* Variables tags */}
              {variables.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {variables.map((v, i) => (
                    <span key={i} className="rounded border border-border-light bg-surface-tertiary px-1.5 py-0.5 text-[11px] text-text-secondary">
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">
                {localize('com_ui_description')} 
                <span className="ml-1 text-xs font-normal text-text-tertiary">({description.length}/{MAX_DESC_LENGTH})</span>
              </label>
              <Input
                type="text"
                disabled={!canEdit}
                placeholder={localize('com_ui_description_placeholder')}
                value={description}
                onChange={handleDescriptionChange}
                className="h-9 border-border-medium bg-surface-secondary text-sm text-text-primary"
              />
            </div>

            {/* Command */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">
                Command 
                <span className="ml-1 text-xs font-normal text-text-tertiary">({command.length}/{Constants.COMMANDS_MAX_LENGTH})</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-tertiary">/</span>
                <Input
                  type="text"
                  disabled={!canEdit}
                  placeholder="command-name"
                  value={command}
                  onChange={handleCommandChange}
                  className="h-9 border-border-medium bg-surface-secondary pl-7 text-sm text-text-primary"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border-medium px-4 py-3">
          {/* Left side - Share & Delete */}
          <div className="flex items-center gap-1">
            {hasShareAccess && (
              <SharePrompt 
                group={group} 
                disabled={isLoadingGroup}
                variant="ghost"
              />
            )}
            <DeleteVersion
              promptId={selectedPromptId}
              groupId={group._id || ''}
              promptName={group.name}
              disabled={isLoadingGroup}
              variant="ghost"
            />
          </div>

          {/* Right side - Set as Production & Save */}
          {canEdit && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 border-border-medium px-3 text-xs"
                onClick={handleMakeProduction}
                disabled={!selectedPrompt || isProduction || makeProductionMutation.isLoading}
              >
                <Rocket className={cn('h-3.5 w-3.5', isProduction ? 'text-green-500' : '')} />
                <span>{isProduction ? 'In Production' : 'Set as Production'}</span>
              </Button>
              <Button
                variant="default"
                size="sm"
                className="h-8 gap-1.5 px-3 text-xs"
                onClick={handleSave}
                disabled={isSaving || !hasChanges}
              >
                <Save className="h-3.5 w-3.5" />
                <span>{isSaving ? 'Saving...' : 'Save'}</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </FormProvider>
  );
};

export default PromptEditPanel;
