const { loadCustomEndpointsConfig } = require('@librechat/api');
const {
  CacheKeys,
  EModelEndpoint,
  isAgentsEndpoint,
  orderEndpointsConfig,
  defaultAgentCapabilities,
} = require('librechat-data-provider');
const loadDefaultEndpointsConfig = require('./loadDefaultEConfig');
const getLogStores = require('~/cache/getLogStores');
const { getAppConfig } = require('./app');

/**
 *
 * @param {ServerRequest} req
 * @returns {Promise<TEndpointsConfig>}
 */
async function getEndpointsConfig(req) {
  const cache = getLogStores(CacheKeys.CONFIG_STORE);
  const cachedEndpointsConfig = await cache.get(CacheKeys.ENDPOINT_CONFIG);
  if (cachedEndpointsConfig) {
    return cachedEndpointsConfig;
  }

  const appConfig = req.config ?? (await getAppConfig({ role: req.user?.role }));
  const defaultEndpointsConfig = await loadDefaultEndpointsConfig(appConfig);
  const customEndpointsConfig = loadCustomEndpointsConfig(appConfig?.endpoints?.custom);

  /** @type {TEndpointsConfig} */
  const mergedConfig = {
    ...defaultEndpointsConfig,
    ...customEndpointsConfig,
  };

  if (appConfig.endpoints?.[EModelEndpoint.azureOpenAI]) {
    /** @type {Omit<TConfig, 'order'>} */
    mergedConfig[EModelEndpoint.azureOpenAI] = {
      userProvide: false,
    };
  }

  if (appConfig.endpoints?.[EModelEndpoint.azureOpenAI]?.assistants) {
    /** @type {Omit<TConfig, 'order'>} */
    mergedConfig[EModelEndpoint.azureAssistants] = {
      userProvide: false,
    };
  }

  if (
    mergedConfig[EModelEndpoint.assistants] &&
    appConfig?.endpoints?.[EModelEndpoint.assistants]
  ) {
    const { disableBuilder, retrievalModels, capabilities, version, iconURL, modelDisplayLabel, ..._rest } =
      appConfig.endpoints[EModelEndpoint.assistants];

    mergedConfig[EModelEndpoint.assistants] = {
      ...mergedConfig[EModelEndpoint.assistants],
      version,
      retrievalModels,
      disableBuilder,
      capabilities,
      iconURL,
      modelDisplayLabel,
    };
  }
  if (mergedConfig[EModelEndpoint.agents] && appConfig?.endpoints?.[EModelEndpoint.agents]) {
    const { disableBuilder, capabilities, allowedProviders, toolsAutoEnabled, iconURL, modelDisplayLabel, ..._rest } =
      appConfig.endpoints[EModelEndpoint.agents];

    mergedConfig[EModelEndpoint.agents] = {
      ...mergedConfig[EModelEndpoint.agents],
      allowedProviders,
      disableBuilder,
      capabilities,
      toolsAutoEnabled,
      iconURL,
      modelDisplayLabel,
    };
  }

  if (
    mergedConfig[EModelEndpoint.azureAssistants] &&
    appConfig?.endpoints?.[EModelEndpoint.azureAssistants]
  ) {
    const { disableBuilder, retrievalModels, capabilities, version, iconURL, modelDisplayLabel, ..._rest } =
      appConfig.endpoints[EModelEndpoint.azureAssistants];

    mergedConfig[EModelEndpoint.azureAssistants] = {
      ...mergedConfig[EModelEndpoint.azureAssistants],
      version,
      retrievalModels,
      disableBuilder,
      capabilities,
      iconURL,
      modelDisplayLabel,
    };
  }

  if (mergedConfig[EModelEndpoint.bedrock] && appConfig?.endpoints?.[EModelEndpoint.bedrock]) {
    const { availableRegions, iconURL, modelDisplayLabel, endpointCustomLabel, endpointCustomDescription } = appConfig.endpoints[EModelEndpoint.bedrock];
    mergedConfig[EModelEndpoint.bedrock] = {
      ...mergedConfig[EModelEndpoint.bedrock],
      availableRegions,
      iconURL,
      modelDisplayLabel,
      endpointCustomLabel,
      endpointCustomDescription,
    };
  }

  // Apply iconURL, modelDisplayLabel, and custom branding to all endpoints if configured
  const endpointsToCheck = [
    EModelEndpoint.openAI,
    EModelEndpoint.anthropic,
    EModelEndpoint.google,
    EModelEndpoint.azureOpenAI,
    EModelEndpoint.gptPlugins,
    EModelEndpoint.chatGPTBrowser,
  ];

  for (const endpoint of endpointsToCheck) {
    if (mergedConfig[endpoint] && appConfig?.endpoints?.[endpoint]) {
      const { iconURL, modelDisplayLabel, endpointCustomLabel, endpointCustomDescription } = appConfig.endpoints[endpoint];
      if (iconURL || modelDisplayLabel || endpointCustomLabel || endpointCustomDescription) {
        mergedConfig[endpoint] = {
          ...mergedConfig[endpoint],
          ...(iconURL && { iconURL }),
          ...(modelDisplayLabel && { modelDisplayLabel }),
          ...(endpointCustomLabel && { endpointCustomLabel }),
          ...(endpointCustomDescription && { endpointCustomDescription }),
        };
      }
    }
  }

  const endpointsConfig = orderEndpointsConfig(mergedConfig);

  await cache.set(CacheKeys.ENDPOINT_CONFIG, endpointsConfig);
  return endpointsConfig;
}

/**
 * @param {ServerRequest} req
 * @param {import('librechat-data-provider').AgentCapabilities} capability
 * @returns {Promise<boolean>}
 */
const checkCapability = async (req, capability) => {
  const isAgents = isAgentsEndpoint(req.body?.endpointType || req.body?.endpoint);
  const endpointsConfig = await getEndpointsConfig(req);
  const capabilities =
    isAgents || endpointsConfig?.[EModelEndpoint.agents]?.capabilities != null
      ? (endpointsConfig?.[EModelEndpoint.agents]?.capabilities ?? [])
      : defaultAgentCapabilities;
  return capabilities.includes(capability);
};

module.exports = { getEndpointsConfig, checkCapability };
