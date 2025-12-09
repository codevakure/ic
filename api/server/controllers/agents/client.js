require('events').EventEmitter.defaultMaxListeners = 100;
const { logger } = require('@ranger/data-schemas');
const { DynamicStructuredTool } = require('@langchain/core/tools');
const { getBufferString, HumanMessage } = require('@langchain/core/messages');
const {
  createRun,
  Tokenizer,
  checkAccess,
  logAxiosError,
  sanitizeTitle,
  resolveHeaders,
  createSafeUser,
  getBalanceConfig,
  memoryInstructions,
  getTransactionsConfig,
  createMemoryProcessor,
  filterMalformedContentParts,
} = require('@ranger/api');
const {
  Callback,
  Providers,
  TitleMethod,
  formatMessage,
  labelContentByAgent,
  formatAgentMessages,
  getTokenCountForMessage,
  createMetadataAggregator,
} = require('illuma-agents');
const {
  Constants,
  Permissions,
  VisionModes,
  ContentTypes,
  EModelEndpoint,
  PermissionTypes,
  isAgentsEndpoint,
  AgentCapabilities,
  bedrockInputSchema,
  removeNullishValues,
} = require('ranger-data-provider');
const { initializeAgent } = require('~/server/services/Endpoints/agents/agent');
const { spendTokens, spendStructuredTokens } = require('~/models/spendTokens');
const { getFormattedMemories, deleteMemory, setMemory } = require('~/models');
const { encodeAndFormat } = require('~/server/services/Files/images/encode');
const { getProviderConfig } = require('~/server/services/Endpoints');
const { createContextHandlers } = require('~/app/clients/prompts');
const { generateBrandingPrompt } = require('~/app/clients/prompts/brandingPrompt');
const { getToolRoutingInstructions } = require('~/app/clients/prompts/toolRouting');
const { checkCapability } = require('~/server/services/Config');
const BaseClient = require('~/app/clients/BaseClient');
const { getRoleByName } = require('~/models/Role');
const { loadAgent } = require('~/models/Agent');
const { getMCPManager } = require('~/config');
const { getCodeExecutorInstructions } = require('~/server/utils/presentationInstructions');

const omitTitleOptions = new Set([
  'stream',
  'thinking',
  'streaming',
  'clientOptions',
  'thinkingConfig',
  'thinkingBudget',
  'includeThoughts',
  'maxOutputTokens',
  'additionalModelRequestFields',
]);

/**
 * @param {ServerRequest} req
 * @param {Agent} agent
 * @param {string} endpoint
 */
const payloadParser = ({ req, agent, endpoint }) => {
  if (isAgentsEndpoint(endpoint)) {
    return { model: undefined };
  } else if (endpoint === EModelEndpoint.bedrock) {
    const parsedValues = bedrockInputSchema.parse(agent.model_parameters);
    if (parsedValues.thinking == null) {
      parsedValues.thinking = false;
    }
    return parsedValues;
  }
  return req.body.endpointOption.model_parameters;
};

function createTokenCounter(encoding) {
  return function (message) {
    const countTokens = (text) => Tokenizer.getTokenCount(text, encoding);
    return getTokenCountForMessage(message, countTokens);
  };
}

function logToolError(graph, error, toolId) {
  logAxiosError({
    error,
    message: `[api/server/controllers/agents/client.js #chatCompletion] Tool Error "${toolId}"`,
  });
}

/**
 * Applies agent labeling to conversation history when multi-agent patterns are detected.
 * Labels content parts by their originating agent to prevent identity confusion.
 *
 * @param {TMessage[]} orderedMessages - The ordered conversation messages
 * @param {Agent} primaryAgent - The primary agent configuration
 * @param {Map<string, Agent>} agentConfigs - Map of additional agent configurations
 * @returns {TMessage[]} Messages with agent labels applied where appropriate
 */
function applyAgentLabelsToHistory(orderedMessages, primaryAgent, agentConfigs) {
  const shouldLabelByAgent = (primaryAgent.edges?.length ?? 0) > 0 || (agentConfigs?.size ?? 0) > 0;

  if (!shouldLabelByAgent) {
    return orderedMessages;
  }

  const processedMessages = [];

  for (let i = 0; i < orderedMessages.length; i++) {
    const message = orderedMessages[i];

    /** @type {Record<string, string>} */
    const agentNames = { [primaryAgent.id]: primaryAgent.name || 'Assistant' };

    if (agentConfigs) {
      for (const [agentId, agentConfig] of agentConfigs.entries()) {
        agentNames[agentId] = agentConfig.name || agentConfig.id;
      }
    }

    if (
      !message.isCreatedByUser &&
      message.metadata?.agentIdMap &&
      Array.isArray(message.content)
    ) {
      try {
        const labeledContent = labelContentByAgent(
          message.content,
          message.metadata.agentIdMap,
          agentNames,
        );

        processedMessages.push({ ...message, content: labeledContent });
      } catch (error) {
        logger.error('[AgentClient] Error applying agent labels to message:', error);
        processedMessages.push(message);
      }
    } else {
      processedMessages.push(message);
    }
  }

  return processedMessages;
}

class AgentClient extends BaseClient {
  constructor(options = {}) {
    super(null, options);
    /** The current client class
     * @type {string} */
    this.clientName = EModelEndpoint.agents;

    /** @type {'discard' | 'summarize'} */
    this.contextStrategy = 'discard';

    /** @deprecated @type {true} - Is a Chat Completion Request */
    this.isChatCompletion = true;

    /** @type {AgentRun} */
    this.run;

    const {
      agentConfigs,
      contentParts,
      collectedUsage,
      artifactPromises,
      maxContextTokens,
      ...clientOptions
    } = options;

    this.agentConfigs = agentConfigs;
    this.maxContextTokens = maxContextTokens;
    /** @type {MessageContentComplex[]} */
    this.contentParts = contentParts;
    /** @type {Array<UsageMetadata>} */
    this.collectedUsage = collectedUsage;
    /** @type {ArtifactPromises} */
    this.artifactPromises = artifactPromises;
    /** @type {AgentClientOptions} */
    this.options = Object.assign({ endpoint: options.endpoint }, clientOptions);
    /** @type {string} */
    this.model = this.options.agent.model_parameters.model;
    /** The key for the usage object's input tokens
     * @type {string} */
    this.inputTokensKey = 'input_tokens';
    /** The key for the usage object's output tokens
     * @type {string} */
    this.outputTokensKey = 'output_tokens';
    /** @type {UsageMetadata} */
    this.usage;
    /** @type {Record<string, number>} */
    this.indexTokenCountMap = {};
    /** @type {(messages: BaseMessage[]) => Promise<void>} */
    this.processMemory;
    /** @type {Record<number, string> | null} */
    this.agentIdMap = null;
  }

