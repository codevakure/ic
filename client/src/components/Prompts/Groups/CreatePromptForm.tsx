import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, TextareaAutosize, Input } from '@librechat/client';
import { useForm, Controller, FormProvider } from 'react-hook-form';
import { LocalStorageKeys, PermissionTypes, Permissions, Constants } from 'librechat-data-provider';
import CategorySelector from '~/components/Prompts/Groups/CategorySelector';
import VariablesDropdown from '~/components/Prompts/VariablesDropdown';
import { usePromptGroupsContext } from '~/Providers';
import { useLocalize, useHasAccess } from '~/hooks';
import { useCreatePrompt } from '~/data-provider';
import { extractUniqueVariables } from '~/utils';
import { cn } from '~/utils';

type CreateFormValues = {
  name: string;
  prompt: string;
  type: 'text' | 'chat';
  category: string;
  oneliner?: string;
  command?: string;
};

const defaultPrompt: CreateFormValues = {
  name: '',
  prompt: '',
  type: 'text',
  category: '',
  oneliner: undefined,
  command: undefined,
};

interface CreatePromptFormProps {
  defaultValues?: CreateFormValues;
  /** Optional callback on successful creation (for panel usage) */
  onSuccess?: (groupId: string) => void;
  /** Optional callback to close the panel */
  onClose?: () => void;
  /** If true, won't redirect when user lacks access */
  isPanel?: boolean;
}

const CreatePromptForm = ({
  defaultValues = defaultPrompt,
  onSuccess,
  onClose,
  isPanel = false,
}: CreatePromptFormProps) => {
  const localize = useLocalize();
  const navigate = useNavigate();
  const { hasAccess: hasUseAccess } = usePromptGroupsContext();
  const hasCreateAccess = useHasAccess({
    permissionType: PermissionTypes.PROMPTS,
    permission: Permissions.CREATE,
  });
  const hasAccess = hasUseAccess && hasCreateAccess;

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    if (!hasAccess && !isPanel) {
      timeoutId = setTimeout(() => {
        navigate('/c/new');
      }, 1000);
    }
    return () => {
      clearTimeout(timeoutId);
    };
  }, [hasAccess, navigate, isPanel]);

  const methods = useForm({
    defaultValues: {
      ...defaultValues,
      category: localStorage.getItem(LocalStorageKeys.LAST_PROMPT_CATEGORY) ?? '',
    },
  });

  const {
    watch,
    control,
    handleSubmit,
    formState: { isDirty, isSubmitting, errors, isValid },
  } = methods;

  const createPromptMutation = useCreatePrompt({
    onSuccess: (response) => {
      if (onSuccess) {
        onSuccess(response.prompt.groupId);
      } else {
        navigate(`/d/prompts/${response.prompt.groupId}`, { replace: true });
      }
    },
  });

  const promptText = watch('prompt');
  const variables = extractUniqueVariables(promptText || '');

  const onSubmit = (data: CreateFormValues) => {
    const { name, category, oneliner, command, ...rest } = data;
    const groupData = { name, category } as Pick<
      CreateFormValues,
      'name' | 'category' | 'oneliner' | 'command'
    >;
    if ((oneliner?.length ?? 0) > 0) {
      groupData.oneliner = oneliner;
    }
    if ((command?.length ?? 0) > 0) {
      groupData.command = command;
    }
    createPromptMutation.mutate({
      prompt: rest,
      group: groupData,
    });
  };

  if (!hasAccess) {
    return null;
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex h-full flex-col bg-surface-primary">
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-4">
            {/* Name Input */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">
                {localize('com_ui_name')} <span className="text-red-500">*</span>
              </label>
              <Controller
                name="name"
                control={control}
                rules={{ required: localize('com_ui_prompt_name_required') }}
                render={({ field }) => (
                  <Input
                    {...field}
                    type="text"
                    className="h-10 border-border-medium bg-surface-secondary text-text-primary"
                    placeholder={localize('com_ui_prompt_name')}
                    tabIndex={0}
                  />
                )}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
              )}
            </div>

            {/* Category */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">
                {localize('com_ui_category')}
              </label>
              <CategorySelector className="w-full" />
            </div>

            {/* Prompt Text */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-sm font-medium text-text-primary">
                  {localize('com_ui_prompt_text')} <span className="text-red-500">*</span>
                </label>
                <VariablesDropdown fieldName="prompt" />
              </div>
              <Controller
                name="prompt"
                control={control}
                rules={{ required: localize('com_ui_prompt_text_required') }}
                render={({ field }) => (
                  <TextareaAutosize
                    {...field}
                    className="w-full resize-none rounded-lg border border-border-medium bg-surface-secondary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary transition-colors focus:border-border-heavy focus:outline-none focus:ring-1 focus:ring-border-heavy"
                    minRows={5}
                    maxRows={12}
                    tabIndex={0}
                    aria-label={localize('com_ui_prompt_input_field')}
                  />
                )}
              />
              {errors.prompt && (
                <p className="mt-1 text-sm text-red-500">{errors.prompt.message}</p>
              )}
              {/* Variables tags */}
              {variables.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {variables.map((v, i) => (
                    <span key={i} className="rounded-md border border-border-light bg-surface-tertiary px-2 py-1 text-xs text-text-secondary">
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
              </label>
              <Controller
                name="oneliner"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    type="text"
                    className="h-10 border-border-medium bg-surface-secondary text-text-primary"
                    placeholder={localize('com_ui_description_placeholder')}
                    tabIndex={0}
                  />
                )}
              />
            </div>

            {/* Command */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">
                Command
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-tertiary">/</span>
                <Controller
                  name="command"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      type="text"
                      className="h-10 border-border-medium bg-surface-secondary pl-7 text-text-primary"
                      placeholder="command-name"
                      onChange={(e) => {
                        let newValue = e.target.value.toLowerCase().replace(/\s/g, '-').replace(/[^a-z0-9-]/g, '');
                        if (newValue.length <= Constants.COMMANDS_MAX_LENGTH) {
                          field.onChange(newValue);
                        }
                      }}
                      tabIndex={0}
                    />
                  )}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border-medium px-4 py-3">
          <Button
            aria-label={localize('com_ui_create_prompt')}
            tabIndex={0}
            type="submit"
            className="h-10 w-full"
            disabled={!isDirty || isSubmitting || !isValid}
          >
            {localize('com_ui_create_prompt')}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
};

export default CreatePromptForm;
