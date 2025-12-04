const { Providers } = require('illuma-agents');
const { logger } = require('@ranger/data-schemas');
const {
  primeResources,
  getModelMaxTokens,
  extractRangerParams,
  filterFilesByEndpointConfig,
  optionalChainWithEmptyCheck,
} = require('@ranger/api');
const {
  ErrorTypes,
  EModelEndpoint,
  EToolResources,
  paramEndpoints,
  isAgentsEndpoint,
  replaceSpecialVars,
  providerEndpointMap,
} = require('ranger-data-provider');
const generateArtifactsPrompt = require('~/app/clients/prompts/artifacts');
const { getProviderConfig } = require('~/server/services/Endpoints');
const { processFiles } = require('~/server/services/Files/process');
const { getFiles, getToolFilesByIds } = require('~/models/File');
const { getConvoFiles } = require('~/models/Conversation');

/**
 * @param {object} params
 * @param {ServerRequest} params.req
 * @param {ServerResponse} params.res
 * @param {Agent} params.agent
 * @param {string | null} [params.conversationId]
 * @param {Array<IMongoFile>} [params.requestFiles]
 * @param {boolean} [params.useOnlyAttachedFiles] - When true, skip conversation history files
 * @param {typeof import('~/server/services/ToolService').loadAgentTools | undefined} [params.loadTools]
 * @param {TEndpointOption} [params.endpointOption]
 * @param {Set<string>} [params.allowedProviders]
 * @param {boolean} [params.isInitialAgent]
 * @returns {Promise<Agent & {
 * tools: StructuredTool[],
 * attachments: Array<MongoFile>,
 * toolContextMap: Record<string, unknown>,
 * maxContextTokens: number,
 * userMCPAuthMap?: Record<string, Record<string, string>>
 * }>}
 */