  /**
   * Returns the aggregated content parts for the current run.
   * @returns {MessageContentComplex[]} */
  getContentParts() {
    return this.contentParts;
  }

  setOptions(options) {
    // Options set for agent client
  }

  /**
   * `AgentClient` is not opinionated about vision requests, so we don't do anything here
   * @param {MongoFile[]} attachments
   */
  checkVisionRequest() {}

  getSaveOptions() {
    // TODO:
    // would need to be override settings; otherwise, model needs to be undefined
    // model: this.override.model,
    // instructions: this.override.instructions,
    // additional_instructions: this.override.additional_instructions,
    let runOptions = {};
    try {
      runOptions = payloadParser(this.options);
    } catch (error) {
      logger.error(
        '[api/server/controllers/agents/client.js #getSaveOptions] Error parsing options',
        error,
      );
    }

    return removeNullishValues(
      Object.assign(
        {
          endpoint: this.options.endpoint,
          agent_id: this.options.agent.id,
          modelLabel: this.options.modelLabel,
          maxContextTokens: this.options.maxContextTokens,
          resendFiles: this.options.resendFiles,
          imageDetail: this.options.imageDetail,
          spec: this.options.spec,
          iconURL: this.options.iconURL,
        },
        // TODO: PARSE OPTIONS BY PROVIDER, MAY CONTAIN SENSITIVE DATA
        runOptions,
      ),
    );
  }

  getBuildMessagesOptions() {
    return {
      instructions: this.options.agent.instructions,
      additional_instructions: this.options.agent.additional_instructions,
    };
  }

  /**
   *
   * @param {TMessage} message
   * @param {Array<MongoFile>} attachments
   * @returns {Promise<Array<Partial<MongoFile>>>}
   */
  async addImageURLs(message, attachments) {
    const { files, image_urls } = await encodeAndFormat(
      this.options.req,
      attachments,
      {
        provider: this.options.agent.provider,
        endpoint: this.options.endpoint,
      },
      VisionModes.agents,
    );
    message.image_urls = image_urls.length ? image_urls : undefined;
    return files;
  }

