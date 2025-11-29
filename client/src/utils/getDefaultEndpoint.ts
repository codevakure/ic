import type {
  TPreset,
  TConversation,
  EModelEndpoint,
  TEndpointsConfig,
  TStartupConfig,
} from 'librechat-data-provider';
import { getLocalStorageItems } from './localStorage';
import { mapEndpoints } from './endpoints';

type TConvoSetup = Partial<TPreset> | Partial<TConversation>;

type TDefaultEndpoint = {
  convoSetup: TConvoSetup;
  endpointsConfig: TEndpointsConfig;
  startupConfig?: TStartupConfig;
};

const getEndpointFromSetup = (
  convoSetup: TConvoSetup | null,
  endpointsConfig: TEndpointsConfig,
): EModelEndpoint | null => {
  let { endpoint: targetEndpoint = '' } = convoSetup || {};
  targetEndpoint = targetEndpoint ?? '';
  if (targetEndpoint && endpointsConfig?.[targetEndpoint]) {
    return targetEndpoint as EModelEndpoint;
  } else if (targetEndpoint) {
    console.warn(`Illegal target endpoint ${targetEndpoint}`, endpointsConfig);
  }
  return null;
};

const getEndpointFromLocalStorage = (endpointsConfig: TEndpointsConfig) => {
  try {
    const { lastConversationSetup } = getLocalStorageItems();
    const { endpoint } = lastConversationSetup ?? { endpoint: null };
    const isDefaultConfig = Object.values(endpointsConfig ?? {}).every((value) => !value);

    if (isDefaultConfig && endpoint) {
      return endpoint;
    }

    return endpoint && endpointsConfig?.[endpoint] != null ? endpoint : null;
  } catch (error) {
    console.error(error);
    return null;
  }
};

const getDefinedEndpoint = (endpointsConfig: TEndpointsConfig) => {
  const endpoints = mapEndpoints(endpointsConfig);
  return endpoints.find((e) => Object.hasOwn(endpointsConfig ?? {}, e));
};

/**
 * Get the first enabled endpoint from LLM Router config.
 * Reads from llmRouter.endpoints in startupConfig and returns the first enabled one.
 */
const getLLMRouterDefaultEndpoint = (
  startupConfig: TStartupConfig | undefined,
  endpointsConfig: TEndpointsConfig,
): EModelEndpoint | null => {
  const llmRouterEndpoints = startupConfig?.llmRouter?.endpoints;
  if (!llmRouterEndpoints) {
    return null;
  }

  // Find the first enabled endpoint in llmRouter.endpoints config
  for (const [endpointName, config] of Object.entries(llmRouterEndpoints)) {
    if (config?.enabled === true && endpointsConfig?.[endpointName]) {
      return endpointName as EModelEndpoint;
    }
  }

  return null;
};

/**
 * Get the default endpoint for a new conversation.
 * 
 * Priority (when LLM Router is ENABLED):
 * 1. Endpoint from convoSetup if EXPLICITLY set (e.g., user clicked "Start Chat" on an agent)
 * 2. LLM Router default endpoint from llmRouter.endpoints config (e.g., bedrock)
 * 3. First enabled endpoint from defined order
 * Note: Skips localStorage to prevent remembering last endpoint
 * 
 * Priority (when LLM Router is DISABLED - legacy behavior):
 * 1. Endpoint from convoSetup (preset/template) if explicitly set
 * 2. Last used endpoint from localStorage
 * 3. First enabled endpoint from defined order
 */
const getDefaultEndpoint = ({
  convoSetup,
  endpointsConfig,
  startupConfig,
}: TDefaultEndpoint): EModelEndpoint | undefined => {
  const isLLMRouterEnabled = startupConfig?.llmRouter?.enabled === true;

  // Always check convoSetup first - if user explicitly selected an endpoint (e.g., Start Chat on Agent)
  const setupEndpoint = getEndpointFromSetup(convoSetup, endpointsConfig);
  if (setupEndpoint) {
    return setupEndpoint;
  }

  if (isLLMRouterEnabled) {
    // When LLM Router is enabled and no explicit endpoint, use llmRouter.endpoints config
    const llmRouterEndpoint = getLLMRouterDefaultEndpoint(startupConfig, endpointsConfig);
    if (llmRouterEndpoint) {
      return llmRouterEndpoint;
    }
    // Fallback to first defined endpoint if no llmRouter endpoint found
    return getDefinedEndpoint(endpointsConfig);
  }

  // Legacy behavior: check localStorage, then defined endpoint
  return (
    getEndpointFromLocalStorage(endpointsConfig) ||
    getDefinedEndpoint(endpointsConfig)
  );
};

export default getDefaultEndpoint;
