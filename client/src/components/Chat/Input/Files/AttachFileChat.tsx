import { memo, useMemo } from 'react';
import {
  Constants,
  supportsFiles,
  EModelEndpoint,
  mergeFileConfig,
  isAgentsEndpoint,
  getEndpointField,
  getEndpointFileConfig,
} from 'ranger-data-provider';
import type { TConversation } from 'ranger-data-provider';
import { useGetFileConfig, useGetEndpointsQuery } from '~/data-provider';
// Note: AttachFileMenu is still available if a menu-based approach is needed in the future
// import AttachFileMenu from './AttachFileMenu';
import AttachFile from './AttachFile';

function AttachFileChat({
  disableInputs,
  conversation,
}: {
  disableInputs: boolean;
  conversation: TConversation | null;
}) {
  const conversationId = conversation?.conversationId ?? Constants.NEW_CONVO;
  const { endpoint } = conversation ?? { endpoint: null };
  const isAgents = useMemo(() => isAgentsEndpoint(endpoint), [endpoint]);

  const { data: fileConfig = null } = useGetFileConfig({
    select: (data) => mergeFileConfig(data),
  });

  const { data: endpointsConfig } = useGetEndpointsQuery();

  const endpointType = useMemo(() => {
    return (
      getEndpointField(endpointsConfig, endpoint, 'type') ||
      (endpoint as EModelEndpoint | undefined)
    );
  }, [endpoint, endpointsConfig]);

  const endpointFileConfig = useMemo(
    () =>
      getEndpointFileConfig({
        endpoint,
        fileConfig,
        endpointType,
      }),
    [endpoint, fileConfig, endpointType],
  );
  const endpointSupportsFiles: boolean = useMemo(
    () => supportsFiles[endpointType ?? endpoint ?? ''] ?? false,
    [endpointType, endpoint],
  );
  const isUploadDisabled = useMemo(
    () => (disableInputs || endpointFileConfig?.disabled) ?? false,
    [disableInputs, endpointFileConfig?.disabled],
  );

  // All endpoints (including Agents): Direct file picker
  // Files are automatically routed based on their type by the intent analyzer:
  // - Images → Image upload (vision)
  // - Spreadsheets/Code → Code Interpreter  
  // - Documents → File Search (RAG)
  if ((isAgents || endpointSupportsFiles) && !isUploadDisabled) {
    return <AttachFile disabled={disableInputs} />;
  }
  
  return null;
}

export default memo(AttachFileChat);