const initializeAgent = async ({
  req,
  res,
  agent,
  loadTools,
  requestFiles,
  conversationId,
  useOnlyAttachedFiles = false,
  endpointOption,
  allowedProviders,
  isInitialAgent = false,
}) => {
  const appConfig = req.config;
  if (
    isAgentsEndpoint(endpointOption?.endpoint) &&
    allowedProviders.size > 0 &&
    !allowedProviders.has(agent.provider)
  ) {
    throw new Error(
      `{ "type": "${ErrorTypes.INVALID_AGENT_PROVIDER}", "info": "${agent.provider}" }`,
    );
  }
  let currentFiles;

  const _modelOptions = structuredClone(
    Object.assign(
      { model: agent.model },
      agent.model_parameters ?? { model: agent.model },
      isInitialAgent === true ? endpointOption?.model_parameters : {},
    ),
  );

  const { resendFiles, maxContextTokens, modelOptions } = extractRangerParams(_modelOptions);

  const provider = agent.provider;
  agent.endpoint = provider;

  // When useOnlyAttachedFiles is true, only use the files attached to the current message
  // Skip loading conversation history files
  if (isInitialAgent && conversationId != null && resendFiles && !useOnlyAttachedFiles) {
    const fileIds = (await getConvoFiles(conversationId)) ?? [];
    /** @type {Set<EToolResources>} */
    const toolResourceSet = new Set();
    for (const tool of agent.tools) {
      if (EToolResources[tool]) {
        toolResourceSet.add(EToolResources[tool]);
      }
    }
    const toolFiles = await getToolFilesByIds(fileIds, toolResourceSet);
    if (requestFiles.length || toolFiles.length) {
      currentFiles = await processFiles(requestFiles.concat(toolFiles));
    }
  } else if (isInitialAgent && requestFiles.length) {
    currentFiles = await processFiles(requestFiles);
  }

  if (currentFiles && currentFiles.length) {
    let endpointType;
    if (!paramEndpoints.has(agent.endpoint)) {
      endpointType = EModelEndpoint.custom;
    }

    currentFiles = filterFilesByEndpointConfig(req, {
      files: currentFiles,
      endpoint: agent.endpoint,
      endpointType,
    });
  }

  const { attachments, tool_resources } = await primeResources({
    req,
    getFiles,
    appConfig,
    agentId: agent.id,
    attachments: currentFiles,
    tool_resources: agent.tool_resources,
    requestFileSet: new Set(requestFiles?.map((file) => file.file_id)),
  });

  const {
    tools: structuredTools,
    toolContextMap,
    userMCPAuthMap,
  } = (await loadTools?.({
    req,
    res,
    provider,
    agentId: agent.id,
    tools: agent.tools,
    model: agent.model,
    tool_resources,
  })) ?? {};

  const { getOptions, overrideProvider } = getProviderConfig({ provider, appConfig });
  if (overrideProvider !== agent.provider) {
    agent.provider = overrideProvider;
  }

  const _endpointOption =
    isInitialAgent === true
      ? Object.assign({}, endpointOption, { model_parameters: modelOptions })
      : { model_parameters: modelOptions };

  const options = await getOptions({
    req,
    res,
    optionsOnly: true,
    overrideEndpoint: provider,
    overrideModel: agent.model,
    endpointOption: _endpointOption,
  });

  const tokensModel =
    agent.provider === EModelEndpoint.azureOpenAI ? agent.model : options.llmConfig?.model;
  const maxOutputTokens = optionalChainWithEmptyCheck(
    options.llmConfig?.maxOutputTokens,
    options.llmConfig?.maxTokens,
    0,
  );
  const agentMaxContextTokens = optionalChainWithEmptyCheck(
    maxContextTokens,
    getModelMaxTokens(tokensModel, providerEndpointMap[provider], options.endpointTokenConfig),
    18000,
  );

  if (
    agent.endpoint === EModelEndpoint.azureOpenAI &&
    options.llmConfig?.azureOpenAIApiInstanceName == null
  ) {
    agent.provider = Providers.OPENAI;
  }

  if (options.provider != null) {
    agent.provider = options.provider;
  }

  /** @type {import('illuma-agents').GenericTool[]} */
  let tools = options.tools?.length ? options.tools : structuredTools;
  if (
    (agent.provider === Providers.GOOGLE || agent.provider === Providers.VERTEXAI) &&
    options.tools?.length &&
    structuredTools?.length
  ) {
    throw new Error(`{ "type": "${ErrorTypes.GOOGLE_TOOL_CONFLICT}"}`);
  } else if (
    (agent.provider === Providers.OPENAI ||
      agent.provider === Providers.AZURE ||
      agent.provider === Providers.ANTHROPIC) &&
    options.tools?.length &&
    structuredTools?.length
  ) {
    tools = structuredTools.concat(options.tools);
  }

  /** @type {import('illuma-agents').ClientOptions} */
  agent.model_parameters = { ...options.llmConfig };
  if (options.configOptions) {
    agent.model_parameters.configuration = options.configOptions;
  }

  if (agent.instructions && agent.instructions !== '') {
    agent.instructions = replaceSpecialVars({
      text: agent.instructions,
      user: req.user,
    });
  }

  if (typeof agent.artifacts === 'string' && agent.artifacts !== '') {
    agent.additional_instructions = generateArtifactsPrompt({
      endpoint: agent.provider,
      artifacts: agent.artifacts,
      model: agent.model,
    });
  }

  // Prepend clarification to instructions (which comes FIRST in system prompt)
  // This ensures the model sees clarification BEFORE the massive artifacts prompt
  if (agent.clarificationPrompt) {
    const options = agent.clarificationOptions?.length > 0
      ? `\n\nSuggest these options:\n${agent.clarificationOptions.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}`
      : '';
    const clarification = `**CRITICAL: CLARIFICATION REQUIRED BEFORE PROCEEDING**

Your FIRST and ONLY response must be to ask this clarification question:
"${agent.clarificationPrompt}"${options}

Do NOT:
- Answer the question
- Use any tools  
- Generate any code
- Make assumptions about what they want

ONLY ask the clarification question above, then STOP and wait for their response.

---

`;
    agent.instructions = clarification + (agent.instructions || '');
  }

  return {
    ...agent,
    tools,
    attachments,
    resendFiles,
    userMCPAuthMap,
    toolContextMap,
    useLegacyContent: !!options.useLegacyContent,
    maxContextTokens: Math.round((agentMaxContextTokens - maxOutputTokens) * 0.9),
  };
};

module.exports = { initializeAgent };
