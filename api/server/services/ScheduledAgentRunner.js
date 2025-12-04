/**
 * ScheduledAgentRunner
 * 
 * A minimal service to execute agents from scheduled triggers.
 * Loads the agent, runs it with the prompt, and returns the response.
 */

const { HumanMessage } = require('@langchain/core/messages');
const { createRun, createSafeUser } = require('@ranger/api');
const { formatAgentMessages, Callback } = require('illuma-agents');
const { EModelEndpoint, ContentTypes } = require('ranger-data-provider');
const { initializeAgent } = require('~/server/services/Endpoints/agents/agent');
const { loadAgentTools } = require('~/server/services/ToolService');
const { getAgent } = require('~/models/Agent');
const { logger } = require('@ranger/data-schemas');

/**
 * Execute an agent with a given prompt
 * @param {Object} options
 * @param {string} options.agentId - The agent ID to execute
 * @param {string} options.prompt - The prompt to send to the agent
 * @param {Object} options.user - The user context (from schedule author)
 * @param {Object} options.appConfig - Application configuration
 * @returns {Promise<{success: boolean, output: string, error?: string}>}
 */
async function executeAgent({ agentId, prompt, user, appConfig }) {
  const startTime = Date.now();
  
  try {
    console.log('[ScheduledAgentRunner] Step 1: Starting execution for agent:', agentId);
    logger.info('[ScheduledAgentRunner] Starting agent execution', {
      agentId,
      userId: user?.id,
      promptLength: prompt?.length,
    });

    // 1. Load the agent from database
    const agent = await getAgent({ id: agentId });
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    console.log('[ScheduledAgentRunner] Step 2: Agent loaded:', agent.name, agent.provider, agent.model);
    logger.debug('[ScheduledAgentRunner] Agent loaded', {
      agentId,
      name: agent.name,
      provider: agent.provider,
      model: agent.model,
    });

    // IMPORTANT: Disable thinking mode BEFORE initialization
    // Scheduled runs start fresh without conversation history, so thinking mode
    // requires special handling we don't support. Disable it early.
    if (agent.model_parameters) {
      // Top-level thinking settings
      if (agent.model_parameters.thinking !== undefined) {
        console.log('[ScheduledAgentRunner] Disabling thinking mode on source agent');
        agent.model_parameters.thinking = false;
      }
      if (agent.model_parameters.thinkingConfig !== undefined) {
        delete agent.model_parameters.thinkingConfig;
      }
      if (agent.model_parameters.budgetTokens !== undefined) {
        delete agent.model_parameters.budgetTokens;
      }
      // Bedrock-specific: thinking is in additionalModelRequestFields
      if (agent.model_parameters.additionalModelRequestFields?.thinking) {
        console.log('[ScheduledAgentRunner] Disabling Bedrock thinking on source agent');
        delete agent.model_parameters.additionalModelRequestFields.thinking;
      }
    }

    // 2. Create a minimal request context for the agent
    const req = {
      user,
      config: appConfig,
      body: {
        endpoint: EModelEndpoint.agents,
        agent_id: agentId,
      },
    };

    // 3. Get allowed providers from config
    const allowedProviders = new Set(
      appConfig?.endpoints?.[EModelEndpoint.agents]?.allowedProviders || []
    );
    console.log('[ScheduledAgentRunner] Step 3: Allowed providers:', [...allowedProviders]);

    // 4. Initialize the agent with tools
    // Create a wrapper for loadAgentTools that matches expected signature
    const loadTools = async ({ req: toolReq, res: toolRes, provider, agentId: toolAgentId, tools, model, tool_resources }) => {
      console.log('[ScheduledAgentRunner] Step 4a: Loading tools for agent');
      return loadAgentTools({
        req: toolReq,
        res: toolRes,
        agent: {
          id: toolAgentId,
          provider,
          model,
          tools,
        },
        signal: null,
        tool_resources,
      });
    };

    console.log('[ScheduledAgentRunner] Step 4: Initializing agent...');
    const initializedAgent = await initializeAgent({
      req,
      res: null, // No response object for scheduled runs
      agent,
      loadTools,
      requestFiles: [],
      conversationId: null,
      useOnlyAttachedFiles: true,
      endpointOption: { endpoint: EModelEndpoint.agents },
      allowedProviders,
      isInitialAgent: true,
    });

    // Disable thinking/extended thinking for scheduled runs (AGAIN after init)
    // initializeAgent may re-add these from options.llmConfig
    if (initializedAgent.model_parameters) {
      // Top-level thinking settings
      if (initializedAgent.model_parameters.thinking !== undefined) {
        console.log('[ScheduledAgentRunner] Disabling top-level thinking mode');
        initializedAgent.model_parameters.thinking = false;
      }
      if (initializedAgent.model_parameters.thinkingConfig !== undefined) {
        delete initializedAgent.model_parameters.thinkingConfig;
      }
      if (initializedAgent.model_parameters.budgetTokens !== undefined) {
        delete initializedAgent.model_parameters.budgetTokens;
      }
      
      // Bedrock-specific: thinking is in additionalModelRequestFields
      if (initializedAgent.model_parameters.additionalModelRequestFields?.thinking) {
        console.log('[ScheduledAgentRunner] Disabling Bedrock thinking mode in additionalModelRequestFields');
        delete initializedAgent.model_parameters.additionalModelRequestFields.thinking;
      }
    }

    console.log('[ScheduledAgentRunner] Step 5: Agent initialized, tools:', initializedAgent.tools?.length || 0);
    console.log('[ScheduledAgentRunner] Model params after init:', JSON.stringify(initializedAgent.model_parameters, null, 2));
    logger.debug('[ScheduledAgentRunner] Agent initialized', {
      agentId,
      toolCount: initializedAgent.tools?.length || 0,
    });

    // 5. Create the message
    const humanMessage = new HumanMessage(prompt);
    const messages = [humanMessage];

    // 6. Format messages for the agent
    const { messages: formattedMessages } = formatAgentMessages(messages, {});

    // 7. Create and run the agent
    const runId = `scheduled-${Date.now()}`;
    const run = await createRun({
      agents: [initializedAgent],
      runId,
      signal: null,
      user: createSafeUser(user),
    });

    if (!run) {
      throw new Error('Failed to create agent run');
    }

    // 8. Collect output parts
    let contentParts = [];
    
    // 9. Process the stream (collect all output)
    const config = {
      runName: 'ScheduledAgentRun',
      configurable: {
        thread_id: `scheduled-${agentId}-${Date.now()}`,
        user_id: user?.id,
        requestBody: {
          messageId: runId,
          conversationId: null,
          parentMessageId: null,
        },
        user: createSafeUser(user),
      },
      recursionLimit: appConfig?.endpoints?.[EModelEndpoint.agents]?.recursionLimit || 25,
      streamMode: 'values',
      version: 'v2',
    };

    await run.processStream({ messages: formattedMessages }, config, {
      callbacks: {
        [Callback.TOOL_ERROR]: (graph, error, toolId) => {
          logger.error('[ScheduledAgentRunner] Tool error', { toolId, error: error.message });
        },
      },
    });

    // 10. Extract output from run
    let output = '';
    if (run.Graph) {
      const parts = run.Graph.getContentParts?.() || [];
      for (const part of parts) {
        if (part.type === ContentTypes.TEXT && part.text) {
          output += part.text;
        }
      }
    }

    // Fallback if no output collected
    if (!output) {
      output = 'Agent completed but produced no text output';
    }

    const duration = Date.now() - startTime;
    logger.info('[ScheduledAgentRunner] Agent execution completed', {
      agentId,
      durationMs: duration,
      outputLength: output.length,
    });

    return {
      success: true,
      output: output.substring(0, 10000), // Limit output size
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    // Log the full error - use console.error as well for visibility
    console.error('[ScheduledAgentRunner] EXECUTION FAILED:', error.message);
    console.error('[ScheduledAgentRunner] STACK:', error.stack);
    logger.error('[ScheduledAgentRunner] Agent execution failed', {
      agentId,
      durationMs: duration,
      error: error.message,
      stack: error.stack,
    });

    return {
      success: false,
      output: '',
      error: error.message,
    };
  }
}

module.exports = {
  executeAgent,
};
