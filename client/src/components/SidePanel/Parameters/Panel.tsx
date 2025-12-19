import React, { useMemo, useState, useEffect, useCallback } from 'react';
import keyBy from 'lodash/keyBy';
import { RotateCcw, Save } from 'lucide-react';
import {
  excludedKeys,
  paramSettings,
  getSettingsKeys,
  getEndpointField,
  SettingDefinition,
  tConvoUpdateSchema,
} from 'ranger-data-provider';
import type { TPreset } from 'ranger-data-provider';
import { SaveAsPresetDialog } from '~/components/Endpoints';
import { useSetIndexOptions, useLocalize } from '~/hooks';
import { useGetEndpointsQuery } from '~/data-provider';
import { componentMapping } from './components';
import { useChatContext } from '~/Providers';
import { cn, logger } from '~/utils';

interface ParametersProps {
  compact?: boolean;
}

export default function Parameters({ compact = false }: ParametersProps) {
  const localize = useLocalize();
  const { conversation, setConversation } = useChatContext();
  const { setOption } = useSetIndexOptions();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [preset, setPreset] = useState<TPreset | null>(null);

  const { data: endpointsConfig = {} } = useGetEndpointsQuery();
  const provider = conversation?.endpoint ?? '';
  const model = conversation?.model ?? '';

  const bedrockRegions = useMemo(() => {
    return endpointsConfig?.[conversation?.endpoint ?? '']?.availableRegions ?? [];
  }, [endpointsConfig, conversation?.endpoint]);

  const endpointType = useMemo(
    () => getEndpointField(endpointsConfig, conversation?.endpoint, 'type'),
    [conversation?.endpoint, endpointsConfig],
  );

  const parameters = useMemo((): SettingDefinition[] => {
    const customParams = endpointsConfig[provider]?.customParams ?? {};
    const [combinedKey, endpointKey] = getSettingsKeys(endpointType ?? provider, model);
    const overriddenEndpointKey = customParams.defaultParamsEndpoint ?? endpointKey;
    const defaultParams = paramSettings[combinedKey] ?? paramSettings[overriddenEndpointKey] ?? [];
    const overriddenParams = endpointsConfig[provider]?.customParams?.paramDefinitions ?? [];
    const overriddenParamsMap = keyBy(overriddenParams, 'key');
    return defaultParams
      .filter((param) => param != null)
      .map((param) => (overriddenParamsMap[param.key] as SettingDefinition) ?? param);
  }, [endpointType, endpointsConfig, model, provider]);

  useEffect(() => {
    if (!parameters) {
      return;
    }

    // const defaultValueMap = new Map();
    // const paramKeys = new Set(
    //   parameters.map((setting) => {
    //     if (setting.default != null) {
    //       defaultValueMap.set(setting.key, setting.default);
    //     }
    //     return setting.key;
    //   }),
    // );
    const paramKeys = new Set(
      parameters.filter((setting) => setting != null).map((setting) => setting.key),
    );
    setConversation((prev) => {
      if (!prev) {
        return prev;
      }

      const updatedConversation = { ...prev };

      const conversationKeys = Object.keys(updatedConversation);
      const updatedKeys: string[] = [];
      conversationKeys.forEach((key) => {
        // const defaultValue = defaultValueMap.get(key);
        // if (paramKeys.has(key) && defaultValue != null && prev[key] != null) {
        //   updatedKeys.push(key);
        //   updatedConversation[key] = defaultValue;
        //   return;
        // }

        if (paramKeys.has(key)) {
          return;
        }

        if (excludedKeys.has(key)) {
          return;
        }

        if (prev[key] != null) {
          updatedKeys.push(key);
          delete updatedConversation[key];
        }
      });

      logger.log('parameters', 'parameters effect, updated keys:', updatedKeys);

      return updatedConversation;
    });
  }, [parameters, setConversation]);

  const resetParameters = useCallback(() => {
    setConversation((prev) => {
      if (!prev) {
        return prev;
      }

      const updatedConversation = { ...prev };
      const resetKeys: string[] = [];

      Object.keys(updatedConversation).forEach((key) => {
        if (excludedKeys.has(key)) {
          return;
        }

        if (updatedConversation[key] !== undefined) {
          resetKeys.push(key);
          delete updatedConversation[key];
        }
      });

      logger.log('parameters', 'parameters reset, affected keys:', resetKeys);
      return updatedConversation;
    });
  }, [setConversation]);

  const openDialog = useCallback(() => {
    const newPreset = tConvoUpdateSchema.parse({
      ...conversation,
    }) as TPreset;
    setPreset(newPreset);
    setIsDialogOpen(true);
  }, [conversation]);

  if (!parameters) {
    return null;
  }

  return (
    <div className={cn('h-auto max-w-full overflow-x-hidden', compact ? 'p-3' : 'p-3')}>
      <div className={cn('grid gap-3', compact ? 'grid-cols-2' : 'grid-cols-2 gap-4')}>
        {parameters.map((setting) => {
          const Component = componentMapping[setting.component];
          if (!Component) {
            return null;
          }
          const { key, default: defaultValue, ...rest } = setting;

          if (key === 'region' && bedrockRegions.length) {
            rest.options = bedrockRegions;
          }

          return (
            <Component
              key={key}
              settingKey={key}
              defaultValue={defaultValue}
              {...rest}
              setOption={setOption}
              conversation={conversation}
              compact={compact}
            />
          );
        })}
      </div>
      <div className={cn('flex gap-2', compact ? 'mt-3' : 'mt-4 flex-col')}>
        {compact ? (
          <>
            <button
              type="button"
              onClick={resetParameters}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border-medium bg-surface-secondary px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-tertiary hover:text-text-primary"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              {localize('com_ui_reset')}
            </button>
            <button
              onClick={openDialog}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-surface-submit px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-surface-submit-hover"
              type="button"
            >
              <Save className="h-3 w-3" aria-hidden="true" />
              {localize('com_ui_save')}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={resetParameters}
              className="btn btn-neutral flex w-full items-center justify-center gap-2 px-4 py-2 text-sm"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              {localize('com_ui_reset_var', { 0: localize('com_ui_model_parameters') })}
            </button>
            <button
              onClick={openDialog}
              className="btn btn-primary focus:shadow-outline mt-2 flex w-full items-center justify-center px-4 py-2 font-semibold text-white"
              type="button"
            >
              {localize('com_endpoint_save_as_preset')}
            </button>
          </>
        )}
      </div>
      {preset && (
        <SaveAsPresetDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} preset={preset} />
      )}
    </div>
  );
}