  async buildMessages(
    messages,
    parentMessageId,
    { instructions = null, additional_instructions = null },
    opts,
  ) {
    let orderedMessages = this.constructor.getMessagesForConversation({
      messages,
      parentMessageId,
      summary: this.shouldSummarize,
    });

    orderedMessages = applyAgentLabelsToHistory(
      orderedMessages,
      this.options.agent,
      this.agentConfigs,
    );

    let payload;
    /** @type {number | undefined} */
    let promptTokens;

    /** @type {string} */
    let systemContent = [instructions ?? '', additional_instructions ?? '']
      .filter(Boolean)
      .join('\n')
      .trim();

    // Save original agent instructions for token tracking (before branding, code executor, etc. are added)
    const originalAgentInstructions = systemContent;

    // 🛡️ GUARDRAILS: Use high-level handler from @ranger/guardrails package
    // Extracts guardrail context from message history and provides systemNote for LLM
    // All guardrails logic is centralized in the package for maintainability
    const { getGuardrailsService } = require('@ranger/guardrails');
    const guardrailsService = getGuardrailsService();
    const guardrailContext = guardrailsService.extractGuardrailContext(orderedMessages);
    
    if (guardrailContext.hasGuardrailContext && guardrailContext.systemNote) {
      systemContent = [systemContent, guardrailContext.systemNote]
        .filter(Boolean)
        .join('\n\n')
        .trim();
    }

    if (this.options.attachments) {
      const attachments = await this.options.attachments;
      const latestMessage = orderedMessages[orderedMessages.length - 1];

      if (this.message_file_map) {
        this.message_file_map[latestMessage.messageId] = attachments;
      } else {
        this.message_file_map = {
          [latestMessage.messageId]: attachments,
        };
      }

      await this.addFileContextToMessage(latestMessage, attachments);
      const files = await this.processAttachments(latestMessage, attachments);

      this.options.attachments = files;
    }

    /** Note: Bedrock uses legacy RAG API handling */
    if (this.message_file_map && !isAgentsEndpoint(this.options.endpoint)) {
      this.contextHandlers = createContextHandlers(
        this.options.req,
        orderedMessages[orderedMessages.length - 1].text,
      );
    }

    // Determine if current message has explicit attachments (files attached to THIS message)
    // At this point, this.options.attachments has been awaited and is an array (or undefined)
    const latestMessageId = orderedMessages[orderedMessages.length - 1]?.messageId;
    const currentMessageAttachments = this.message_file_map?.[latestMessageId] || [];
    const currentMessageHasAttachments = currentMessageAttachments.length > 0;

    const formattedMessages = orderedMessages.map((message, i) => {
      const formattedMessage = formatMessage({
        message,
        userName: this.options?.name,
        assistantName: this.options?.modelLabel,
      });

      if (message.fileContext && i !== orderedMessages.length - 1) {
        if (typeof formattedMessage.content === 'string') {
          formattedMessage.content = message.fileContext + '\n' + formattedMessage.content;
        } else {
          const textPart = formattedMessage.content.find((part) => part.type === 'text');
          textPart
            ? (textPart.text = message.fileContext + '\n' + textPart.text)
            : formattedMessage.content.unshift({ type: 'text', text: message.fileContext });
        }
      } else if (message.fileContext && i === orderedMessages.length - 1) {
        systemContent = [systemContent, message.fileContext].join('\n');
      }

      const needsTokenCount =
        (this.contextStrategy && !orderedMessages[i].tokenCount) || message.fileContext;

      /* If tokens were never counted, or, is a Vision request and the message has files, count again */
      if (needsTokenCount || (this.isVisionModel && (message.image_urls || message.files))) {
        orderedMessages[i].tokenCount = this.getTokenCountForMessage(formattedMessage);
      }

      /* If message has files, calculate image token cost */
      if (this.message_file_map && this.message_file_map[message.messageId]) {
        const attachments = this.message_file_map[message.messageId];
        const isCurrentMessage = i === orderedMessages.length - 1;
        
        for (const file of attachments) {
          if (file.embedded) {
            // If current message has explicit attachments, only process files from current message
            // Otherwise, process all conversation files for context
            if (currentMessageHasAttachments) {
              // Only process files from the current message
              if (isCurrentMessage) {
                this.contextHandlers?.processFile(file);
              }
            } else {
              // No explicit attachments - process all conversation files
              this.contextHandlers?.processFile(file);
            }
            continue;
          }
          if (file.metadata?.fileIdentifier) {
            continue;
          }
          // orderedMessages[i].tokenCount += this.calculateImageTokenCost({
          //   width: file.width,
          //   height: file.height,
          //   detail: this.options.imageDetail ?? ImageDetail.auto,
          // });
        }
      }

      return formattedMessage;
    });

    if (this.contextHandlers) {
      this.augmentedPrompt = await this.contextHandlers.createContext();
      systemContent = this.augmentedPrompt + systemContent;
    }

    // Add code executor package information if execute_code tool is present
    const hasCodeExecutor = this.options.agent.tools?.some(
      (tool) => tool && (tool.name === 'execute_code' || tool.name?.includes('execute_code'))
    );
    if (hasCodeExecutor) {
      const codeExecutorInfo = getCodeExecutorInstructions();
      systemContent += '\n\n' + codeExecutorInfo;
    }

    // Inject MCP server instructions if available
    const ephemeralAgent = this.options.req.body.ephemeralAgent;
    let mcpServers = [];
    let mcpInstructions = null;

    // Check for ephemeral agent MCP servers
    if (ephemeralAgent && ephemeralAgent.mcp && ephemeralAgent.mcp.length > 0) {
      mcpServers = ephemeralAgent.mcp;
    }
    // Check for regular agent MCP tools
    else if (this.options.agent && this.options.agent.tools) {
      mcpServers = this.options.agent.tools
        .filter(
          (tool) =>
            tool instanceof DynamicStructuredTool && tool.name.includes(Constants.mcp_delimiter),
        )
        .map((tool) => tool.name.split(Constants.mcp_delimiter).pop())
        .filter(Boolean);
    }

    // Fetch MCP instructions once, store for later use
    if (mcpServers.length > 0) {
      try {
        mcpInstructions = await getMCPManager().formatInstructionsForContext(mcpServers);
        if (mcpInstructions) {
          // MCP instructions fetched successfully
        }
      } catch (error) {
        logger.error('[AgentClient] Failed to fetch MCP instructions:', error);
      }
    }

    // Generate and inject branding prompt with user context and timezone
    // This provides consistent identity and behavior across all models
    const appConfig = this.options.req.config;
    // For agents, get config from the agent's provider (e.g., 'bedrock'), not 'agents' endpoint
    const providerEndpoint = this.options.agent?.provider || this.options.endpoint;
    const endpointConfig = appConfig?.endpoints?.[providerEndpoint];

    // Generate branding prompt (returns string with identity, colors, guidelines)
    const brandingPrompt = generateBrandingPrompt({
      req: this.options.req,
      endpointConfig,
    });

    // Generate tool routing instructions when both artifacts and code executor are available
    // This provides clear separation rules to prevent overlap
    const hasArtifacts = Boolean(this.options.agent?.artifacts);
    let toolRoutingPrompt = null;
    if (hasCodeExecutor && hasArtifacts) {
      toolRoutingPrompt = getToolRoutingInstructions();
    }

    // Build system content: Branding → Tool Routing → Agent Instructions → Code Executor → MCP
    // NOTE: Memory is intentionally NOT included in system message for cache optimization.
    // System message is STATIC and gets cached (5-min TTL per session).
    // Memory changes frequently, so it's injected as a separate user message.
    const allParts = [brandingPrompt, toolRoutingPrompt, systemContent, mcpInstructions].filter(Boolean);
    
    // Fetch memory but store separately - will be injected as user message in chatCompletion()
    // This prevents memory updates from invalidating the cached system prompt
    const memoryContent = await this.useMemory();
    if (memoryContent) {
      this.memoryContext = `${memoryInstructions}\n\n# Existing memory about the user:\n${memoryContent}`;
    } else {
      this.memoryContext = null;
    }
    
    // Combine static parts only
    systemContent = allParts.join('\n\n');
    
    this.options.agent.instructions = systemContent;

    // Track per-prompt token breakdown for admin reporting
    // This provides visibility into what's consuming the input token budget
    if (this.options.agent?.context?.setPromptBreakdown) {
      const tokenCounter = this.options.agent.context.tokenCounter;
      if (tokenCounter) {
        const promptBreakdown = {
          branding: brandingPrompt ? tokenCounter(brandingPrompt) : 0,
          toolRouting: toolRoutingPrompt ? tokenCounter(toolRoutingPrompt) : 0,
          agentInstructions: originalAgentInstructions ? tokenCounter(originalAgentInstructions) : 0,
          mcpInstructions: mcpInstructions ? tokenCounter(mcpInstructions) : 0,
          artifacts: 0, // Artifacts prompt is included in agent instructions
          memory: this.memoryContext ? tokenCounter(this.memoryContext) : 0,
        };
        this.options.agent.context.setPromptBreakdown(promptBreakdown);
      }
    }

    /** @type {Record<string, number> | undefined} */
    let tokenCountMap;

    if (this.contextStrategy) {
      ({ payload, promptTokens, tokenCountMap, messages } = await this.handleContextStrategy({
        orderedMessages,
        formattedMessages,
      }));
    }

    for (let i = 0; i < messages.length; i++) {
      this.indexTokenCountMap[i] = messages[i].tokenCount;
    }

    const result = {
      tokenCountMap,
      prompt: payload,
      promptTokens,
      messages,
    };

    if (promptTokens >= 0 && typeof opts?.getReqData === 'function') {
      opts.getReqData({ promptTokens });
    }

    return result;
  }

  /**
   * Creates a promise that resolves with the memory promise result or undefined after a timeout
   * @param {Promise<(TAttachment | null)[] | undefined>} memoryPromise - The memory promise to await
   * @param {number} timeoutMs - Timeout in milliseconds (default: 3000)
   * @returns {Promise<(TAttachment | null)[] | undefined>}
   */
  async awaitMemoryWithTimeout(memoryPromise, timeoutMs = 3000) {
    if (!memoryPromise) {
      return;
    }

    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Memory processing timeout')), timeoutMs),
      );

