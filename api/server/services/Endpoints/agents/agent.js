const { Providers } = require('@librechat/agents');
const { logger } = require('@librechat/data-schemas');
const {
  primeResources,
  getModelMaxTokens,
  extractLibreChatParams,
  filterFilesByEndpointConfig,
  optionalChainWithEmptyCheck,
  countTokens,
} = require('@librechat/api');
const {
  ErrorTypes,
  EModelEndpoint,
  EToolResources,
  paramEndpoints,
  isAgentsEndpoint,
  replaceSpecialVars,
  providerEndpointMap,
} = require('librechat-data-provider');
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

  const { resendFiles, maxContextTokens, modelOptions } = extractLibreChatParams(_modelOptions);

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

  /** @type {import('@librechat/agents').GenericTool[]} */
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

  /** @type {import('@librechat/agents').ClientOptions} */
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

  // Debug: Log artifacts state
  logger.info(`[initializeAgent] agent.artifacts = ${JSON.stringify(agent.artifacts)}, type = ${typeof agent.artifacts}`);

  if (typeof agent.artifacts === 'string' && agent.artifacts !== '') {
    const artifactsPrompt = generateArtifactsPrompt({
      endpoint: agent.provider,
      artifacts: agent.artifacts,
      model: agent.model,
    });
    logger.info(`[initializeAgent] Generated artifacts prompt length: ${artifactsPrompt?.length || 0}`);
    agent.additional_instructions = artifactsPrompt;
  }

  // === DETAILED LLM CONTEXT LOGGING ===
  // Log every component being sent to the LLM with accurate token counts
  try {
    const tokenBreakdown = {
      agentId: agent.id,
      provider: agent.provider,
      model: agent.model,
      components: {},
      totals: { tokens: 0, chars: 0 },
    };

    // 1. Instructions (System Prompt - base)
    if (agent.instructions) {
      const instructionsTokens = await countTokens(agent.instructions);
      tokenBreakdown.components.instructions = {
        tokens: instructionsTokens,
        chars: agent.instructions.length,
        preview: agent.instructions.substring(0, 200) + (agent.instructions.length > 200 ? '...' : ''),
      };
      tokenBreakdown.totals.tokens += instructionsTokens;
      tokenBreakdown.totals.chars += agent.instructions.length;
    }

    // 2. Additional Instructions (Artifacts prompt, etc.)
    if (agent.additional_instructions) {
      const additionalTokens = await countTokens(agent.additional_instructions);
      tokenBreakdown.components.additional_instructions = {
        tokens: additionalTokens,
        chars: agent.additional_instructions.length,
        preview: agent.additional_instructions.substring(0, 200) + (agent.additional_instructions.length > 200 ? '...' : ''),
      };
      tokenBreakdown.totals.tokens += additionalTokens;
      tokenBreakdown.totals.chars += agent.additional_instructions.length;
    }

    // 3. Tools - individual breakdown
    if (tools?.length > 0) {
      const toolDetails = [];
      let totalToolTokens = 0;
      let totalToolChars = 0;

      for (const tool of tools) {
        const toolName = tool.name || tool.function?.name || 'unknown';
        const toolDescription = tool.description || tool.function?.description || '';
        
        // Build the tool schema representation (what gets sent to the LLM)
        let toolSchema;
        if (tool.schema) {
          toolSchema = { name: toolName, description: toolDescription, schema: tool.schema };
        } else if (tool.function) {
          toolSchema = tool.function;
        } else {
          toolSchema = { name: toolName, description: toolDescription };
        }
        
        const toolJson = JSON.stringify(toolSchema);
        const toolTokens = await countTokens(toolJson);
        
        toolDetails.push({
          name: toolName,
          tokens: toolTokens,
          chars: toolJson.length,
          descriptionPreview: toolDescription.substring(0, 100) + (toolDescription.length > 100 ? '...' : ''),
        });
        
        totalToolTokens += toolTokens;
        totalToolChars += toolJson.length;
      }

      tokenBreakdown.components.tools = {
        count: tools.length,
        totalTokens: totalToolTokens,
        totalChars: totalToolChars,
        breakdown: toolDetails,
      };
      tokenBreakdown.totals.tokens += totalToolTokens;
      tokenBreakdown.totals.chars += totalToolChars;
    }

    // 4. Tool context map (if any) - break down per tool
    if (toolContextMap && Object.keys(toolContextMap).length > 0) {
      const toolContextDetails = [];
      let totalContextTokens = 0;
      let totalContextChars = 0;

      for (const [toolName, contextValue] of Object.entries(toolContextMap)) {
        const contextJson = JSON.stringify(contextValue);
        const contextTokens = await countTokens(contextJson);
        toolContextDetails.push({
          name: toolName,
          tokens: contextTokens,
          chars: contextJson.length,
        });
        totalContextTokens += contextTokens;
        totalContextChars += contextJson.length;
      }

      tokenBreakdown.components.toolContext = {
        keys: Object.keys(toolContextMap),
        tokens: totalContextTokens,
        chars: totalContextChars,
        breakdown: toolContextDetails,
      };
      tokenBreakdown.totals.tokens += totalContextTokens;
      tokenBreakdown.totals.chars += totalContextChars;
    }

    // ========== LLM CONTEXT SUMMARY (INFO LEVEL) ==========
    // This shows the ACTUAL context being sent to the LLM
    const contextParts = [];
    if (tokenBreakdown.components.instructions?.tokens > 0) {
      contextParts.push(`Instructions: ${tokenBreakdown.components.instructions.tokens}`);
    }
    if (tokenBreakdown.components.additional_instructions?.tokens > 0) {
      contextParts.push(`Artifacts: ${tokenBreakdown.components.additional_instructions.tokens}`);
    }
    if (tokenBreakdown.components.tools?.totalTokens > 0) {
      contextParts.push(`Tools(${tokenBreakdown.components.tools.count}): ${tokenBreakdown.components.tools.totalTokens}`);
    }
    if (tokenBreakdown.components.toolContext?.tokens > 0) {
      contextParts.push(`ToolContext: ${tokenBreakdown.components.toolContext.tokens}`);
    }
    
    logger.info(
      `[LLMContext] Total: ${tokenBreakdown.totals.tokens} tokens | ${contextParts.join(' + ') || 'empty'}`
    );

    // Log detailed breakdown at debug level
    logger.debug('[initializeAgent] LLM Context Token Breakdown:', {
      agentId: tokenBreakdown.agentId,
      provider: tokenBreakdown.provider,
      model: tokenBreakdown.model,
      totalTokens: tokenBreakdown.totals.tokens,
      totalChars: tokenBreakdown.totals.chars,
      instructionsTokens: tokenBreakdown.components.instructions?.tokens || 0,
      additionalInstructionsTokens: tokenBreakdown.components.additional_instructions?.tokens || 0,
      toolCount: tokenBreakdown.components.tools?.count || 0,
      toolsTokens: tokenBreakdown.components.tools?.totalTokens || 0,
      toolContextTokens: tokenBreakdown.components.toolContext?.tokens || 0,
    });

    // Log detailed breakdown at debug level
    logger.debug('[initializeAgent] Full Token Breakdown:', tokenBreakdown);

    // Log individual tool tokens at debug level
    if (tokenBreakdown.components.tools?.breakdown) {
      logger.debug('[initializeAgent] Tool Token Details:', {
        tools: tokenBreakdown.components.tools.breakdown.map((t) => ({
          name: t.name,
          tokens: t.tokens,
        })),
      });
    }
    
    // Store detailed context breakdown for transaction tracking
    // This will be passed to spendStructuredTokens for storage
    agent.contextBreakdown = {
      // High-level totals
      instructions: tokenBreakdown.components.instructions?.tokens || 0,
      artifacts: tokenBreakdown.components.additional_instructions?.tokens || 0,
      tools: tokenBreakdown.components.tools?.totalTokens || 0,
      toolCount: tokenBreakdown.components.tools?.count || 0,
      toolContext: tokenBreakdown.components.toolContext?.tokens || 0,
      total: tokenBreakdown.totals.tokens,
      // Detailed per-tool breakdown
      toolsDetail: tokenBreakdown.components.tools?.breakdown?.map(t => ({
        name: t.name,
        tokens: t.tokens,
      })) || [],
      toolContextDetail: tokenBreakdown.components.toolContext?.breakdown?.map(t => ({
        name: t.name,
        tokens: t.tokens,
      })) || [],
    };
    
    // Log detailed breakdown
    const toolsList = agent.contextBreakdown.toolsDetail?.map(t => `${t.name}:${t.tokens}`).join(', ') || 'none';
    const contextList = agent.contextBreakdown.toolContextDetail?.map(t => `${t.name}:${t.tokens}`).join(', ') || 'none';
    logger.info(`[initializeAgent] contextBreakdown: instructions=${agent.contextBreakdown.instructions}, artifacts=${agent.contextBreakdown.artifacts}, tools=[${toolsList}], toolContext=[${contextList}], total=${agent.contextBreakdown.total}`);
  } catch (tokenCountError) {
    logger.warn('[initializeAgent] Error counting tokens:', {
      message: tokenCountError?.message || 'No message',
      name: tokenCountError?.name || 'Unknown',
      stack: tokenCountError?.stack?.split('\n').slice(0, 3).join('\n') || 'No stack',
    });
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
