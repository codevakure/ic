const { handleError } = require('@librechat/api');
const { logger } = require('@librechat/data-schemas');
const {
  EndpointURLs,
  EModelEndpoint,
  isAgentsEndpoint,
  parseCompactConvo,
} = require('librechat-data-provider');
const { getMessages } = require('~/models/Message');
const azureAssistants = require('~/server/services/Endpoints/azureAssistants');
const assistants = require('~/server/services/Endpoints/assistants');
const { processFiles } = require('~/server/services/Files/process');
const anthropic = require('~/server/services/Endpoints/anthropic');
const bedrock = require('~/server/services/Endpoints/bedrock');
const openAI = require('~/server/services/Endpoints/openAI');
const agents = require('~/server/services/Endpoints/agents');
const custom = require('~/server/services/Endpoints/custom');
const google = require('~/server/services/Endpoints/google');
const { routeModel } = require('~/server/services/LLMRouter');

const buildFunction = {
  [EModelEndpoint.openAI]: openAI.buildOptions,
  [EModelEndpoint.google]: google.buildOptions,
  [EModelEndpoint.custom]: custom.buildOptions,
  [EModelEndpoint.agents]: agents.buildOptions,
  [EModelEndpoint.bedrock]: bedrock.buildOptions,
  [EModelEndpoint.azureOpenAI]: openAI.buildOptions,
  [EModelEndpoint.anthropic]: anthropic.buildOptions,
  [EModelEndpoint.assistants]: assistants.buildOptions,
  [EModelEndpoint.azureAssistants]: azureAssistants.buildOptions,
};

async function buildEndpointOption(req, res, next) {
  const { endpoint, endpointType } = req.body;
  let parsedBody;
  try {
    parsedBody = parseCompactConvo({ endpoint, endpointType, conversation: req.body });
  } catch (error) {
    logger.warn(
      `Error parsing conversation for endpoint ${endpoint}${error?.message ? `: ${error.message}` : ''}`,
    );
    return handleError(res, { text: 'Error parsing conversation' });
  }

  const appConfig = req.config;
  if (appConfig.modelSpecs?.list && appConfig.modelSpecs?.enforce) {
    /** @type {{ list: TModelSpec[] }}*/
    const { list } = appConfig.modelSpecs;
    const { spec } = parsedBody;

    if (!spec) {
      return handleError(res, { text: 'No model spec selected' });
    }

    const currentModelSpec = list.find((s) => s.name === spec);
    if (!currentModelSpec) {
      return handleError(res, { text: 'Invalid model spec' });
    }

    if (endpoint !== currentModelSpec.preset.endpoint) {
      return handleError(res, { text: 'Model spec mismatch' });
    }

    try {
      currentModelSpec.preset.spec = spec;
      parsedBody = parseCompactConvo({
        endpoint,
        endpointType,
        conversation: currentModelSpec.preset,
      });
      if (currentModelSpec.iconURL != null && currentModelSpec.iconURL !== '') {
        parsedBody.iconURL = currentModelSpec.iconURL;
      }
    } catch (error) {
      logger.error(`Error parsing model spec for endpoint ${endpoint}`, error);
      return handleError(res, { text: 'Error parsing model spec' });
    }
  } else if (parsedBody.spec && appConfig.modelSpecs?.list) {
    // Non-enforced mode: if spec is selected, derive iconURL from model spec
    const modelSpec = appConfig.modelSpecs.list.find((s) => s.name === parsedBody.spec);
    if (modelSpec?.iconURL) {
      parsedBody.iconURL = modelSpec.iconURL;
    }
  }

  try {
    const isAgents =
      isAgentsEndpoint(endpoint) || req.baseUrl.startsWith(EndpointURLs[EModelEndpoint.agents]);
    const builder = isAgents
      ? (...args) => buildFunction[EModelEndpoint.agents](req, ...args)
      : buildFunction[endpointType ?? endpoint];

    // TODO: use object params
    req.body.endpointOption = await builder(endpoint, parsedBody, endpointType);

    // Add modelDisplayLabel and iconURL from endpoint config if not already set
    const endpointConfig = appConfig?.endpoints?.[endpoint];
    if (endpointConfig) {
      if (endpointConfig.modelDisplayLabel && !req.body.endpointOption.modelDisplayLabel) {
        req.body.endpointOption.modelDisplayLabel = endpointConfig.modelDisplayLabel;
      }
      if (endpointConfig.iconURL && !req.body.endpointOption.iconURL) {
        req.body.endpointOption.iconURL = endpointConfig.iconURL;
      }
    }

    const originalModel = req.body.endpointOption?.model_parameters?.model || req.body.model;
    
    // LLM Router: Dynamically select the optimal model based on prompt complexity
    // For AGENTS endpoint: Skip routing here - loadEphemeralAgent handles it AFTER tool selection
    // This is critical because artifacts detection requires tool selection first
    // Fetch recent conversation history for context (if available)
    let conversationHistory = [];
    if (req.body.conversationId && req.user?.id) {
      try {
        const messages = await getMessages(
          { conversationId: req.body.conversationId, user: req.user.id },
          'text sender isCreatedByUser'
        );
        // Convert to simple format and take last 5 messages
        conversationHistory = messages.slice(-5).map(m => ({
          role: m.isCreatedByUser ? 'user' : 'assistant',
          content: m.text?.substring(0, 500) || '', // Limit length
        }));
      } catch (err) {
        logger.debug('[buildEndpointOption] Could not fetch conversation history:', err.message);
      }
    }
    
    // Store conversation history on request for use by loadEphemeralAgent (avoids duplicate fetch)
    req.conversationHistory = conversationHistory;
    
    // Only route for non-agents endpoints
    // Agents endpoint routes in loadEphemeralAgent AFTER tool selection (so artifacts can elevate tier)
    if (!isAgents) {
      const routedModel = await routeModel({
        endpoint,
        prompt: req.body.text || req.body.message || '',
        currentModel: originalModel,
        userId: req.user?.id,
        appConfig: req.config,
        conversationHistory,
      });

      if (routedModel && routedModel !== originalModel) {
        logger.info(`[buildEndpointOption] LLM Router changed model: ${originalModel} -> ${routedModel}`);
        if (req.body.endpointOption?.model_parameters) {
          req.body.endpointOption.model_parameters.model = routedModel;
        }
        req.body.model = routedModel;
        req.body.routedModel = true;
        req.body.originalModel = originalModel;
      }
    }

    if (req.body.files && !isAgents) {
      req.body.endpointOption.attachments = processFiles(req.body.files);
    }

    next();
  } catch (error) {
    logger.error(
      `Error building endpoint option for endpoint ${endpoint} with type ${endpointType}`,
      error,
    );
    return handleError(res, { text: 'Error building endpoint option' });
  }
}

module.exports = buildEndpointOption;
