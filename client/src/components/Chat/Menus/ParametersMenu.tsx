import { useMemo } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { TooltipAnchor } from '@ranger/client';
import { Content, Portal, Root, Trigger } from '@radix-ui/react-popover';
import {
  SystemRoles,
  isParamEndpoint,
  isAgentsEndpoint,
  getEndpointField,
  getConfigDefaults,
} from 'ranger-data-provider';
import type { TInterfaceConfig, TEndpointsConfig } from 'ranger-data-provider';
import Parameters from '~/components/SidePanel/Parameters/Panel';
import { useGetEndpointsQuery } from '~/data-provider';
import { useLocalize, useAuthContext } from '~/hooks';
import { useChatContext } from '~/Providers';

const defaultInterface = getConfigDefaults().interface;

interface ParametersMenuProps {
  interfaceConfig?: Partial<TInterfaceConfig>;
  keyProvided?: boolean;
}

export default function ParametersMenu({ interfaceConfig, keyProvided = true }: ParametersMenuProps) {
  const localize = useLocalize();
  const { user } = useAuthContext();
  const { conversation } = useChatContext();
  const { data: endpointsConfig = {} as TEndpointsConfig } = useGetEndpointsQuery();

  const isAdmin = user?.role === SystemRoles.ADMIN;
  const endpoint = conversation?.endpoint ?? '';
  const endpointType = useMemo(
    () => getEndpointField(endpointsConfig, endpoint, 'type'),
    [endpoint, endpointsConfig],
  );

  // Check if parameters should be shown - only for admins
  const shouldShow = useMemo(() => {
    if (!isAdmin) {
      return false;
    }
    const parametersEnabled = (interfaceConfig ?? defaultInterface).parameters === true;
    const isValidEndpoint = isParamEndpoint(endpoint, endpointType ?? '') === true;
    const isNotAgentsEndpoint = !isAgentsEndpoint(endpoint);
    return parametersEnabled && isValidEndpoint && isNotAgentsEndpoint && keyProvided;
  }, [isAdmin, interfaceConfig, endpoint, endpointType, keyProvided]);

  if (!shouldShow) {
    return null;
  }

  return (
    <Root>
      <Trigger asChild>
        <TooltipAnchor
          id="parameters-menu-button"
          aria-label={localize('com_ui_model_parameters')}
          description={localize('com_ui_model_parameters')}
          tabIndex={0}
          role="button"
          data-testid="parameters-menu-button"
          className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-border-light bg-transparent text-text-primary transition-all ease-in-out hover:bg-surface-tertiary disabled:pointer-events-none disabled:opacity-50 radix-state-open:bg-surface-tertiary"
        >
          <SlidersHorizontal size={16} aria-label="Parameters Icon" />
        </TooltipAnchor>
      </Trigger>
      <Portal>
        <Content
          side="bottom"
          align="end"
          sideOffset={8}
          className="parameters-popover z-50 max-h-[min(480px,calc(100vh-100px))] w-[340px] overflow-hidden rounded-xl border border-border-medium bg-surface-primary-alt shadow-xl animate-in fade-in-0 zoom-in-95 slide-in-from-top-2"
        >
          <div className="flex items-center justify-between border-b border-border-light bg-surface-secondary px-4 py-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              {localize('com_ui_model_parameters')}
            </h3>
          </div>
          <div className="overflow-y-auto overflow-x-hidden" style={{ maxHeight: 'calc(480px - 44px)' }}>
            <Parameters compact />
          </div>
        </Content>
      </Portal>
    </Root>
  );
}
