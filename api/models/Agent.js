const mongoose = require('mongoose');
const crypto = require('node:crypto');
const { logger } = require('@librechat/data-schemas');
const { ResourceType, SystemRoles, Tools, actionDelimiter } = require('librechat-data-provider');
const { GLOBAL_PROJECT_NAME, EPHEMERAL_AGENT_ID, mcp_all, mcp_delimiter } =
  require('librechat-data-provider').Constants;
const {
  analyzeQuery,
  analyzeUploadIntent,
  Tool,
  UploadIntent,
  capabilityToTool,
  toolToCapability,
} = require('@librechat/intent-analyzer');
const { llmClassifierFallback } = require('~/server/services/LLMRouter');
const {
  removeAgentFromAllProjects,
  removeAgentIdsFromProject,
  addAgentIdsToProject,
  getProjectByName,
} = require('./Project');
const { removeAllPermissions } = require('~/server/services/PermissionService');
const { getMCPServerTools } = require('~/server/services/Config');
const { Agent, AclEntry } = require('~/db/models');
const { getActions } = require('./Action');

/**
 * Create an agent with the provided data.
 * @param {Object} agentData - The agent data to create.
 * @returns {Promise<Agent>} The created agent document as a plain object.
 * @throws {Error} If the agent creation fails.
 */
