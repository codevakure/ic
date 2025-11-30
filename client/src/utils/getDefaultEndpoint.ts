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
 * Get the first enabled endpoint from Intent Analyzer config.
 * Reads from intentAnalyzer.endpoints in startupConfig and returns the first enabled one.
 */
const getIntentAnalyzerDefaultEndpoint = (
  startupConfig: TStartupConfig | undefined,
  endpointsConfig: TEndpointsConfig,
): EModelEndpoint | null => {
  const intentAnalyzerEndpoints = startupConfig?.intentAnalyzer?.endpoints;
  if (!intentAnalyzerEndpoints) {
    return null;
  }

  // Find the first enabled endpoint in intentAnalyzer.endpoints config
  for (const [endpointName, config] of Object.entries(intentAnalyzerEndpoints)) {
    if (config?.enabled === true && endpointsConfig?.[endpointName]) {
      return endpointName as EModelEndpoint;
    }
  }

  return null;
};

/**
 * Get the default endpoint for a new conversation.
 * 
 * Priority (when Intent Analyzer is ENABLED):
 * 1. Endpoint from convoSetup if EXPLICITLY set (e.g., user clicked "Start Chat" on an agent)
 * 2. Intent Analyzer default endpoint from intentAnalyzer.endpoints config (e.g., bedrock)
 * 3. First enabled endpoint from defined order
 * Note: Skips localStorage to prevent remembering last endpoint
 * 
 * Priority (when Intent Analyzer is DISABLED - legacy behavior):
 * 1. Endpoint from convoSetup (preset/template) if explicitly set
 * 2. Last used endpoint from localStorage
 * 3. First enabled endpoint from defined order
 */
const getDefaultEndpoint = ({
  convoSetup,
  endpointsConfig,
  startupConfig,
}: TDefaultEndpoint): EModelEndpoint | undefined => {
  // Check if Intent Analyzer has any endpoint enabled (modelRouting or autoToolSelection)
  const intentAnalyzerConfig = startupConfig?.intentAnalyzer;
  const hasEnabledEndpoint = intentAnalyzerConfig?.endpoints && 
    Object.values(intentAnalyzerConfig.endpoints).some(ep => (ep as { enabled?: boolean })?.enabled === true);
  const isIntentAnalyzerEnabled = hasEnabledEndpoint && 
    (intentAnalyzerConfig?.modelRouting === true || intentAnalyzerConfig?.autoToolSelection === true);

  // Always check convoSetup first - if user explicitly selected an endpoint (e.g., Start Chat on Agent)
  const setupEndpoint = getEndpointFromSetup(convoSetup, endpointsConfig);
  if (setupEndpoint) {
    return setupEndpoint;
  }

  if (isIntentAnalyzerEnabled) {
    // When Intent Analyzer is enabled and no explicit endpoint, use intentAnalyzer.endpoints config
    const intentAnalyzerEndpoint = getIntentAnalyzerDefaultEndpoint(startupConfig, endpointsConfig);
    if (intentAnalyzerEndpoint) {
      return intentAnalyzerEndpoint;
    }
    // Fallback to first defined endpoint if no intentAnalyzer endpoint found
    return getDefinedEndpoint(endpointsConfig);
  }

  // Legacy behavior: check localStorage, then defined endpoint
  return (
    getEndpointFromLocalStorage(endpointsConfig) ||
    getDefinedEndpoint(endpointsConfig)
  );
};

export default getDefaultEndpoint;
