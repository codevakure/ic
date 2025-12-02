import { useMemo } from 'react';
import { UserIcon } from '@ranger/client';
import { getEndpointField, EModelEndpoint } from 'ranger-data-provider';
import type { TMessage, Assistant, Agent } from 'ranger-data-provider';
import type { TMessageProps } from '~/common';
import MessageEndpointIcon from '../Endpoints/MessageEndpointIcon';
import ConvoIconURL from '~/components/Endpoints/ConvoIconURL';
import { useGetEndpointsQuery } from '~/data-provider';
import { getIconEndpoint, logger } from '~/utils';

export default function MessageIcon(
  props: Pick<TMessageProps, 'message' | 'conversation'> & {
    assistant?: false | Assistant;
    agent?: false | Agent;
  },
) {
  const { message, conversation, assistant, agent } = props;
  const { data: endpointsConfig } = useGetEndpointsQuery();

  const messageSettings = useMemo(
    () => ({
      ...(conversation ?? {}),
      ...({
        ...message,
        iconURL: message?.iconURL ?? '',
      } as TMessage),
    }),
    [conversation, message],
  );

  const iconURL = messageSettings.iconURL ?? '';
  let endpoint = messageSettings.endpoint;
  endpoint = getIconEndpoint({ endpointsConfig, iconURL, endpoint });
  
  // Get the endpoint config iconURL (e.g., from ranger.yaml endpoints.agents.iconURL)
  const endpointIconURL = useMemo(
    () => getEndpointField(endpointsConfig, endpoint, 'iconURL') ?? '',
    [endpointsConfig, endpoint],
  );
  
  const assistantName = (assistant ? assistant.name : '') ?? '';
  const assistantAvatar = (assistant ? assistant.metadata?.avatar : '') ?? '';
  const agentName = (agent ? agent.name : '') ?? '';
  const agentAvatar = (agent ? agent?.avatar?.filepath : '') ?? '';
  const avatarURL = useMemo(() => {
    let result = '';
    if (assistant) {
      result = assistantAvatar;
    } else if (agent) {
      result = agentAvatar;
    }
    return result;
  }, [assistant, agent, assistantAvatar, agentAvatar]);
  logger.log('MessageIcon', {
    endpoint,
    iconURL,
    endpointIconURL,
    assistantName,
    assistantAvatar,
    agentName,
    agentAvatar,
  });
  if (message?.isCreatedByUser !== true && iconURL && iconURL.includes('http')) {
    return (
      <ConvoIconURL
        iconURL={iconURL}
        modelLabel={messageSettings.chatGptLabel ?? messageSettings.modelLabel ?? ''}
        context="message"
        assistantAvatar={assistantAvatar}
        assistantName={assistantName}
        agentAvatar={agentAvatar}
        agentName={agentName}
        endpointIconURL={endpointIconURL}
      />
    );
  }

  if (message?.isCreatedByUser === true) {
    return (
      <div
        style={{
          backgroundColor: 'rgb(121, 137, 255)',
          width: '20px',
          height: '20px',
          boxShadow: 'rgba(240, 246, 252, 0.1) 0px 0px 0px 1px',
        }}
        className="relative flex h-9 w-9 items-center justify-center rounded-sm p-1 text-white"
      >
        <UserIcon />
      </div>
    );
  }

  return (
    <MessageEndpointIcon
      {...messageSettings}
      endpoint={endpoint}
      iconURL={avatarURL || endpointIconURL}
      model={message?.model ?? conversation?.model}
      assistantName={assistantName}
      agentName={agentName}
      size={28.8}
    />
  );
}
