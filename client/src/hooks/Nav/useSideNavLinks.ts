import { useMemo } from 'react';
import { Blocks, MCPIcon } from '@ranger/client';
import { ArrowRightToLine } from 'lucide-react';
import {
  Permissions,
  EModelEndpoint,
  PermissionTypes,
  isAssistantsEndpoint,
} from 'ranger-data-provider';
import type { TInterfaceConfig, TEndpointsConfig } from 'ranger-data-provider';
import type { NavLink } from '~/common';
import AgentPanelSwitch from '~/components/SidePanel/Agents/AgentPanelSwitch';
import PanelSwitch from '~/components/SidePanel/Builder/PanelSwitch';
import MCPPanel from '~/components/SidePanel/MCP/MCPPanel';
import { useGetStartupConfig } from '~/data-provider';
import { useHasAccess } from '~/hooks';

export default function useSideNavLinks({
  hidePanel,
  keyProvided,
  endpoint,
  endpointType,
  interfaceConfig,
  endpointsConfig,
}: {
  hidePanel: () => void;
  keyProvided: boolean;
  endpoint?: EModelEndpoint | null;
  endpointType?: EModelEndpoint | null;
  interfaceConfig: Partial<TInterfaceConfig>;
  endpointsConfig: TEndpointsConfig;
}) {
  const hasAccessToAgents = useHasAccess({
    permissionType: PermissionTypes.AGENTS,
    permission: Permissions.USE,
  });
  const hasAccessToCreateAgents = useHasAccess({
    permissionType: PermissionTypes.AGENTS,
    permission: Permissions.CREATE,
  });
  const { data: startupConfig } = useGetStartupConfig();

  const Links = useMemo(() => {
    const links: NavLink[] = [];
    if (
      isAssistantsEndpoint(endpoint) &&
      ((endpoint === EModelEndpoint.assistants &&
        endpointsConfig?.[EModelEndpoint.assistants] &&
        endpointsConfig[EModelEndpoint.assistants].disableBuilder !== true) ||
        (endpoint === EModelEndpoint.azureAssistants &&
          endpointsConfig?.[EModelEndpoint.azureAssistants] &&
          endpointsConfig[EModelEndpoint.azureAssistants].disableBuilder !== true)) &&
      keyProvided
    ) {
      links.push({
        title: 'com_sidepanel_assistant_builder',
        label: '',
        icon: Blocks,
        id: EModelEndpoint.assistants,
        Component: PanelSwitch,
      });
    }

    if (
      endpointsConfig?.[EModelEndpoint.agents] &&
      hasAccessToAgents &&
      hasAccessToCreateAgents &&
      endpointsConfig[EModelEndpoint.agents].disableBuilder !== true
    ) {
      links.push({
        title: 'com_sidepanel_agent_builder',
        label: '',
        icon: Blocks,
        id: EModelEndpoint.agents,
        Component: AgentPanelSwitch,
      });
    }

    // Parameters moved to top nav (ParametersMenu in Header.tsx)

    if (
      startupConfig?.mcpServers &&
      Object.values(startupConfig.mcpServers).some(
        (server: any) =>
          (server.customUserVars && Object.keys(server.customUserVars).length > 0) ||
          server.isOAuth ||
          server.startup === false,
      )
    ) {
      links.push({
        title: 'com_nav_setting_mcp',
        label: '',
        icon: MCPIcon,
        id: 'mcp-settings',
        Component: MCPPanel,
      });
    }

    links.push({
      title: 'com_sidepanel_hide_panel',
      label: '',
      icon: ArrowRightToLine,
      onClick: hidePanel,
      id: 'hide-panel',
    });

    return links;
  }, [
    endpointsConfig,
    keyProvided,
    endpoint,
    hasAccessToAgents,
    hasAccessToCreateAgents,
    hidePanel,
    startupConfig,
  ]);

  return Links;
}