      const attachments = await Promise.race([memoryPromise, timeoutPromise]);
      return attachments;
    } catch (error) {
      if (error.message === 'Memory processing timeout') {
        logger.warn('[AgentClient] Memory processing timed out after 3 seconds');
      } else {
        logger.error('[AgentClient] Error processing memory:', error);
      }
      return;
    }
  }

  /**
   * @returns {Promise<string | undefined>}
   */
  async useMemory() {
    const user = this.options.req.user;
    // Memory is opt-in: user must explicitly enable it (default is false)
    if (user.personalization?.memories !== true) {
      return;
    }
    const hasAccess = await checkAccess({
      user,
      permissionType: PermissionTypes.MEMORIES,
      permissions: [Permissions.USE],
      getRoleByName,
    });

    if (!hasAccess) {
      return;
    }
    const appConfig = this.options.req.config;
    const memoryConfig = appConfig.memory;
    if (!memoryConfig || memoryConfig.disabled === true) {
      return;
    }

    /** @type {Agent} */
    let prelimAgent;
    const allowedProviders = new Set(
      appConfig?.endpoints?.[EModelEndpoint.agents]?.allowedProviders,
    );
    try {
      if (memoryConfig.agent?.id != null && memoryConfig.agent.id !== this.options.agent.id) {
        prelimAgent = await loadAgent({
          req: this.options.req,
          agent_id: memoryConfig.agent.id,
          endpoint: EModelEndpoint.agents,
        });
      } else if (
        memoryConfig.agent?.id == null &&
        memoryConfig.agent?.model != null &&
        memoryConfig.agent?.provider != null
      ) {
        prelimAgent = { id: Constants.EPHEMERAL_AGENT_ID, ...memoryConfig.agent };
      }
    } catch (error) {
      logger.error(
        '[api/server/controllers/agents/client.js #useMemory] Error loading agent for memory',
        error,
      );
    }

    const agent = await initializeAgent({
      req: this.options.req,
      res: this.options.res,
      agent: prelimAgent,
      allowedProviders,
      endpointOption: {
        endpoint:
          prelimAgent.id !== Constants.EPHEMERAL_AGENT_ID
            ? EModelEndpoint.agents
            : memoryConfig.agent?.provider,
      },
    });

    if (!agent) {
      logger.warn(
        '[api/server/controllers/agents/client.js #useMemory] No agent found for memory',
        memoryConfig,
      );
      return;
    }

    const llmConfig = Object.assign(
      {
        provider: agent.provider,
        model: agent.model,
      },
      agent.model_parameters,
    );

    /** @type {import('@ranger/api').MemoryConfig} */
    const config = {
      validKeys: memoryConfig.validKeys,
      instructions: agent.instructions,
      llmConfig,
      tokenLimit: memoryConfig.tokenLimit,
    };

    const userId = this.options.req.user.id + '';
    const messageId = this.responseMessageId + '';
    const conversationId = this.conversationId + '';
    const [withoutKeys, processMemory] = await createMemoryProcessor({
      userId,
      config,
      messageId,
      conversationId,
      memoryMethods: {
        setMemory,
        deleteMemory,
        getFormattedMemories,
      },
      res: this.options.res,
    });

    this.processMemory = processMemory;
    return withoutKeys;
  }

  /**
   * Filters out image URLs from message content
   * @param {BaseMessage} message - The message to filter
   * @returns {BaseMessage} - A new message with image URLs removed
   */
  filterImageUrls(message) {
    if (!message.content || typeof message.content === 'string') {
      return message;
    }

    if (Array.isArray(message.content)) {
      const filteredContent = message.content.filter(
        (part) => part.type !== ContentTypes.IMAGE_URL,
      );

      if (filteredContent.length === 1 && filteredContent[0].type === ContentTypes.TEXT) {
        const MessageClass = message.constructor;
        return new MessageClass({
          content: filteredContent[0].text,
          additional_kwargs: message.additional_kwargs,
        });
      }

      const MessageClass = message.constructor;
      return new MessageClass({
        content: filteredContent,
        additional_kwargs: message.additional_kwargs,
      });
    }

    return message;
  }

  /**
   * @param {BaseMessage[]} messages
   * @returns {Promise<void | (TAttachment | null)[]>}
   */
  async runMemory(messages) {
    try {
      if (this.processMemory == null) {
        return;
      }
      const appConfig = this.options.req.config;
      const memoryConfig = appConfig.memory;
      const messageWindowSize = memoryConfig?.messageWindowSize ?? 5;

      let messagesToProcess = [...messages];
      if (messages.length > messageWindowSize) {
        for (let i = messages.length - messageWindowSize; i >= 0; i--) {
          const potentialWindow = messages.slice(i, i + messageWindowSize);
          if (potentialWindow[0]?.role === 'user') {
            messagesToProcess = [...potentialWindow];
            break;
          }
        }

        if (messagesToProcess.length === messages.length) {
          messagesToProcess = [...messages.slice(-messageWindowSize)];
        }
      }

      const filteredMessages = messagesToProcess.map((msg) => this.filterImageUrls(msg));
      const bufferString = getBufferString(filteredMessages);
      const bufferMessage = new HumanMessage(`# Current Chat:\n\n${bufferString}`);
      return await this.processMemory([bufferMessage]);
    } catch (error) {
      logger.error('Memory Agent failed to process memory', error);
    }
  }

  /** @type {sendCompletion} */
  async sendCompletion(payload, opts = {}) {
    await this.chatCompletion({
      payload,
      onProgress: opts.onProgress,
      userMCPAuthMap: opts.userMCPAuthMap,
      abortController: opts.abortController,
    });

    const completion = filterMalformedContentParts(this.contentParts);
    
    // Debug: Check if content was anonymized
    if (completion && Array.isArray(completion)) {
      const textContent = completion.find(p => p.type === 'text');
      if (textContent?.text?.includes('{PHONE}') || textContent?.text?.includes('{NAME}')) {
        logger.info('[AgentClient] ✅ Completion contains anonymized content (PII masked)');
      }
    }
    
    // Build metadata object with agentIdMap and guardrail tracking
    let metadata = this.agentIdMap ? { agentIdMap: this.agentIdMap } : undefined;
    
    // Include guardrail tracking in metadata (for traces/audit)
    if (this.metadata?.guardrailTracking) {
      metadata = {
        ...(metadata || {}),
        guardrailTracking: this.metadata.guardrailTracking
      };
    }

    return { completion, metadata };
  }

  /**
   * @param {Object} params
   * @param {string} [params.model]
   * @param {string} [params.context='message']
   * @param {AppConfig['balance']} [params.balance]
   * @param {AppConfig['transactions']} [params.transactions]
   * @param {UsageMetadata[]} [params.collectedUsage=this.collectedUsage]
   */
  async recordCollectedUsage({
    model,
    balance,
    transactions,
    context = 'message',
    collectedUsage = this.collectedUsage,
  }) {
    if (!collectedUsage || !collectedUsage.length) {
      return;
    }
    
    const firstUsage = collectedUsage[0];
    
    const input_tokens =
      (collectedUsage[0]?.input_tokens || 0) +
      (Number(collectedUsage[0]?.input_token_details?.cache_creation) || 0) +
      (Number(collectedUsage[0]?.input_token_details?.cache_read) || 0);

    let output_tokens = 0;
    let previousTokens = input_tokens; // Start with original input
    for (let i = 0; i < collectedUsage.length; i++) {
      const usage = collectedUsage[i];
      if (!usage) {
        continue;
      }

      const cache_creation = Number(usage.input_token_details?.cache_creation) || 0;
      const cache_read = Number(usage.input_token_details?.cache_read) || 0;

      const agentContextBreakdown = this.options.agent?.contextBreakdown;
      
      const txMetadata = {
        context,
        balance,
        transactions,
        conversationId: this.conversationId,
        user: this.user ?? this.options.req.user?.id,
        endpointTokenConfig: this.options.endpointTokenConfig,
        model: usage.model ?? model ?? this.model ?? this.options.agent.model_parameters.model,
        // Include context breakdown for detailed token tracking in admin UI
        contextBreakdown: agentContextBreakdown,
      };

      if (i > 0) {
        // Count new tokens generated (input_tokens minus previous accumulated tokens)
        output_tokens +=
          (Number(usage.input_tokens) || 0) + cache_creation + cache_read - previousTokens;
      }

      // Add this message's output tokens
      output_tokens += Number(usage.output_tokens) || 0;

      // Update previousTokens to include this message's output
      previousTokens += Number(usage.output_tokens) || 0;

      if (cache_creation > 0 || cache_read > 0) {
        spendStructuredTokens(txMetadata, {
          promptTokens: {
            input: usage.input_tokens,
            write: cache_creation,
            read: cache_read,
          },
          completionTokens: usage.output_tokens,
        }).catch((err) => {
          logger.error(
            '[api/server/controllers/agents/client.js #recordCollectedUsage] Error spending structured tokens',
            err,
          );
        });
        continue;
      }
      spendTokens(txMetadata, {
        promptTokens: usage.input_tokens,
        completionTokens: usage.output_tokens,
      }).catch((err) => {
        logger.error(
          '[api/server/controllers/agents/client.js #recordCollectedUsage] Error spending tokens',
          err,
        );
      });
    }

    this.usage = {
      input_tokens,
      output_tokens,
    };

    // Log LLM Router metrics if routing was applied
    const req = this.options.req;
    if (req?.body?.routedModel) {
      const actualModel = model ?? this.model ?? this.options.agent?.model_parameters?.model;
      const originalModel = req.body.originalModel;
      
      // Get pricing for actual model used
      const MODEL_PRICING = {
        'global.anthropic.claude-opus-4-5-20251101-v1:0': { input: 5.00, output: 25.00 },
        'us.anthropic.claude-sonnet-4-5-20250929-v1:0': { input: 3.00, output: 15.00 },
        'us.anthropic.claude-haiku-4-5-20251001-v1:0': { input: 1.00, output: 5.00 },
        'us.amazon.nova-premier-v1:0': { input: 2.50, output: 12.50 },
        'us.amazon.nova-pro-v1:0': { input: 0.80, output: 3.20 },
        'us.amazon.nova-lite-v1:0': { input: 0.06, output: 0.24 },
        'us.amazon.nova-micro-v1:0': { input: 0.035, output: 0.14 },
        'us.anthropic.claude-3-5-sonnet-20241022-v2:0': { input: 3.00, output: 15.00 },
        'us.anthropic.claude-3-5-haiku-20241022-v1:0': { input: 1.00, output: 5.00 },
      };
      
      const actualPricing = MODEL_PRICING[actualModel] || { input: 0, output: 0 };
      const originalPricing = MODEL_PRICING[originalModel] || { input: 0, output: 0 };
      
      const actualInputCost = (input_tokens / 1_000_000) * actualPricing.input;
      const actualOutputCost = (output_tokens / 1_000_000) * actualPricing.output;
      const actualTotalCost = actualInputCost + actualOutputCost;
      
      const originalInputCost = (input_tokens / 1_000_000) * originalPricing.input;
      const originalOutputCost = (output_tokens / 1_000_000) * originalPricing.output;
      const originalTotalCost = originalInputCost + originalOutputCost;
      
      const cachedTokens = this.usage?.inputTokenDetails?.cache_read_input_tokens || 0;
      const savings = originalTotalCost - actualTotalCost;
      const savingsPercent = originalTotalCost > 0 ? ((savings / originalTotalCost) * 100).toFixed(0) : 0;
      
      // Single consolidated log line for actual usage
      const getShortName = (model) => {
        if (!model) return 'unknown';
        if (model.includes('opus')) return 'Opus';
        if (model.includes('sonnet')) return 'Sonnet';
        if (model.includes('haiku')) return 'Haiku';
        if (model.includes('nova-micro')) return 'Nova-Micro';
        return model.split('.').pop()?.replace('-v1:0', '')?.substring(0, 15) || model;
      };
      
      logger.info(
        `[Usage] Model: ${getShortName(actualModel)} | ` +
        `In: ${input_tokens} | Out: ${output_tokens} | Cached: ${cachedTokens} | ` +
        `Cost: $${actualTotalCost.toFixed(4)}` +
        (savings > 0 ? ` | Saved: $${savings.toFixed(4)} (${savingsPercent}%)` : '')
      );
    }
  }

  /**
   * Get stream usage as returned by this client's API response.
   * @returns {UsageMetadata} The stream usage object.
   */
  getStreamUsage() {
    return this.usage;
  }

  /**
   * @param {TMessage} responseMessage
   * @returns {number}
   */
  getTokenCountForResponse({ content }) {
    return this.getTokenCountForMessage({
      role: 'assistant',
      content,
    });
  }

  /**
   * Calculates the correct token count for the current user message based on the token count map and API usage.
   * Edge case: If the calculation results in a negative value, it returns the original estimate.
   * If revisiting a conversation with a chat history entirely composed of token estimates,
   * the cumulative token count going forward should become more accurate as the conversation progresses.
   * @param {Object} params - The parameters for the calculation.
   * @param {Record<string, number>} params.tokenCountMap - A map of message IDs to their token counts.
   * @param {string} params.currentMessageId - The ID of the current message to calculate.
   * @param {OpenAIUsageMetadata} params.usage - The usage object returned by the API.
   * @returns {number} The correct token count for the current user message.
   */
  calculateCurrentTokenCount({ tokenCountMap, currentMessageId, usage }) {
    const originalEstimate = tokenCountMap[currentMessageId] || 0;

    if (!usage || typeof usage[this.inputTokensKey] !== 'number') {
      return originalEstimate;
    }

    tokenCountMap[currentMessageId] = 0;
    const totalTokensFromMap = Object.values(tokenCountMap).reduce((sum, count) => {
      const numCount = Number(count);
      return sum + (isNaN(numCount) ? 0 : numCount);
    }, 0);
    const totalInputTokens = usage[this.inputTokensKey] ?? 0;

    const currentMessageTokens = totalInputTokens - totalTokensFromMap;
    return currentMessageTokens > 0 ? currentMessageTokens : originalEstimate;
  }

  /**
   * @param {object} params
   * @param {string | ChatCompletionMessageParam[]} params.payload
   * @param {Record<string, Record<string, string>>} [params.userMCPAuthMap]
   * @param {AbortController} [params.abortController]
   */
  async chatCompletion({ payload, userMCPAuthMap, abortController = null }) {
    /** @type {Partial<GraphRunnableConfig>} */
    let config;
    /** @type {ReturnType<createRun>} */
    let run;
    /** @type {Promise<(TAttachment | null)[] | undefined>} */
    let memoryPromise;
    const appConfig = this.options.req.config;
    const balanceConfig = getBalanceConfig(appConfig);
    const transactionsConfig = getTransactionsConfig(appConfig);
    try {
      if (!abortController) {
        abortController = new AbortController();
      }

      /** @type {AppConfig['endpoints']['agents']} */
      const agentsEConfig = appConfig.endpoints?.[EModelEndpoint.agents];

      config = {
        runName: 'AgentRun',
        configurable: {
          thread_id: this.conversationId,
          last_agent_index: this.agentConfigs?.size ?? 0,
          user_id: this.user ?? this.options.req.user?.id,
          hide_sequential_outputs: this.options.agent.hide_sequential_outputs,
          requestBody: {
            messageId: this.responseMessageId,
            conversationId: this.conversationId,
            parentMessageId: this.parentMessageId,
          },
          user: createSafeUser(this.options.req.user),
        },
        recursionLimit: agentsEConfig?.recursionLimit ?? 25,
        signal: abortController.signal,
        streamMode: 'values',
        version: 'v2',
      };

      const toolSet = new Set((this.options.agent.tools ?? []).map((tool) => tool && tool.name));
      
      let { messages: initialMessages, indexTokenCountMap } = formatAgentMessages(
        payload,
        this.indexTokenCountMap,
        toolSet,
      );

      // Inject memory as context at the beginning of conversation history
      // This keeps the system prompt static (cacheable) while providing memory context.
      // The memory is prepended as a user message with clear context markers,
      // followed by an AI acknowledgment, so it doesn't disrupt conversation flow.
      // This way, system prompt can be cached independently of memory changes.
      if (this.memoryContext) {
        const { AIMessage } = require('@langchain/core/messages');
        const memoryUserMessage = new HumanMessage({
          content: `[MEMORY CONTEXT]\n${this.memoryContext}`,
        });
        const memoryAckMessage = new AIMessage({
          content: 'I\'ve noted this information about you and will use it to personalize our conversation.',
        });
        // Prepend memory exchange so it comes right after system message
        initialMessages = [memoryUserMessage, memoryAckMessage, ...initialMessages];
      }

      /**
       * @param {BaseMessage[]} messages
       */
      const runAgents = async (messages) => {
        const agents = [this.options.agent];
        if (
          this.agentConfigs &&
          this.agentConfigs.size > 0 &&
          ((this.options.agent.edges?.length ?? 0) > 0 ||
            (await checkCapability(this.options.req, AgentCapabilities.chain)))
        ) {
          agents.push(...this.agentConfigs.values());
        }

        if (agents[0].recursion_limit && typeof agents[0].recursion_limit === 'number') {
          config.recursionLimit = agents[0].recursion_limit;
        }

        if (
          agentsEConfig?.maxRecursionLimit &&
          config.recursionLimit > agentsEConfig?.maxRecursionLimit
        ) {
          config.recursionLimit = agentsEConfig?.maxRecursionLimit;
        }

        // TODO: needs to be added as part of AgentContext initialization
        // const noSystemModelRegex = [/\b(o1-preview|o1-mini|amazon\.titan-text)\b/gi];
        // const noSystemMessages = noSystemModelRegex.some((regex) =>
        //   agent.model_parameters.model.match(regex),
        // );
        // if (noSystemMessages === true && systemContent?.length) {
        //   const latestMessageContent = _messages.pop().content;
        //   if (typeof latestMessageContent !== 'string') {
        //     latestMessageContent[0].text = [systemContent, latestMessageContent[0].text].join('\n');
        //     _messages.push(new HumanMessage({ content: latestMessageContent }));
        //   } else {
        //     const text = [systemContent, latestMessageContent].join('\n');
        //     _messages.push(new HumanMessage(text));
        //   }
        // }
        // let messages = _messages;
        // if (agent.useLegacyContent === true) {
        //   messages = formatContentStrings(messages);
        // }
        // if (
        //   agent.model_parameters?.clientOptions?.defaultHeaders?.['anthropic-beta']?.includes(
        //     'prompt-caching',
        //   )
        // ) {
        //   messages = addCacheControl(messages);
        // }

        memoryPromise = this.runMemory(messages);

        run = await createRun({
          agents,
          indexTokenCountMap,
          runId: this.responseMessageId,
          signal: abortController.signal,
          customHandlers: this.options.eventHandlers,
          requestBody: config.configurable.requestBody,
          user: createSafeUser(this.options.req?.user),
          tokenCounter: createTokenCounter(this.getEncoding()),
        });

        if (!run) {
          throw new Error('Failed to create run');
        }

        this.run = run;
        if (userMCPAuthMap != null) {
          config.configurable.userMCPAuthMap = userMCPAuthMap;
        }

        /** @deprecated Agent Chain */
        config.configurable.last_agent_id = agents[agents.length - 1].id;
        await run.processStream({ messages }, config, {
          callbacks: {
            [Callback.TOOL_ERROR]: logToolError,
          },
        });

        config.signal = null;
      };

      await runAgents(initialMessages);
      /** @deprecated Agent Chain */
      if (config.configurable.hide_sequential_outputs) {
        this.contentParts = this.contentParts.filter((part, index) => {
          // Include parts that are either:
          // 1. At or after the finalContentStart index
          // 2. Of type tool_call
          // 3. Have tool_call_ids property
          return (
            index >= this.contentParts.length - 1 ||
            part.type === ContentTypes.TOOL_CALL ||
            part.tool_call_ids
          );
        });
      }

      try {
        /** Capture agent ID map if we have edges or multiple agents */
        const shouldStoreAgentMap =
          (this.options.agent.edges?.length ?? 0) > 0 || (this.agentConfigs?.size ?? 0) > 0;
        if (shouldStoreAgentMap && run?.Graph) {
          const contentPartAgentMap = run.Graph.getContentPartAgentMap();
          if (contentPartAgentMap && contentPartAgentMap.size > 0) {
            this.agentIdMap = Object.fromEntries(contentPartAgentMap);
          }
        }
      } catch (error) {
        logger.error('[AgentClient] Error capturing agent ID map:', error);
      }

      // Capture context breakdown for admin token tracking
      try {
        if (run?.Graph?.getContextBreakdown) {
          const contextBreakdown = run.Graph.getContextBreakdown();
          if (contextBreakdown) {
            this.options.agent.contextBreakdown = contextBreakdown;
          }
        }
      } catch (error) {
        logger.error('[AgentClient] Error capturing context breakdown:', error);
      }

      // 🛡️ OUTPUT MODERATION: Check completed response before finalizing
      // NOTE: We only moderate TEXT content, not THINK (thinking/reasoning) content
      try {
        const { getGuardrailsService } = require('@ranger/guardrails');
        const guardrailsService = getGuardrailsService();
        
        // Extract text content from contentParts for moderation
        let completionText = '';
        if (this.contentParts && Array.isArray(this.contentParts)) {
          completionText = this.contentParts
            .filter(part => part.type === ContentTypes.TEXT && typeof part.text === 'string')
            .map(part => part.text)
            .join('\n');
        }

        if (guardrailsService.isEnabled() && completionText && completionText.length > 0) {
          const outputResult = await guardrailsService.handleOutputModeration(completionText);
          
          // Always store tracking metadata for audit (even if action not applied)
          if (outputResult.trackingMetadata) {
            if (!this.metadata) {
              this.metadata = {};
            }
            this.metadata.guardrailTracking = outputResult.trackingMetadata;
          }
          
          // Handle BLOCKED content (only if action is applied)
          if (outputResult.blocked && outputResult.actionApplied && outputResult.modifiedResponse) {
            logger.warn('[AgentClient] 🚫 OUTPUT BLOCKED', {
              violations: outputResult.violations?.map(v => `${v.type}:${v.category}`) || []
            });
            
            // Replace all text content with block message
            this.contentParts = [{
              type: ContentTypes.TEXT,
              text: outputResult.modifiedResponse.text
            }];
            
            // Store block metadata for database save
            this.metadata = {
              ...this.metadata,
              ...outputResult.modifiedResponse.metadata
            };
          } 
          // Handle BLOCKED detected but action disabled
          else if (outputResult.trackingMetadata?.outcome === 'blocked' && !outputResult.actionApplied) {
            // Block detected but not applied
          }
          // Handle ANONYMIZED content (only if action is applied)
          else if (outputResult.actionApplied && outputResult.content && outputResult.content !== completionText) {
            // Find and update TEXT content parts with anonymized content
            const nonTextParts = this.contentParts.filter(part => part.type !== ContentTypes.TEXT);
            
            // Replace all text parts with a single anonymized text part
            this.contentParts = [
              ...nonTextParts,
              {
                type: ContentTypes.TEXT,
                text: outputResult.content
              }
            ];
          }
          // Handle ANONYMIZED detected but action disabled
          else if (outputResult.trackingMetadata?.outcome === 'anonymized' && !outputResult.actionApplied) {
            // Anonymize detected but not applied
          }
          // No logging for unmodified content (too verbose)
        }
      } catch (error) {
        logger.error('[AgentClient] ❌ OUTPUT moderation error:', error.message);
        // Don't block on moderation errors - let response through
      }
    } catch (err) {
      logger.error(
        '[api/server/controllers/agents/client.js #sendCompletion] Operation aborted',
        err,
      );
      if (!abortController.signal.aborted) {
        logger.error(
          '[api/server/controllers/agents/client.js #sendCompletion] Unhandled error type',
          err,
        );
        this.contentParts.push({
          type: ContentTypes.ERROR,
          [ContentTypes.ERROR]: `An error occurred while processing the request${err?.message ? `: ${err.message}` : ''}`,
        });
      }
    } finally {
      try {
        const attachments = await this.awaitMemoryWithTimeout(memoryPromise);
        if (attachments && attachments.length > 0) {
          this.artifactPromises.push(...attachments);
        }

        await this.recordCollectedUsage({
          context: 'message',
          balance: balanceConfig,
          transactions: transactionsConfig,
        });
      } catch (err) {
        logger.error(
          '[api/server/controllers/agents/client.js #chatCompletion] Error in cleanup phase',
          err,
        );
      }
      run = null;
      config = null;
      memoryPromise = null;
    }
  }

  /**
   *
   * @param {Object} params
   * @param {string} params.text
   * @param {string} params.conversationId
   */
  async titleConvo({ text, abortController }) {
    if (!this.run) {
      throw new Error('Run not initialized');
    }
    const { handleLLMEnd, collected: collectedMetadata } = createMetadataAggregator();
    const { req, res, agent } = this.options;
    const appConfig = req.config;
    let endpoint = agent.endpoint;

    /** @type {import('illuma-agents').ClientOptions} */
    let clientOptions = {
      model: agent.model || agent.model_parameters.model,
    };

    let titleProviderConfig = getProviderConfig({ provider: endpoint, appConfig });

    /** @type {TEndpoint | undefined} */
    const endpointConfig =
      appConfig.endpoints?.all ??
      appConfig.endpoints?.[endpoint] ??
      titleProviderConfig.customEndpointConfig;

    if (endpointConfig?.titleConvo === false) {
      return;
    }

    if (endpointConfig?.titleEndpoint && endpointConfig.titleEndpoint !== endpoint) {
      try {
        titleProviderConfig = getProviderConfig({
          provider: endpointConfig.titleEndpoint,
          appConfig,
        });
        endpoint = endpointConfig.titleEndpoint;
      } catch (error) {
        logger.warn(
          `[api/server/controllers/agents/client.js #titleConvo] Error getting title endpoint config for "${endpointConfig.titleEndpoint}", falling back to default`,
          error,
        );
        // Fall back to original provider config
        endpoint = agent.endpoint;
        titleProviderConfig = getProviderConfig({ provider: endpoint, appConfig });
      }
    }

    if (
      endpointConfig &&
      endpointConfig.titleModel &&
      endpointConfig.titleModel !== Constants.CURRENT_MODEL
    ) {
      clientOptions.model = endpointConfig.titleModel;
    }

    const options = await titleProviderConfig.getOptions({
      req,
      res,
      optionsOnly: true,
      overrideEndpoint: endpoint,
      overrideModel: clientOptions.model,
      endpointOption: { model_parameters: clientOptions },
    });

    let provider = options.provider ?? titleProviderConfig.overrideProvider ?? agent.provider;
    if (
      endpoint === EModelEndpoint.azureOpenAI &&
      options.llmConfig?.azureOpenAIApiInstanceName == null
    ) {
      provider = Providers.OPENAI;
    } else if (
      endpoint === EModelEndpoint.azureOpenAI &&
      options.llmConfig?.azureOpenAIApiInstanceName != null &&
      provider !== Providers.AZURE
    ) {
      provider = Providers.AZURE;
    }

    /** @type {import('illuma-agents').ClientOptions} */
    clientOptions = { ...options.llmConfig };
    if (options.configOptions) {
      clientOptions.configuration = options.configOptions;
    }

    if (clientOptions.maxTokens != null) {
      delete clientOptions.maxTokens;
    }
    if (clientOptions?.modelKwargs?.max_completion_tokens != null) {
      delete clientOptions.modelKwargs.max_completion_tokens;
    }
    if (clientOptions?.modelKwargs?.max_output_tokens != null) {
      delete clientOptions.modelKwargs.max_output_tokens;
    }

    clientOptions = Object.assign(
      Object.fromEntries(
        Object.entries(clientOptions).filter(([key]) => !omitTitleOptions.has(key)),
      ),
    );

    if (
      provider === Providers.GOOGLE &&
      (endpointConfig?.titleMethod === TitleMethod.FUNCTIONS ||
        endpointConfig?.titleMethod === TitleMethod.STRUCTURED)
    ) {
      clientOptions.json = true;
    }

    /** Resolve request-based headers for Custom Endpoints. Note: if this is added to
     *  non-custom endpoints, needs consideration of varying provider header configs.
     */
    if (clientOptions?.configuration?.defaultHeaders != null) {
      clientOptions.configuration.defaultHeaders = resolveHeaders({
        headers: clientOptions.configuration.defaultHeaders,
        user: createSafeUser(this.options.req?.user),
        body: {
          messageId: this.responseMessageId,
          conversationId: this.conversationId,
          parentMessageId: this.parentMessageId,
        },
      });
    }

    try {
      const titleResult = await this.run.generateTitle({
        provider,
        clientOptions,
        inputText: text,
        contentParts: this.contentParts,
        titleMethod: endpointConfig?.titleMethod,
        titlePrompt: endpointConfig?.titlePrompt,
        titlePromptTemplate: endpointConfig?.titlePromptTemplate,
        chainOptions: {
          signal: abortController.signal,
          callbacks: [
            {
              handleLLMEnd,
            },
          ],
          configurable: {
            thread_id: this.conversationId,
            user_id: this.user ?? this.options.req.user?.id,
          },
        },
      });

      const collectedUsage = collectedMetadata.map((item) => {
        let input_tokens, output_tokens;

        if (item.usage) {
          input_tokens =
            item.usage.prompt_tokens || item.usage.input_tokens || item.usage.inputTokens;
          output_tokens =
            item.usage.completion_tokens || item.usage.output_tokens || item.usage.outputTokens;
        } else if (item.tokenUsage) {
          input_tokens = item.tokenUsage.promptTokens;
          output_tokens = item.tokenUsage.completionTokens;
        }

        return {
          input_tokens: input_tokens,
          output_tokens: output_tokens,
        };
      });

      const balanceConfig = getBalanceConfig(appConfig);
      const transactionsConfig = getTransactionsConfig(appConfig);
      await this.recordCollectedUsage({
        collectedUsage,
        context: 'title',
        model: clientOptions.model,
        balance: balanceConfig,
        transactions: transactionsConfig,
      }).catch((err) => {
        logger.error(
          '[api/server/controllers/agents/client.js #titleConvo] Error recording collected usage',
          err,
        );
      });

      return sanitizeTitle(titleResult.title);
    } catch (err) {
      logger.error('[api/server/controllers/agents/client.js #titleConvo] Error', err);
      return;
    }
  }

  /**
   * @param {object} params
   * @param {number} params.promptTokens
   * @param {number} params.completionTokens
   * @param {string} [params.model]
   * @param {OpenAIUsageMetadata} [params.usage]
   * @param {AppConfig['balance']} [params.balance]
   * @param {string} [params.context='message']
   * @returns {Promise<void>}
   */
  async recordTokenUsage({
    model,
    usage,
    balance,
    promptTokens,
    completionTokens,
    context = 'message',
  }) {
    try {
      await spendTokens(
        {
          model,
          context,
          balance,
          conversationId: this.conversationId,
          user: this.user ?? this.options.req.user?.id,
          endpointTokenConfig: this.options.endpointTokenConfig,
        },
        { promptTokens, completionTokens },
      );

      if (
        usage &&
        typeof usage === 'object' &&
        'reasoning_tokens' in usage &&
        typeof usage.reasoning_tokens === 'number'
      ) {
        await spendTokens(
          {
            model,
            balance,
            context: 'reasoning',
            conversationId: this.conversationId,
            user: this.user ?? this.options.req.user?.id,
            endpointTokenConfig: this.options.endpointTokenConfig,
          },
          { completionTokens: usage.reasoning_tokens },
        );
      }
    } catch (error) {
      logger.error(
        '[api/server/controllers/agents/client.js #recordTokenUsage] Error recording token usage',
        error,
      );
    }
  }

  getEncoding() {
    return 'o200k_base';
  }

  /**
   * Returns the token count of a given text. It also checks and resets the tokenizers if necessary.
   * @param {string} text - The text to get the token count for.
   * @returns {number} The token count of the given text.
   */
  getTokenCount(text) {
    const encoding = this.getEncoding();
    return Tokenizer.getTokenCount(text, encoding);
  }
}

module.exports = AgentClient;