const createAgent = async (agentData) => {
  const { author: _author, ...versionData } = agentData;
  const timestamp = new Date();
  const initialAgentData = {
    ...agentData,
    versions: [
      {
        ...versionData,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    category: agentData.category || 'general',
  };

  return (await Agent.create(initialAgentData)).toObject();
};

/**
 * Get an agent document based on the provided ID.
 *
 * @param {Object} searchParameter - The search parameters to find the agent to update.
 * @param {string} searchParameter.id - The ID of the agent to update.
 * @param {string} searchParameter.author - The user ID of the agent's author.
 * @returns {Promise<Agent|null>} The agent document as a plain object, or null if not found.
 */
const getAgent = async (searchParameter) => await Agent.findOne(searchParameter).lean();

/**
 * Get multiple agent documents based on the provided search parameters.
 *
 * @param {Object} searchParameter - The search parameters to find agents.
 * @returns {Promise<Agent[]>} Array of agent documents as plain objects.
 */
const getAgents = async (searchParameter) => await Agent.find(searchParameter).lean();

/**
 * Load an agent based on the provided ID
 *
 * @param {Object} params
 * @param {ServerRequest} params.req
 * @param {string} params.spec
 * @param {string} params.agent_id
 * @param {string} params.endpoint
 * @param {import('@librechat/agents').ClientOptions} [params.model_parameters]
 * @returns {Promise<Agent|null>} The agent document as a plain object, or null if not found.
 */
const loadEphemeralAgent = async ({ req, spec, agent_id, endpoint, model_parameters: _m }) => {
  const { model, ...model_parameters } = _m;
  const modelSpecs = req.config?.modelSpecs?.list;
  /** @type {TModelSpec | null} */
  let modelSpec = null;
  if (spec != null && spec !== '') {
    modelSpec = modelSpecs?.find((s) => s.name === spec) || null;
  }
  
  // Get agent config from app config
  const agentsConfig = req.config?.endpoints?.agents;
  const capabilities = agentsConfig?.capabilities ?? [];
  const toolsAutoEnabled = agentsConfig?.toolsAutoEnabled ?? ['file_search', 'execute_code', 'artifacts'];
  
  /** @type {TEphemeralAgent | null} */
  const ephemeralAgent = req.body.ephemeralAgent;
  const mcpServers = new Set(ephemeralAgent?.mcp);
  const userId = req.user?.id; // note: userId cannot be undefined at runtime
  if (modelSpec?.mcpServers) {
    for (const mcpServer of modelSpec.mcpServers) {
      mcpServers.add(mcpServer);
    }
  }
  
  // Get query text and files from request body
  const queryText = req.body.text || '';
  const requestFiles = req.body.files || [];
  
  // Determine upload intents for attached files
  const uploadIntents = [];
  for (const file of requestFiles) {
    // Try multiple property names for filename and mimetype
    // The file object from req.body.files has: file_id, filepath, type
    // Extract filename from filepath if needed (e.g., "uploads/user123/filename.xlsx" → "filename.xlsx")
    let filename = file.filename || file.name || file.originalname;
    if (!filename && file.filepath) {
      // Extract filename from filepath (last segment after /)
      const pathParts = file.filepath.split('/');
      filename = pathParts[pathParts.length - 1];
    }
    const mimetype = file.type || file.mimetype || file.mimeType;
    
    if (filename) {
      const intentResult = analyzeUploadIntent({
        filename: filename,
        mimetype: mimetype || 'application/octet-stream',
        size: file.bytes || file.size,
      });
      logger.info(`[loadEphemeralAgent] File "${filename}" (${mimetype}) → intent: ${intentResult.intent}`);
      if (!uploadIntents.includes(intentResult.intent)) {
        uploadIntents.push(intentResult.intent);
      }
    } else {
      logger.warn(`[loadEphemeralAgent] File missing filename property. Keys: ${Object.keys(file).join(', ')}`);
    }
  }
  
  // Get intentAnalyzer config - check if autoToolSelection is enabled
  const intentAnalyzerConfig = req.config?.intentAnalyzer || {};
  const autoToolSelectionEnabled = intentAnalyzerConfig.autoToolSelection === true;
  
  // Map auto-enabled capabilities to Tool enum
  const autoEnabledTools = toolsAutoEnabled
    .map(cap => capabilityToTool(cap))
    .filter(tool => tool !== null);
  
  // Map user explicitly selected tools from ephemeralAgent
  const userSelectedTools = [];
  if (ephemeralAgent?.web_search === true) {
    userSelectedTools.push(Tool.WEB_SEARCH);
  }
  if (ephemeralAgent?.artifacts === true || ephemeralAgent?.artifacts === 'default') {
    userSelectedTools.push(Tool.ARTIFACTS);
  }
  
  // Available tools for intent analyzer = auto-enabled + user-selected ONLY
  // This ensures intent analyzer can only pick from tools that are either:
  // 1. Always enabled via toolsAutoEnabled config
  // 2. Explicitly selected by user in the UI
  const availableTools = [...new Set([...autoEnabledTools, ...userSelectedTools])];
  
  // Determine which tools to use based on autoToolSelection config:
  // - If autoToolSelection: true → Run unified intent analyzer with LLM fallback
  // - If autoToolSelection: false → Use all toolsAutoEnabled + userSelected tools by default
  let intentResult;
  let unifiedResult = null; // Store unified result for model routing
  
  if (autoToolSelectionEnabled) {
    // Use conversation history from request (already fetched by buildEndpointOption) or empty array
    const conversationHistory = req.conversationHistory || [];
    
    // Run unified intent analysis with LLM fallback for ambiguous queries
    // This uses regex first (free, fast), then falls back to Nova Micro if confidence < 0.4
    unifiedResult = await analyzeQuery({
      query: queryText,
      attachedFiles: uploadIntents.length > 0 ? {
        files: requestFiles.map(f => {
          // Extract filename from filepath if not directly available
          let filename = f.filename || f.name || f.originalname;
          if (!filename && f.filepath) {
            const pathParts = f.filepath.split('/');
            filename = pathParts[pathParts.length - 1];
          }
          return { 
            filename: filename || 'unknown', 
            mimetype: f.type || f.mimetype || f.mimeType || 'application/octet-stream', 
            size: f.bytes || f.size 
          };
        }),
        uploadIntents,
      } : undefined,
      availableTools,
      autoEnabledTools,
      userSelectedTools,
      conversationHistory, // Pass conversation history to help LLM understand follow-ups
      llmFallback: llmClassifierFallback, // Use Nova Micro when regex confidence is low
      fallbackThreshold: 0.4, // Trigger LLM if confidence < 40%
    });
    
    // DEBUG: Log raw unified result
    logger.info(`[loadEphemeralAgent] DEBUG unifiedResult.tools: ${JSON.stringify(unifiedResult.tools)}`);
    
    // Extract tool selection result from unified result
    intentResult = unifiedResult.tools;
    
    // Log if LLM fallback was used
    if (unifiedResult.usedLlmFallback) {
      logger.info(`[loadEphemeralAgent] Used LLM fallback for tool selection (regex confidence was low)`);
    }
    
    logger.info(`[loadEphemeralAgent] autoToolSelection: ENABLED - running intent analysis`);
  } else {
    // autoToolSelection is disabled - use all toolsAutoEnabled + userSelected tools by default
    // This is the legacy behavior where tools are always included
    intentResult = {
      tools: availableTools, // All auto-enabled + user-selected tools
      confidence: 1.0,
      reasoning: 'autoToolSelection disabled - using all toolsAutoEnabled tools by default',
      contextPrompts: [],
    };
    logger.info(`[loadEphemeralAgent] autoToolSelection: DISABLED - using all toolsAutoEnabled tools`);
  }
  
  logger.info(`[loadEphemeralAgent] ===== EPHEMERAL AGENT SETUP =====`);
  logger.info(`[loadEphemeralAgent] Query: "${queryText.substring(0, 80)}..."`);
  logger.info(`[loadEphemeralAgent] Files attached: ${requestFiles.length}`);
  if (requestFiles.length > 0) {
    logger.info(`[loadEphemeralAgent] File intents: ${uploadIntents.join(', ')}`);
  }
  logger.info(`[loadEphemeralAgent] Tools sent to analyzer: [${availableTools.map(t => toolToCapability(t)).join(', ')}]`);
  logger.info(`[loadEphemeralAgent] Auto-enabled: [${autoEnabledTools.map(t => toolToCapability(t)).join(', ')}]`);
  logger.info(`[loadEphemeralAgent] Intent result - picked: [${intentResult.tools.map(t => toolToCapability(t)).join(', ')}]`);
  logger.info(`[loadEphemeralAgent] Intent reasoning: ${intentResult.reasoning}`);
  
  // Log clarification if detected
  if (intentResult.clarificationPrompt) {
    logger.info(`[loadEphemeralAgent] Clarification needed: "${intentResult.clarificationPrompt}"`);
    logger.info(`[loadEphemeralAgent] Options: ${JSON.stringify(intentResult.clarificationOptions)}`);
  }
  /** @type {string[]} */
  const tools = [];
  
  // Add tools based on intent analysis (includes auto-enabled tools)
  for (const tool of intentResult.tools) {
    const capability = toolToCapability(tool);
    if (capability === 'execute_code' && !tools.includes(Tools.execute_code)) {
      tools.push(Tools.execute_code);
    } else if (capability === 'file_search' && !tools.includes(Tools.file_search)) {
      tools.push(Tools.file_search);
    } else if (capability === 'web_search' && !tools.includes(Tools.web_search)) {
      tools.push(Tools.web_search);
    }
    // artifacts is handled separately via ephemeralAgent.artifacts
  }
  
  // Legacy fallback: Also add tools based on modelSpec if not already added
  if (modelSpec?.executeCode === true && !tools.includes(Tools.execute_code)) {
    tools.push(Tools.execute_code);
  }
  if (modelSpec?.fileSearch === true && !tools.includes(Tools.file_search)) {
    tools.push(Tools.file_search);
  }
  if (modelSpec?.webSearch === true && !tools.includes(Tools.web_search)) {
    tools.push(Tools.web_search);
  }

  const addedServers = new Set();
  if (mcpServers.size > 0) {
    for (const mcpServer of mcpServers) {
      if (addedServers.has(mcpServer)) {
        continue;
      }
      const serverTools = await getMCPServerTools(userId, mcpServer);
      if (!serverTools) {
        tools.push(`${mcp_all}${mcp_delimiter}${mcpServer}`);
        addedServers.add(mcpServer);
        continue;
      }
      tools.push(...Object.keys(serverTools));
      addedServers.add(mcpServer);
    }
  }

  // Build instructions from promptPrefix
  const instructions = req.body.promptPrefix || '';
  
  // Handle artifacts - check if intent analyzer detected it or user explicitly enabled
  // Just set the artifacts mode here - initializeAgent will generate the prompt using generateArtifactsPrompt
  const hasArtifactsIntent = intentResult.tools.some(t => toolToCapability(t) === 'artifacts');
  const artifactsMode = ephemeralAgent?.artifacts;
  
  // MODEL ROUTING: Use the tier from unified analyzer (already computed during tool selection)
  // The unified analyzer already determines: tools + model tier in ONE call
  // No need for a second routeModel call!
  let finalModel = model;
  
  // Get model tier from unified result (if autoToolSelection was enabled)
  if (autoToolSelectionEnabled && unifiedResult?.model?.tier) {
    let tier = unifiedResult.model.tier;
    
    // Elevate tier if artifacts is detected (Nova Pro can't handle artifact format)
    if (hasArtifactsIntent && (tier === 'trivial' || tier === 'simple')) {
      tier = 'moderate';
      logger.info(`[loadEphemeralAgent] Tier elevated to MODERATE for artifacts`);
    }
    
    // Map tier to actual model ID
    const tierToModel = {
      'trivial': 'us.amazon.nova-lite-v1:0',
      'simple': 'us.amazon.nova-pro-v1:0',
      'moderate': 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
      'complex': 'global.anthropic.claude-opus-4-5-20251101-v1:0',
      'expert': 'us.anthropic.claude-opus-4-20250514-v1:0',
    };
    
    const routedModel = tierToModel[tier] || model;
    if (routedModel !== model) {
      logger.info(`[loadEphemeralAgent] Model routed: ${model} -> ${routedModel} (tier: ${tier})`);
      finalModel = routedModel;
      // Update request for cost tracking
      req.body.routedModel = true;
      req.body.model = routedModel;
      if (req.body.endpointOption?.model_parameters) {
        req.body.endpointOption.model_parameters.model = routedModel;
      }
    }
  }
  
  logger.info(`[loadEphemeralAgent] Final model: ${finalModel}`);
  
  const result = {
    id: agent_id,
    instructions,
    provider: endpoint,
    model_parameters,
    model: finalModel,
    tools,
  };

  // If clarification is needed, store it on result - initializeAgent will prepend to instructions
  // (instructions come FIRST in system prompt, before artifacts prompt)
  if (intentResult.clarificationPrompt) {
    result.clarificationPrompt = intentResult.clarificationPrompt;
    result.clarificationOptions = intentResult.clarificationOptions || [];
    logger.info(`[loadEphemeralAgent] Clarification stored: "${intentResult.clarificationPrompt}"`);
  }

  logger.info(`[loadEphemeralAgent] Final tools array: [${tools.join(', ')}]`);

  // Set artifacts mode on result if enabled (initializeAgent will add the prompt)
  // Use 'default' mode to match ArtifactModes.DEFAULT - this ensures generateArtifactsPrompt works correctly
  if (hasArtifactsIntent || (artifactsMode != null && artifactsMode)) {
    result.artifacts = artifactsMode || 'default';
    logger.info(`[loadEphemeralAgent] Artifacts enabled (mode: ${result.artifacts})`);
  }
  
  return result;
};

/**
 * Load an agent based on the provided ID
 *
 * @param {Object} params
 * @param {ServerRequest} params.req
 * @param {string} params.spec
 * @param {string} params.agent_id
 * @param {string} params.endpoint
 * @param {import('@librechat/agents').ClientOptions} [params.model_parameters]
 * @returns {Promise<Agent|null>} The agent document as a plain object, or null if not found.
 */
const loadAgent = async ({ req, spec, agent_id, endpoint, model_parameters }) => {
  if (!agent_id) {
    return null;
  }
  if (agent_id === EPHEMERAL_AGENT_ID) {
    return await loadEphemeralAgent({ req, spec, agent_id, endpoint, model_parameters });
  }
  const agent = await getAgent({
    id: agent_id,
  });

  if (!agent) {
    return null;
  }

  agent.version = agent.versions ? agent.versions.length : 0;
  return agent;
};

/**
 * Check if a version already exists in the versions array, excluding timestamp and author fields
 * @param {Object} updateData - The update data to compare
 * @param {Object} currentData - The current agent data
 * @param {Array} versions - The existing versions array
 * @param {string} [actionsHash] - Hash of current action metadata
 * @returns {Object|null} - The matching version if found, null otherwise
 */
const isDuplicateVersion = (updateData, currentData, versions, actionsHash = null) => {
  if (!versions || versions.length === 0) {
    return null;
  }

  const excludeFields = [
    '_id',
    'id',
    'createdAt',
    'updatedAt',
    'author',
    'updatedBy',
    'created_at',
    'updated_at',
    '__v',
    'versions',
    'actionsHash', // Exclude actionsHash from direct comparison
  ];

  const { $push: _$push, $pull: _$pull, $addToSet: _$addToSet, ...directUpdates } = updateData;

  if (Object.keys(directUpdates).length === 0 && !actionsHash) {
    return null;
  }

  const wouldBeVersion = { ...currentData, ...directUpdates };
  const lastVersion = versions[versions.length - 1];

  if (actionsHash && lastVersion.actionsHash !== actionsHash) {
    return null;
  }

  const allFields = new Set([...Object.keys(wouldBeVersion), ...Object.keys(lastVersion)]);

  const importantFields = Array.from(allFields).filter((field) => !excludeFields.includes(field));

  let isMatch = true;
  for (const field of importantFields) {
    const wouldBeValue = wouldBeVersion[field];
    const lastVersionValue = lastVersion[field];

    // Skip if both are undefined/null
    if (!wouldBeValue && !lastVersionValue) {
      continue;
    }

    // Handle arrays
    if (Array.isArray(wouldBeValue) || Array.isArray(lastVersionValue)) {
      // Normalize: treat undefined/null as empty array for comparison
      let wouldBeArr;
      if (Array.isArray(wouldBeValue)) {
        wouldBeArr = wouldBeValue;
      } else if (wouldBeValue == null) {
        wouldBeArr = [];
      } else {
        wouldBeArr = [wouldBeValue];
      }

      let lastVersionArr;
      if (Array.isArray(lastVersionValue)) {
        lastVersionArr = lastVersionValue;
      } else if (lastVersionValue == null) {
        lastVersionArr = [];
      } else {
        lastVersionArr = [lastVersionValue];
      }

      if (wouldBeArr.length !== lastVersionArr.length) {
        isMatch = false;
        break;
      }

      // Special handling for projectIds (MongoDB ObjectIds)
      if (field === 'projectIds') {
        const wouldBeIds = wouldBeArr.map((id) => id.toString()).sort();
        const versionIds = lastVersionArr.map((id) => id.toString()).sort();

        if (!wouldBeIds.every((id, i) => id === versionIds[i])) {
          isMatch = false;
          break;
        }
      }
      // Handle arrays of objects
      else if (
        wouldBeArr.length > 0 &&
        typeof wouldBeArr[0] === 'object' &&
        wouldBeArr[0] !== null
      ) {
        const sortedWouldBe = [...wouldBeArr].map((item) => JSON.stringify(item)).sort();
        const sortedVersion = [...lastVersionArr].map((item) => JSON.stringify(item)).sort();

        if (!sortedWouldBe.every((item, i) => item === sortedVersion[i])) {
          isMatch = false;
          break;
        }
      } else {
        const sortedWouldBe = [...wouldBeArr].sort();
        const sortedVersion = [...lastVersionArr].sort();

        if (!sortedWouldBe.every((item, i) => item === sortedVersion[i])) {
          isMatch = false;
          break;
        }
      }
    }
    // Handle objects
    else if (typeof wouldBeValue === 'object' && wouldBeValue !== null) {
      const lastVersionObj =
        typeof lastVersionValue === 'object' && lastVersionValue !== null ? lastVersionValue : {};

      // For empty objects, normalize the comparison
      const wouldBeKeys = Object.keys(wouldBeValue);
      const lastVersionKeys = Object.keys(lastVersionObj);

      // If both are empty objects, they're equal
      if (wouldBeKeys.length === 0 && lastVersionKeys.length === 0) {
        continue;
      }

      // Otherwise do a deep comparison
      if (JSON.stringify(wouldBeValue) !== JSON.stringify(lastVersionObj)) {
        isMatch = false;
        break;
      }
    }
    // Handle primitive values
    else {
      // For primitives, handle the case where one is undefined and the other is a default value
      if (wouldBeValue !== lastVersionValue) {
        // Special handling for boolean false vs undefined
        if (
          typeof wouldBeValue === 'boolean' &&
          wouldBeValue === false &&
          lastVersionValue === undefined
        ) {
          continue;
        }
        // Special handling for empty string vs undefined
        if (
          typeof wouldBeValue === 'string' &&
          wouldBeValue === '' &&
          lastVersionValue === undefined
        ) {
          continue;
        }
        isMatch = false;
        break;
      }
    }
  }

  return isMatch ? lastVersion : null;
};

/**
 * Update an agent with new data without overwriting existing
 *  properties, or create a new agent if it doesn't exist.
 * When an agent is updated, a copy of the current state will be saved to the versions array.
 *
 * @param {Object} searchParameter - The search parameters to find the agent to update.
 * @param {string} searchParameter.id - The ID of the agent to update.
 * @param {string} [searchParameter.author] - The user ID of the agent's author.
 * @param {Object} updateData - An object containing the properties to update.
 * @param {Object} [options] - Optional configuration object.
 * @param {string} [options.updatingUserId] - The ID of the user performing the update (used for tracking non-author updates).
 * @param {boolean} [options.forceVersion] - Force creation of a new version even if no fields changed.
 * @param {boolean} [options.skipVersioning] - Skip version creation entirely (useful for isolated operations like sharing).
 * @returns {Promise<Agent>} The updated or newly created agent document as a plain object.
 * @throws {Error} If the update would create a duplicate version
 */
const updateAgent = async (searchParameter, updateData, options = {}) => {
  const { updatingUserId = null, forceVersion = false, skipVersioning = false } = options;
  const mongoOptions = { new: true, upsert: false };

  const currentAgent = await Agent.findOne(searchParameter);
  if (currentAgent) {
    const {
      __v,
      _id,
      id: __id,
      versions,
      author: _author,
      ...versionData
    } = currentAgent.toObject();
    const { $push, $pull, $addToSet, ...directUpdates } = updateData;

    let actionsHash = null;

    // Generate actions hash if agent has actions
    if (currentAgent.actions && currentAgent.actions.length > 0) {
      // Extract action IDs from the format "domain_action_id"
      const actionIds = currentAgent.actions
        .map((action) => {
          const parts = action.split(actionDelimiter);
          return parts[1]; // Get just the action ID part
        })
        .filter(Boolean);

      if (actionIds.length > 0) {
        try {
          const actions = await getActions(
            {
              action_id: { $in: actionIds },
            },
            true,
          ); // Include sensitive data for hash

          actionsHash = await generateActionMetadataHash(currentAgent.actions, actions);
        } catch (error) {
          logger.error('Error fetching actions for hash generation:', error);
        }
      }
    }

    const shouldCreateVersion =
      !skipVersioning &&
      (forceVersion || Object.keys(directUpdates).length > 0 || $push || $pull || $addToSet);

    if (shouldCreateVersion) {
      const duplicateVersion = isDuplicateVersion(updateData, versionData, versions, actionsHash);
      if (duplicateVersion && !forceVersion) {
        // No changes detected, return the current agent without creating a new version
        const agentObj = currentAgent.toObject();
        agentObj.version = versions.length;
        return agentObj;
      }
    }

    const versionEntry = {
      ...versionData,
      ...directUpdates,
      updatedAt: new Date(),
    };

    // Include actions hash in version if available
    if (actionsHash) {
      versionEntry.actionsHash = actionsHash;
    }

    // Always store updatedBy field to track who made the change
    if (updatingUserId) {
      versionEntry.updatedBy = new mongoose.Types.ObjectId(updatingUserId);
    }

    if (shouldCreateVersion) {
      updateData.$push = {
        ...($push || {}),
        versions: versionEntry,
      };
    }
  }

  return Agent.findOneAndUpdate(searchParameter, updateData, mongoOptions).lean();
};

/**
 * Modifies an agent with the resource file id.
 * @param {object} params
 * @param {ServerRequest} params.req
 * @param {string} params.agent_id
 * @param {string} params.tool_resource
 * @param {string} params.file_id
 * @returns {Promise<Agent>} The updated agent.
 */
const addAgentResourceFile = async ({ req, agent_id, tool_resource, file_id }) => {
  const searchParameter = { id: agent_id };
  let agent = await getAgent(searchParameter);
  if (!agent) {
    throw new Error('Agent not found for adding resource file');
  }
  const fileIdsPath = `tool_resources.${tool_resource}.file_ids`;
  await Agent.updateOne(
    {
      id: agent_id,
      [`${fileIdsPath}`]: { $exists: false },
    },
    {
      $set: {
        [`${fileIdsPath}`]: [],
      },
    },
  );

  const updateData = {
    $addToSet: {
      tools: tool_resource,
      [fileIdsPath]: file_id,
    },
  };

  const updatedAgent = await updateAgent(searchParameter, updateData, {
    updatingUserId: req?.user?.id,
  });
  if (updatedAgent) {
    return updatedAgent;
  } else {
    throw new Error('Agent not found for adding resource file');
  }
};

/**
 * Removes multiple resource files from an agent using atomic operations.
 * @param {object} params
 * @param {string} params.agent_id
 * @param {Array<{tool_resource: string, file_id: string}>} params.files
 * @returns {Promise<Agent>} The updated agent.
 * @throws {Error} If the agent is not found or update fails.
 */
const removeAgentResourceFiles = async ({ agent_id, files }) => {
  const searchParameter = { id: agent_id };

  // Group files to remove by resource
  const filesByResource = files.reduce((acc, { tool_resource, file_id }) => {
    if (!acc[tool_resource]) {
      acc[tool_resource] = [];
    }
    acc[tool_resource].push(file_id);
    return acc;
  }, {});

  // Step 1: Atomically remove file IDs using $pull
  const pullOps = {};
  const resourcesToCheck = new Set();
  for (const [resource, fileIds] of Object.entries(filesByResource)) {
    const fileIdsPath = `tool_resources.${resource}.file_ids`;
    pullOps[fileIdsPath] = { $in: fileIds };
    resourcesToCheck.add(resource);
  }

  const updatePullData = { $pull: pullOps };
  const agentAfterPull = await Agent.findOneAndUpdate(searchParameter, updatePullData, {
    new: true,
  }).lean();

  if (!agentAfterPull) {
    // Agent might have been deleted concurrently, or never existed.
    // Check if it existed before trying to throw.
    const agentExists = await getAgent(searchParameter);
    if (!agentExists) {
      throw new Error('Agent not found for removing resource files');
    }
    // If it existed but findOneAndUpdate returned null, something else went wrong.
    throw new Error('Failed to update agent during file removal (pull step)');
  }

  // Return the agent state directly after the $pull operation.
  // Skipping the $unset step for now to simplify and test core $pull atomicity.
  // Empty arrays might remain, but the removal itself should be correct.
  return agentAfterPull;
};

/**
 * Deletes an agent based on the provided ID.
 *
 * @param {Object} searchParameter - The search parameters to find the agent to delete.
 * @param {string} searchParameter.id - The ID of the agent to delete.
 * @param {string} [searchParameter.author] - The user ID of the agent's author.
 * @returns {Promise<void>} Resolves when the agent has been successfully deleted.
 */
const deleteAgent = async (searchParameter) => {
  const agent = await Agent.findOneAndDelete(searchParameter);
  if (agent) {
    await removeAgentFromAllProjects(agent.id);
    await removeAllPermissions({
      resourceType: ResourceType.AGENT,
      resourceId: agent._id,
    });
  }
  return agent;
};

/**
 * Deletes all agents created by a specific user.
 * @param {string} userId - The ID of the user whose agents should be deleted.
 * @returns {Promise<void>} A promise that resolves when all user agents have been deleted.
 */
const deleteUserAgents = async (userId) => {
  try {
    const userAgents = await getAgents({ author: userId });

    if (userAgents.length === 0) {
      return;
    }

    const agentIds = userAgents.map((agent) => agent.id);
    const agentObjectIds = userAgents.map((agent) => agent._id);

    for (const agentId of agentIds) {
      await removeAgentFromAllProjects(agentId);
    }

    await AclEntry.deleteMany({
      resourceType: ResourceType.AGENT,
      resourceId: { $in: agentObjectIds },
    });

    await Agent.deleteMany({ author: userId });
  } catch (error) {
    logger.error('[deleteUserAgents] General error:', error);
  }
};

/**
 * Get agents by accessible IDs with optional cursor-based pagination.
 * @param {Object} params - The parameters for getting accessible agents.
 * @param {Array} [params.accessibleIds] - Array of agent ObjectIds the user has ACL access to.
 * @param {Object} [params.otherParams] - Additional query parameters (including author filter).
 * @param {number} [params.limit] - Number of agents to return (max 100). If not provided, returns all agents.
 * @param {string} [params.after] - Cursor for pagination - get agents after this cursor. // base64 encoded JSON string with updatedAt and _id.
 * @returns {Promise<Object>} A promise that resolves to an object containing the agents data and pagination info.
 */
const getListAgentsByAccess = async ({
  accessibleIds = [],
  otherParams = {},
  limit = null,
  after = null,
}) => {
  const isPaginated = limit !== null && limit !== undefined;
  const normalizedLimit = isPaginated ? Math.min(Math.max(1, parseInt(limit) || 20), 100) : null;

  // Build base query combining ACL accessible agents with other filters
  const baseQuery = { ...otherParams, _id: { $in: accessibleIds } };

  // Add cursor condition
  if (after) {
    try {
      const cursor = JSON.parse(Buffer.from(after, 'base64').toString('utf8'));
      const { updatedAt, _id } = cursor;

      const cursorCondition = {
        $or: [
          { updatedAt: { $lt: new Date(updatedAt) } },
          { updatedAt: new Date(updatedAt), _id: { $gt: new mongoose.Types.ObjectId(_id) } },
        ],
      };

      // Merge cursor condition with base query
      if (Object.keys(baseQuery).length > 0) {
        baseQuery.$and = [{ ...baseQuery }, cursorCondition];
        // Remove the original conditions from baseQuery to avoid duplication
        Object.keys(baseQuery).forEach((key) => {
          if (key !== '$and') delete baseQuery[key];
        });
      } else {
        Object.assign(baseQuery, cursorCondition);
      }
    } catch (error) {
      logger.warn('Invalid cursor:', error.message);
    }
  }

  let query = Agent.find(baseQuery, {
    id: 1,
    _id: 1,
    name: 1,
    avatar: 1,
    author: 1,
    projectIds: 1,
    description: 1,
    updatedAt: 1,
    category: 1,
    support_contact: 1,
    is_promoted: 1,
  }).sort({ updatedAt: -1, _id: 1 });

  // Only apply limit if pagination is requested
  if (isPaginated) {
    query = query.limit(normalizedLimit + 1);
  }

  const agents = await query.lean();

  const hasMore = isPaginated ? agents.length > normalizedLimit : false;
  const data = (isPaginated ? agents.slice(0, normalizedLimit) : agents).map((agent) => {
    if (agent.author) {
      agent.author = agent.author.toString();
    }
    return agent;
  });

  // Generate next cursor only if paginated
  let nextCursor = null;
  if (isPaginated && hasMore && data.length > 0) {
    const lastAgent = agents[normalizedLimit - 1];
    nextCursor = Buffer.from(
      JSON.stringify({
        updatedAt: lastAgent.updatedAt.toISOString(),
        _id: lastAgent._id.toString(),
      }),
    ).toString('base64');
  }

  return {
    object: 'list',
    data,
    first_id: data.length > 0 ? data[0].id : null,
    last_id: data.length > 0 ? data[data.length - 1].id : null,
    has_more: hasMore,
    after: nextCursor,
  };
};

/**
 * Get all agents.
 * @deprecated Use getListAgentsByAccess for ACL-aware agent listing
 * @param {Object} searchParameter - The search parameters to find matching agents.
 * @param {string} searchParameter.author - The user ID of the agent's author.
 * @returns {Promise<Object>} A promise that resolves to an object containing the agents data and pagination info.
 */
const getListAgents = async (searchParameter) => {
  const { author, ...otherParams } = searchParameter;

  let query = Object.assign({ author }, otherParams);

  const globalProject = await getProjectByName(GLOBAL_PROJECT_NAME, ['agentIds']);
  if (globalProject && (globalProject.agentIds?.length ?? 0) > 0) {
    const globalQuery = { id: { $in: globalProject.agentIds }, ...otherParams };
    delete globalQuery.author;
    query = { $or: [globalQuery, query] };
  }
  const agents = (
    await Agent.find(query, {
      id: 1,
      _id: 1,
      name: 1,
      avatar: 1,
      author: 1,
      projectIds: 1,
      description: 1,
      // @deprecated - isCollaborative replaced by ACL permissions
      isCollaborative: 1,
      category: 1,
    }).lean()
  ).map((agent) => {
    if (agent.author?.toString() !== author) {
      delete agent.author;
    }
    if (agent.author) {
      agent.author = agent.author.toString();
    }
    return agent;
  });

  const hasMore = agents.length > 0;
  const firstId = agents.length > 0 ? agents[0].id : null;
  const lastId = agents.length > 0 ? agents[agents.length - 1].id : null;

  return {
    data: agents,
    has_more: hasMore,
    first_id: firstId,
    last_id: lastId,
  };
};

/**
 * Updates the projects associated with an agent, adding and removing project IDs as specified.
 * This function also updates the corresponding projects to include or exclude the agent ID.
 *
 * @param {Object} params - Parameters for updating the agent's projects.
 * @param {IUser} params.user - Parameters for updating the agent's projects.
 * @param {string} params.agentId - The ID of the agent to update.
 * @param {string[]} [params.projectIds] - Array of project IDs to add to the agent.
 * @param {string[]} [params.removeProjectIds] - Array of project IDs to remove from the agent.
 * @returns {Promise<MongoAgent>} The updated agent document.
 * @throws {Error} If there's an error updating the agent or projects.
 */
const updateAgentProjects = async ({ user, agentId, projectIds, removeProjectIds }) => {
  const updateOps = {};

  if (removeProjectIds && removeProjectIds.length > 0) {
    for (const projectId of removeProjectIds) {
      await removeAgentIdsFromProject(projectId, [agentId]);
    }
    updateOps.$pull = { projectIds: { $in: removeProjectIds } };
  }

  if (projectIds && projectIds.length > 0) {
    for (const projectId of projectIds) {
      await addAgentIdsToProject(projectId, [agentId]);
    }
    updateOps.$addToSet = { projectIds: { $each: projectIds } };
  }

  if (Object.keys(updateOps).length === 0) {
    return await getAgent({ id: agentId });
  }

  const updateQuery = { id: agentId, author: user.id };
  if (user.role === SystemRoles.ADMIN) {
    delete updateQuery.author;
  }

  const updatedAgent = await updateAgent(updateQuery, updateOps, {
    updatingUserId: user.id,
    skipVersioning: true,
  });
  if (updatedAgent) {
    return updatedAgent;
  }
  if (updateOps.$addToSet) {
    for (const projectId of projectIds) {
      await removeAgentIdsFromProject(projectId, [agentId]);
    }
  } else if (updateOps.$pull) {
    for (const projectId of removeProjectIds) {
      await addAgentIdsToProject(projectId, [agentId]);
    }
  }

  return await getAgent({ id: agentId });
};

/**
 * Reverts an agent to a specific version in its version history.
 * @param {Object} searchParameter - The search parameters to find the agent to revert.
 * @param {string} searchParameter.id - The ID of the agent to revert.
 * @param {string} [searchParameter.author] - The user ID of the agent's author.
 * @param {number} versionIndex - The index of the version to revert to in the versions array.
 * @returns {Promise<MongoAgent>} The updated agent document after reverting.
 * @throws {Error} If the agent is not found or the specified version does not exist.
 */
const revertAgentVersion = async (searchParameter, versionIndex) => {
  const agent = await Agent.findOne(searchParameter);
  if (!agent) {
    throw new Error('Agent not found');
  }

  if (!agent.versions || !agent.versions[versionIndex]) {
    throw new Error(`Version ${versionIndex} not found`);
  }

  const revertToVersion = agent.versions[versionIndex];

  const updateData = {
    ...revertToVersion,
  };

  delete updateData._id;
  delete updateData.id;
  delete updateData.versions;
  delete updateData.author;
  delete updateData.updatedBy;

  return Agent.findOneAndUpdate(searchParameter, updateData, { new: true }).lean();
};

/**
 * Generates a hash of action metadata for version comparison
 * @param {string[]} actionIds - Array of action IDs in format "domain_action_id"
 * @param {Action[]} actions - Array of action documents
 * @returns {Promise<string>} - SHA256 hash of the action metadata
 */
const generateActionMetadataHash = async (actionIds, actions) => {
  if (!actionIds || actionIds.length === 0) {
    return '';
  }

  // Create a map of action_id to metadata for quick lookup
  const actionMap = new Map();
  actions.forEach((action) => {
    actionMap.set(action.action_id, action.metadata);
  });

  // Sort action IDs for consistent hashing
  const sortedActionIds = [...actionIds].sort();

  // Build a deterministic string representation of all action metadata
  const metadataString = sortedActionIds
    .map((actionFullId) => {
      // Extract just the action_id part (after the delimiter)
      const parts = actionFullId.split(actionDelimiter);
      const actionId = parts[1];

      const metadata = actionMap.get(actionId);
      if (!metadata) {
        return `${actionId}:null`;
      }

      // Sort metadata keys for deterministic output
      const sortedKeys = Object.keys(metadata).sort();
      const metadataStr = sortedKeys
        .map((key) => `${key}:${JSON.stringify(metadata[key])}`)
        .join(',');
      return `${actionId}:{${metadataStr}}`;
    })
    .join(';');

  // Use Web Crypto API to generate hash
  const encoder = new TextEncoder();
  const data = encoder.encode(metadataString);
  const hashBuffer = await crypto.webcrypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
};
/**
 * Counts the number of promoted agents.
 * @returns  {Promise<number>} - The count of promoted agents
 */
const countPromotedAgents = async () => {
  const count = await Agent.countDocuments({ is_promoted: true });
  return count;
};

/**
 * Load a default agent based on the endpoint
 * @param {string} endpoint
 * @returns {Agent | null}
 */

module.exports = {
  getAgent,
  getAgents,
  loadAgent,
  createAgent,
  updateAgent,
  deleteAgent,
  deleteUserAgents,
  getListAgents,
  revertAgentVersion,
  updateAgentProjects,
  addAgentResourceFile,
  getListAgentsByAccess,
  removeAgentResourceFiles,
  generateActionMetadataHash,
  countPromotedAgents,
};
