import { useMemo } from 'react';
import { useGetModelsQuery } from 'ranger-data-provider/react-query';
import {
  Permissions,
  PermissionBits,
  EModelEndpoint,
  PermissionTypes,
  isAgentsEndpoint,
  getConfigDefaults,
  isAssistantsEndpoint,
  getEndpointLabel,
} from 'ranger-data-provider';
import type { TAssistantsMap, TEndpointsConfig } from 'ranger-data-provider';
import type { MentionOption } from '~/common';
import {
  useGetPresetsQuery,
  useGetEndpointsQuery,
  useListAgentsQuery,
  useGetStartupConfig,
} from '~/data-provider';
import useAssistantListMap from '~/hooks/Assistants/useAssistantListMap';
import { useAgentsMapContext } from '~/Providers/AgentsMapContext';
import { mapEndpoints, getPresetTitle } from '~/utils';
import { EndpointIcon } from '~/components/Endpoints';
import useHasAccess from '~/hooks/Roles/useHasAccess';

const defaultInterface = getConfigDefaults().interface;

const assistantMapFn =
  ({
    endpoint,
    assistantMap,
    endpointsConfig,
  }: {
    endpoint: EModelEndpoint | string;
    assistantMap: TAssistantsMap;
    endpointsConfig: TEndpointsConfig;
  }) =>
  ({ id, name, description }) => ({
    type: endpoint,
    label: name ?? '',
    value: id,
    description: description ?? '',
    icon: EndpointIcon({
      conversation: { assistant_id: id, endpoint },
      containerClassName: 'shadow-stroke overflow-hidden rounded-full',
      endpointsConfig: endpointsConfig,
      context: 'menu-item',
      assistantMap,
      size: 20,
    }),
  });

export default function useMentions({
  assistantMap,
  includeAssistants,
}: {
  assistantMap: TAssistantsMap;
  includeAssistants: boolean;
}) {
  const hasAgentAccess = useHasAccess({
    permissionType: PermissionTypes.AGENTS,
    permission: Permissions.USE,
  });

  const agentsMap = useAgentsMapContext();
  const { data: presets } = useGetPresetsQuery();
  const { data: modelsConfig } = useGetModelsQuery();
  const { data: startupConfig } = useGetStartupConfig();
  const { data: endpointsConfig } = useGetEndpointsQuery();
  const { data: endpoints = [] } = useGetEndpointsQuery({
    select: mapEndpoints,
  });
  const listMap = useAssistantListMap((res) =>
    res.data.map(({ id, name, description }) => ({
      id,
      name,
      description,
    })),
  );
  const interfaceConfig = useMemo(
    () => startupConfig?.interface ?? defaultInterface,
    [startupConfig?.interface],
  );
  const { data: agentsList = null } = useListAgentsQuery(
    { requiredPermission: PermissionBits.VIEW },
    {
      enabled: hasAgentAccess && interfaceConfig.modelSelect === true,
      select: (res) => {
        const { data } = res;
        return data.map(({ id, name, avatar }) => ({
          value: id,
          label: name ?? '',
          type: EModelEndpoint.agents,
          icon: EndpointIcon({
            conversation: {
              agent_id: id,
              endpoint: EModelEndpoint.agents,
              iconURL: avatar?.filepath,
            },
            containerClassName: 'shadow-stroke overflow-hidden rounded-full',
            endpointsConfig: endpointsConfig,
            context: 'menu-item',
            size: 20,
          }),
        }));
      },
    },
  );
  const assistantListMap = useMemo(
    () => ({
      [EModelEndpoint.assistants]: listMap[EModelEndpoint.assistants]
        ?.map(
          assistantMapFn({
            endpoint: EModelEndpoint.assistants,
            assistantMap,
            endpointsConfig,
          }),
        )
        .filter(Boolean),
      [EModelEndpoint.azureAssistants]: listMap[EModelEndpoint.azureAssistants]
        ?.map(
          assistantMapFn({
            endpoint: EModelEndpoint.azureAssistants,
            assistantMap,
            endpointsConfig,
          }),
        )
        .filter(Boolean),
    }),
    [listMap, assistantMap, endpointsConfig],
  );

  const modelSpecs = useMemo(() => {
    const specs = startupConfig?.modelSpecs?.list ?? [];
    if (!agentsMap) {
      return specs;
    }

    /**
     * Filter modelSpecs to only include agents the user has access to.
     * Use agentsMap which already contains permission-filtered agents (consistent with other components).
     */
    return specs.filter((spec) => {
      if (spec.preset?.endpoint === EModelEndpoint.agents && spec.preset?.agent_id) {
        return spec.preset.agent_id in agentsMap;
      }
      /** Keep non-agent modelSpecs */
      return true;
    });
  }, [startupConfig, agentsMap]);

  const options: MentionOption[] = useMemo(() => {
    /**
     * MODIFIED: @ mention popover now only shows agents
     * 
     * Previously, the @ mention popover displayed:
     * - Model specs
     * - Endpoints (OpenAI, Azure, etc.)
     * - Individual models
     * - Assistants (OpenAI & Azure)
     * - Presets
     * 
     * This was changed to only show agents for a cleaner user experience.
     * Users can still access other options through the model selector dropdown.
     */
    const mentions = [
      ...(interfaceConfig.modelSelect === true ? (agentsList ?? []) : []),
    ];

    return mentions;
  }, [
    agentsList,
    interfaceConfig.modelSelect,
  ]);

  return {
    options,
    presets,
    modelSpecs,
    agentsList,
    modelsConfig,
    endpointsConfig,
    assistantListMap,
  };
}
